use anyhow::Context;
use chrono::{DateTime, Datelike, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use rusqlite::{params, Connection};

use crate::models::{DaySummary, TradeHighlight};

fn parse_tz(tz: &str) -> anyhow::Result<Tz> {
    tz.parse::<Tz>().with_context(|| format!("invalid timezone: {tz}"))
}

fn local_date_str(tz: Tz, utc_ms: i64) -> String {
    let dt_utc: DateTime<Utc> = Utc
        .timestamp_millis_opt(utc_ms)
        .single()
        .unwrap_or_else(|| Utc.timestamp_millis_opt(0).single().unwrap());
    let dt_local = dt_utc.with_timezone(&tz);
    dt_local.format("%Y-%m-%d").to_string()
}

fn utc_range_for_local_date(tz: Tz, date_local: &str) -> anyhow::Result<(i64, i64)> {
    let d = NaiveDate::parse_from_str(date_local, "%Y-%m-%d")
        .with_context(|| format!("invalid date_local: {date_local}"))?;
    let start_local = tz
        .with_ymd_and_hms(d.year(), d.month(), d.day(), 0, 0, 0)
        .single()
        .context("invalid local day start")?;
    let end_local = start_local + chrono::Duration::days(1);

    Ok((
        start_local.with_timezone(&Utc).timestamp_millis(),
        end_local.with_timezone(&Utc).timestamp_millis(),
    ))
}

pub fn month_summary(conn: &Connection, tz_name: &str, year: i32, month: u32) -> anyhow::Result<Vec<DaySummary>> {
    let tz = parse_tz(tz_name)?;

    // Compute UTC range covering the month in that timezone.
    let start_local = tz
        .with_ymd_and_hms(year, month, 1, 0, 0, 0)
        .single()
        .context("invalid month start")?;

    let (next_year, next_month) = if month == 12 { (year + 1, 1) } else { (year, month + 1) };
    let end_local = tz
        .with_ymd_and_hms(next_year, next_month, 1, 0, 0, 0)
        .single()
        .context("invalid month end")?;

    let start_utc_ms = start_local.with_timezone(&Utc).timestamp_millis();
    let end_utc_ms = end_local.with_timezone(&Utc).timestamp_millis();

    let mut stmt = conn.prepare(
        "SELECT exit_time_utc, pnl_net
         FROM trades
         WHERE exit_time_utc >= ?1 AND exit_time_utc < ?2",
    )?;

    let rows = stmt.query_map(params![start_utc_ms, end_utc_ms], |row| {
        let exit_time_utc: i64 = row.get(0)?;
        let pnl_net: f64 = row.get(1)?;
        Ok((exit_time_utc, pnl_net))
    })?;

    let mut map: std::collections::HashMap<String, (i64, f64)> = std::collections::HashMap::new();
    for r in rows {
        let (exit_ms, pnl) = r?;
        let date = local_date_str(tz, exit_ms);
        let entry = map.entry(date).or_insert((0, 0.0));
        entry.0 += 1;
        entry.1 += pnl;
    }

    let mut out: Vec<DaySummary> = map
        .into_iter()
        .map(|(date_local, (trade_count, pnl_net_total))| DaySummary {
            date_local,
            trade_count,
            pnl_net_total,
        })
        .collect();

    out.sort_by(|a, b| a.date_local.cmp(&b.date_local));
    Ok(out)
}

pub fn day_trades(conn: &Connection, tz_name: &str, date_local: &str) -> anyhow::Result<Vec<TradeHighlight>> {
    let tz = parse_tz(tz_name)?;
    let (start_utc_ms, end_utc_ms) = utc_range_for_local_date(tz, date_local)?;

    let mut stmt = conn.prepare(
        "SELECT id, symbol, qty, pnl_net, notes, exit_time_utc
         FROM trades
         WHERE exit_time_utc >= ?1 AND exit_time_utc < ?2
         ORDER BY exit_time_utc ASC",
    )?;

    let rows = stmt.query_map(params![start_utc_ms, end_utc_ms], |row| {
        Ok(TradeHighlight {
            id: row.get(0)?,
            symbol: row.get(1)?,
            qty: row.get(2)?,
            pnl_net: row.get(3)?,
            notes: row.get(4)?,
            exit_time_utc: row.get(5)?,
        })
    })?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}
