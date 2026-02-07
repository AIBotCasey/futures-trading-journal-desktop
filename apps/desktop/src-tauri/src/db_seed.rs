use rusqlite::{params, Connection};

pub fn seed_default_rules(conn: &Connection) -> anyhow::Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM rules", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    // Opinionated defaults; users can edit later.
    let defaults: Vec<(&str, &str)> = vec![
        ("followed_plan", "Followed the trade plan"),
        ("waited_confirmation", "Waited for confirmation"),
        ("traded_in_session", "Traded in my intended session"),
        ("respected_risk", "Respected my risk limits"),
        ("no_revenge", "Avoided revenge trading"),
        ("no_fomo", "Avoided FOMO entries"),
        ("logged_immediately", "Logged the trade immediately"),
    ];

    for (i, (id, label)) in defaults.iter().enumerate() {
        conn.execute(
            "INSERT INTO rules (id, label, sort_order) VALUES (?1, ?2, ?3)",
            params![*id, *label, i as i64],
        )?;
    }

    Ok(())
}
