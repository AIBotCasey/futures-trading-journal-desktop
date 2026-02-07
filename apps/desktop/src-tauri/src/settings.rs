use anyhow::Context;
use rusqlite::{params, Connection, OptionalExtension};

const KEY_TIMEZONE: &str = "timezone";

pub fn get_timezone(conn: &Connection) -> anyhow::Result<String> {
    let tz: Option<String> = conn
        .query_row(
            "SELECT value_json FROM settings WHERE key = ?1",
            params![KEY_TIMEZONE],
            |row| row.get(0),
        )
        .optional()?;

    if let Some(raw) = tz {
        let tz: String = serde_json::from_str(&raw).context("parse timezone json")?;
        return Ok(tz);
    }

    // Default fallback (can be overridden in UI)
    Ok("America/New_York".to_string())
}

pub fn set_timezone(conn: &Connection, tz: &str) -> anyhow::Result<()> {
    let raw = serde_json::to_string(tz)?;
    conn.execute(
        "INSERT INTO settings(key, value_json) VALUES(?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
        params![KEY_TIMEZONE, raw],
    )?;
    Ok(())
}
