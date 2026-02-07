use anyhow::Context;
use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;
use rusqlite::Connection;
use std::path::Path;

use crate::models::TradeInput;

#[derive(Debug, serde::Deserialize)]
struct CsvRow {
    // Required
    symbol: String,
    side: String,
    qty: f64,

    // Either provide *_time_utc_ms OR *_local in a parseable format.
    entry_time_utc_ms: Option<i64>,
    exit_time_utc_ms: Option<i64>,
    entry_local: Option<String>,
    exit_local: Option<String>,

    // Optional
    market: Option<String>,
    session: Option<String>,
    pnl_amount: Option<f64>,
    fees: Option<f64>,
    pnl_includes_fees: Option<bool>,
    notes: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct CsvImportResult {
    pub created: i64,
    pub skipped: i64,
    pub errors: Vec<String>,
}

fn parse_local_dt(tz: &Tz, s: &str) -> anyhow::Result<i64> {
    // Accept a few common formats.
    // 1) RFC3339 / ISO with offset -> parse as DateTime
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Ok(dt.with_timezone(&Utc).timestamp_millis());
    }

    // 2) "YYYY-MM-DDTHH:MM" (from HTML datetime-local)
    if let Ok(ndt) = NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M") {
        let local = tz
            .from_local_datetime(&ndt)
            .single()
            .context("ambiguous local time")?;
        return Ok(local.with_timezone(&Utc).timestamp_millis());
    }

    // 3) "YYYY-MM-DD HH:MM:SS"
    if let Ok(ndt) = NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S") {
        let local = tz
            .from_local_datetime(&ndt)
            .single()
            .context("ambiguous local time")?;
        return Ok(local.with_timezone(&Utc).timestamp_millis());
    }

    // 4) "YYYY-MM-DD HH:MM"
    if let Ok(ndt) = NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M") {
        let local = tz
            .from_local_datetime(&ndt)
            .single()
            .context("ambiguous local time")?;
        return Ok(local.with_timezone(&Utc).timestamp_millis());
    }

    anyhow::bail!("unsupported datetime format: {s}")
}

fn row_to_trade_input(row: &CsvRow, tz: &str) -> anyhow::Result<TradeInput> {
    let tz: Tz = tz.parse().context("invalid timezone")?;

    let entry_ms = if let Some(ms) = row.entry_time_utc_ms {
        ms
    } else if let Some(s) = row.entry_local.as_deref() {
        parse_local_dt(&tz, s)?
    } else {
        anyhow::bail!("missing entry_time_utc_ms or entry_local")
    };

    let exit_ms = if let Some(ms) = row.exit_time_utc_ms {
        ms
    } else if let Some(s) = row.exit_local.as_deref() {
        parse_local_dt(&tz, s)?
    } else {
        anyhow::bail!("missing exit_time_utc_ms or exit_local")
    };

    Ok(TradeInput {
        market: row.market.clone().unwrap_or_else(|| "futures".to_string()),
        symbol: row.symbol.trim().to_string(),
        side: row.side.trim().to_string(),
        qty: row.qty,
        entry_time_utc: entry_ms,
        exit_time_utc: exit_ms,
        timezone: tz.to_string(),
        session: row.session.clone().unwrap_or_else(|| "other".to_string()),
        pnl_amount: row.pnl_amount.unwrap_or(0.0),
        pnl_includes_fees: row.pnl_includes_fees.unwrap_or(true),
        fees: row.fees.unwrap_or(0.0),
        notes: row.notes.clone().unwrap_or_default(),
        rules_checked: None,
    })
}

pub fn import_generic_csv(conn: &Connection, csv_path: &Path, tz: &str) -> anyhow::Result<CsvImportResult> {
    let file = std::fs::File::open(csv_path).with_context(|| format!("open csv {}", csv_path.display()))?;
    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(file);

    let mut created = 0i64;
    let mut skipped = 0i64;
    let mut errors: Vec<String> = Vec::new();

    for (i, rec) in rdr.deserialize::<CsvRow>().enumerate() {
        let line = i + 2; // header is line 1
        match rec {
            Ok(row) => {
                if row.symbol.trim().is_empty() {
                    skipped += 1;
                    continue;
                }
                match row_to_trade_input(&row, tz) {
                    Ok(input) => {
                        if let Err(e) = crate::trades::create_trade(conn, input) {
                            errors.push(format!("line {line}: failed to create trade: {e}"));
                        } else {
                            created += 1;
                        }
                    }
                    Err(e) => errors.push(format!("line {line}: {e}")),
                }
            }
            Err(e) => errors.push(format!("line {line}: {e}")),
        }
    }

    Ok(CsvImportResult {
        created,
        skipped,
        errors,
    })
}
