use anyhow::Context;
use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::models::{Rule, Trade, TradeInput, TradeWithRules};

pub fn list_trades(conn: &Connection, limit: i64, offset: i64) -> anyhow::Result<Vec<Trade>> {
    let mut stmt = conn.prepare(
        "SELECT id, market, symbol, side, qty, entry_time_utc, exit_time_utc, timezone, session, pnl_amount,
                pnl_includes_fees, fees, pnl_net, pnl_gross, notes, created_at_utc, updated_at_utc
         FROM trades
         ORDER BY exit_time_utc DESC
         LIMIT ?1 OFFSET ?2",
    )?;

    let rows = stmt.query_map(params![limit, offset], |row| {
        Ok(Trade {
            id: row.get(0)?,
            market: row.get(1)?,
            symbol: row.get(2)?,
            side: row.get(3)?,
            qty: row.get(4)?,
            entry_time_utc: row.get(5)?,
            exit_time_utc: row.get(6)?,
            timezone: row.get(7)?,
            session: row.get(8)?,
            pnl_amount: row.get(9)?,
            pnl_includes_fees: row.get(10)?,
            fees: row.get(11)?,
            pnl_net: row.get(12)?,
            pnl_gross: row.get(13)?,
            notes: row.get(14)?,
            created_at_utc: row.get(15)?,
            updated_at_utc: row.get(16)?,
        })
    })?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn get_trade_with_rules(conn: &Connection, trade_id: &str) -> anyhow::Result<TradeWithRules> {
    let trade: Trade = conn
        .query_row(
            "SELECT id, market, symbol, side, qty, entry_time_utc, exit_time_utc, timezone, session, pnl_amount,
                    pnl_includes_fees, fees, pnl_net, pnl_gross, notes, created_at_utc, updated_at_utc
             FROM trades WHERE id = ?1",
            params![trade_id],
            |row| {
                Ok(Trade {
                    id: row.get(0)?,
                    market: row.get(1)?,
                    symbol: row.get(2)?,
                    side: row.get(3)?,
                    qty: row.get(4)?,
                    entry_time_utc: row.get(5)?,
                    exit_time_utc: row.get(6)?,
                    timezone: row.get(7)?,
                    session: row.get(8)?,
                    pnl_amount: row.get(9)?,
                    pnl_includes_fees: row.get(10)?,
                    fees: row.get(11)?,
                    pnl_net: row.get(12)?,
                    pnl_gross: row.get(13)?,
                    notes: row.get(14)?,
                    created_at_utc: row.get(15)?,
                    updated_at_utc: row.get(16)?,
                })
            },
        )
        .context("trade not found")?;

    // get rules list
    let mut stmt = conn.prepare("SELECT id, label, sort_order FROM rules ORDER BY sort_order ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(Rule {
            id: row.get(0)?,
            label: row.get(1)?,
            sort_order: row.get(2)?,
        })
    })?;
    let mut rules = Vec::new();
    for r in rows {
        rules.push(r?);
    }

    // checked map
    let mut stmt = conn.prepare("SELECT rule_id, checked FROM trade_rules WHERE trade_id = ?1")?;
    let rows = stmt.query_map(params![trade_id], |row| {
        let rule_id: String = row.get(0)?;
        let checked: i64 = row.get(1)?;
        Ok((rule_id, checked != 0))
    })?;
    let mut checked = std::collections::HashMap::new();
    for r in rows {
        let (id, v) = r?;
        checked.insert(id, v);
    }

    Ok(TradeWithRules {
        trade,
        rules,
        checked,
    })
}

