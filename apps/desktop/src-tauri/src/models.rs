use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub label: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub timezone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: String,
    pub market: String,
    pub symbol: String,
    pub side: String,
    pub qty: f64,
    pub entry_time_utc: i64,
    pub exit_time_utc: i64,
    pub timezone: String,
    pub session: String,
    pub pnl_amount: f64,
    pub pnl_includes_fees: i64,
    pub fees: f64,
    pub pnl_net: f64,
    pub pnl_gross: f64,
    pub notes: String,
    pub created_at_utc: i64,
    pub updated_at_utc: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeInput {
    pub market: String,
    pub symbol: String,
    pub side: String,
    pub qty: f64,
    pub entry_time_utc: i64,
    pub exit_time_utc: i64,
    pub timezone: String,
    pub session: String,
    pub pnl_amount: f64,
    pub pnl_includes_fees: bool,
    pub fees: f64,
    pub notes: String,
    pub rules_checked: Option<std::collections::HashMap<String, bool>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeWithRules {
    pub trade: Trade,
    pub rules: Vec<Rule>,
    pub checked: std::collections::HashMap<String, bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaySummary {
    pub date_local: String, // YYYY-MM-DD
    pub trade_count: i64,
    pub pnl_net_total: f64,
}
