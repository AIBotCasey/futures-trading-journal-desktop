use anyhow::Context;
use parking_lot::Mutex;
use rusqlite::{params, Connection};
use std::path::Path;

use crate::db_seed::seed_default_rules;

#[derive(Debug, Clone, Copy, serde::Serialize)]
pub struct DbStatus {
    pub configured: bool,
    pub encrypted: bool,
    pub unlocked: bool,
}

#[derive(Debug)]
pub struct DbState {
    conn: Mutex<Option<Connection>>,
    pub encrypted: Mutex<bool>,
    pub db_path: Mutex<Option<String>>,
}

impl Default for DbState {
    fn default() -> Self {
        Self {
            conn: Mutex::new(None),
            encrypted: Mutex::new(false),
            db_path: Mutex::new(None),
        }
    }
}

impl DbState {
    pub fn status(&self) -> DbStatus {
        let configured = self.db_path.lock().is_some();
        let encrypted = *self.encrypted.lock();
        let unlocked = self.conn.lock().is_some();
        DbStatus {
            configured,
            encrypted,
            unlocked,
        }
    }

    pub fn configure(&self, db_path: String, encrypted: bool) {
        *self.db_path.lock() = Some(db_path);
        *self.encrypted.lock() = encrypted;
    }

    pub fn close(&self) {
        *self.conn.lock() = None;
    }

    pub fn create_new(&self, path: &Path, encrypted: bool, passphrase: Option<&str>) -> anyhow::Result<()> {
        if path.exists() {
            // Avoid accidental overwrite.
            anyhow::bail!("Database already exists at {}", path.display());
        }

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("create db directory {}", parent.display()))?;
        }

        let conn = Connection::open(path).with_context(|| format!("open db at {}", path.display()))?;
        set_pragmas(&conn, encrypted, passphrase)?;
        migrate_to_v1(&conn)?;

        *self.conn.lock() = Some(conn);
        Ok(())
    }

    pub fn open_existing(&self, path: &Path, encrypted: bool, passphrase: Option<&str>) -> anyhow::Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("create db directory {}", parent.display()))?;
        }
        let conn = Connection::open(path).with_context(|| format!("open db at {}", path.display()))?;
        set_pragmas(&conn, encrypted, passphrase)?;

        // If encrypted and wrong key, this should fail when we touch the schema.
        // Do a small read to force decryption.
        let _ver: i64 = conn
            .query_row("SELECT 1", [], |row| row.get(0))
            .context("db probe query")?;

        // Ensure schema exists; if not, initialize.
        migrate_to_v1(&conn)?;

        *self.conn.lock() = Some(conn);
        Ok(())
    }

    pub fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> anyhow::Result<T>) -> anyhow::Result<T> {
        let guard = self.conn.lock();
        let conn = guard.as_ref().context("database is locked")?;
        f(conn)
    }
}

fn set_pragmas(conn: &Connection, encrypted: bool, passphrase: Option<&str>) -> anyhow::Result<()> {
    conn.pragma_update(None, "foreign_keys", "ON")?;

    if encrypted {
        let key = passphrase.context("passphrase required for encrypted database")?;
        // SQLCipher key (works with bundled-sqlcipher)
        conn.pragma_update(None, "key", key)?;

        // Reasonable SQLCipher defaults
        // https://www.zetetic.net/sqlcipher/sqlcipher-api/
        conn.execute_batch(
            "PRAGMA cipher_page_size = 4096;\
             PRAGMA kdf_iter = 64000;\
             PRAGMA cipher_hmac_algorithm = HMAC_SHA512;\
             PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512;",
        )?;

        // Force a read to validate key
        let _: i64 = conn.query_row("SELECT count(*) FROM sqlite_master", [], |row| row.get(0))?;
    }

    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;

    Ok(())
}

fn migrate_to_v1(conn: &Connection) -> anyhow::Result<()> {
    // Meta table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS meta (
            schema_version INTEGER NOT NULL,
            created_at_utc INTEGER NOT NULL
        );",
    )?;

    // If meta empty, insert.
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM meta", [], |row| row.get(0))?;
    if count == 0 {
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO meta (schema_version, created_at_utc) VALUES (?1, ?2)",
            params![1i64, now],
        )?;
    }

    // Settings
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL
        );",
    )?;

    // Trades
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS trades (
            id TEXT PRIMARY KEY,
            market TEXT NOT NULL,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL,
            qty REAL NOT NULL,
            entry_time_utc INTEGER NOT NULL,
            exit_time_utc INTEGER NOT NULL,
            timezone TEXT NOT NULL,
            session TEXT NOT NULL,
            pnl_amount REAL NOT NULL,
            pnl_includes_fees INTEGER NOT NULL,
            fees REAL NOT NULL,
            pnl_net REAL NOT NULL,
            pnl_gross REAL NOT NULL,
            notes TEXT NOT NULL,
            created_at_utc INTEGER NOT NULL,
            updated_at_utc INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_trades_exit_time ON trades(exit_time_utc DESC);
        CREATE INDEX IF NOT EXISTS idx_trades_symbol_exit_time ON trades(symbol, exit_time_utc DESC);
        CREATE INDEX IF NOT EXISTS idx_trades_session_exit_time ON trades(session, exit_time_utc DESC);
        ",
    )?;

    // Rules
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS rules (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            sort_order INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS trade_rules (
            trade_id TEXT NOT NULL,
            rule_id TEXT NOT NULL,
            checked INTEGER NOT NULL,
            PRIMARY KEY (trade_id, rule_id),
            FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE,
            FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE
        );
        ",
    )?;

    seed_default_rules(conn)?;

    // Journal
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS journal_entries (
            id TEXT PRIMARY KEY,
            date_local TEXT NOT NULL,
            type TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at_utc INTEGER NOT NULL,
            updated_at_utc INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date_local);

        CREATE TABLE IF NOT EXISTS journal_trade_links (
            journal_entry_id TEXT NOT NULL,
            trade_id TEXT NOT NULL,
            PRIMARY KEY (journal_entry_id, trade_id),
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
            FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE
        );
        ",
    )?;

    Ok(())
}
