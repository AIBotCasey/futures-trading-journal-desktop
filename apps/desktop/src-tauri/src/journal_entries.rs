use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::models::JournalEntry;

pub fn get_daily_entry(conn: &Connection, date_local: &str) -> anyhow::Result<JournalEntry> {
    let row: Option<(String, String)> = conn
        .query_row(
            "SELECT id, text FROM journal_entries WHERE date_local = ?1 AND type = 'daily'",
            params![date_local],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;

    if let Some((_id, text)) = row {
        return Ok(JournalEntry {
            date_local: date_local.to_string(),
            text,
        });
    }

    Ok(JournalEntry {
        date_local: date_local.to_string(),
        text: "".to_string(),
    })
}

pub fn upsert_daily_entry(conn: &Connection, date_local: &str, text: &str) -> anyhow::Result<()> {
    let now = chrono::Utc::now().timestamp_millis();

    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM journal_entries WHERE date_local = ?1 AND type = 'daily'",
            params![date_local],
            |r| r.get(0),
        )
        .optional()?;

    if let Some(id) = existing {
        conn.execute(
            "UPDATE journal_entries SET text=?2, updated_at_utc=?3 WHERE id=?1",
            params![id, text, now],
        )?;
        return Ok(());
    }

    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO journal_entries (id, date_local, type, text, created_at_utc, updated_at_utc)
         VALUES (?1, ?2, 'daily', ?3, ?4, ?4)",
        params![id, date_local, text, now],
    )?;

    Ok(())
}