pub fn create_trade(conn: &Connection, input: TradeInput) -> anyhow::Result<Trade> {
    validate_trade(&input)?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();

    let (pnl_net, pnl_gross) = derive_pnl(input.pnl_amount, input.fees, input.pnl_includes_fees);

    conn.execute(
        "INSERT INTO trades (
            id, market, symbol, side, qty, entry_time_utc, exit_time_utc, timezone, session,
            pnl_amount, pnl_includes_fees, fees, pnl_net, pnl_gross, notes, created_at_utc, updated_at_utc
        ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",
        params![
            id,
            input.market,
            input.symbol,
            input.side,
            input.qty,
            input.entry_time_utc,
            input.exit_time_utc,
            input.timezone,
            input.session,
            input.pnl_amount,
            if input.pnl_includes_fees { 1 } else { 0 },
            input.fees,
            pnl_net,
            pnl_gross,
            input.notes,
            now,
            now
        ],
    )?;

    // ensure trade_rules rows exist for all rules
    let mut stmt = conn.prepare("SELECT id FROM rules")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    for r in rows {
        let rule_id = r?;
        let checked = input
            .rules_checked
            .as_ref()
            .and_then(|m| m.get(&rule_id).copied())
            .unwrap_or(false);

        conn.execute(
            "INSERT INTO trade_rules (trade_id, rule_id, checked) VALUES (?1, ?2, ?3)",
            params![id, rule_id, if checked { 1 } else { 0 }],
        )?;
    }

    Ok(get_trade_with_rules(conn, &id)?.trade)
}

pub fn update_trade(conn: &Connection, id: &str, input: TradeInput) -> anyhow::Result<Trade> {
    validate_trade(&input)?;

    let now = chrono::Utc::now().timestamp_millis();
    let (pnl_net, pnl_gross) = derive_pnl(input.pnl_amount, input.fees, input.pnl_includes_fees);

    conn.execute(
        "UPDATE trades SET
            market=?2, symbol=?3, side=?4, qty=?5, entry_time_utc=?6, exit_time_utc=?7, timezone=?8, session=?9,
            pnl_amount=?10, pnl_includes_fees=?11, fees=?12, pnl_net=?13, pnl_gross=?14, notes=?15, updated_at_utc=?16
         WHERE id=?1",
        params![
            id,
            input.market,
            input.symbol,
            input.side,
            input.qty,
            input.entry_time_utc,
            input.exit_time_utc,
            input.timezone,
            input.session,
            input.pnl_amount,
            if input.pnl_includes_fees { 1 } else { 0 },
            input.fees,
            pnl_net,
            pnl_gross,
            input.notes,
            now
        ],
    )?;

    if let Some(map) = input.rules_checked {
        for (rule_id, checked) in map {
            conn.execute(
                "INSERT INTO trade_rules (trade_id, rule_id, checked) VALUES (?1, ?2, ?3)
                 ON CONFLICT(trade_id, rule_id) DO UPDATE SET checked=excluded.checked",
                params![id, rule_id, if checked { 1 } else { 0 }],
            )?;
        }
    }

    Ok(get_trade_with_rules(conn, id)?.trade)
}

pub fn delete_trade(conn: &Connection, id: &str) -> anyhow::Result<()> {
    conn.execute("DELETE FROM trades WHERE id=?1", params![id])?;
    Ok(())
}

fn derive_pnl(pnl_amount: f64, fees: f64, includes_fees: bool) -> (f64, f64) {
    if includes_fees {
        let net = pnl_amount;
        let gross = pnl_amount + fees;
        (net, gross)
    } else {
        let gross = pnl_amount;
        let net = pnl_amount - fees;
        (net, gross)
    }
}

fn validate_trade(input: &TradeInput) -> anyhow::Result<()> {
    if input.symbol.trim().is_empty() {
        anyhow::bail!("symbol is required");
    }
    if input.qty <= 0.0 {
        anyhow::bail!("qty must be > 0");
    }
    if input.exit_time_utc <= input.entry_time_utc {
        anyhow::bail!("exit time must be after entry time");
    }
    if input.fees < 0.0 {
        anyhow::bail!("fees must be >= 0");
    }
    Ok(())
}
