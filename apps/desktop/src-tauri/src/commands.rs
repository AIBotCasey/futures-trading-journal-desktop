use crate::{config, db::DbState};
use crate::models::{Rule, Settings, Trade, TradeInput, TradeWithRules};

use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, serde::Serialize)]
pub struct AppStatus {
    pub db: crate::db::DbStatus,
}

#[tauri::command]
pub fn settings_get(state: tauri::State<'_, DbState>) -> Result<Settings, String> {
    state
        .with_conn(|conn| {
            let tz = crate::settings::get_timezone(conn)?;
            Ok(Settings { timezone: tz })
        })
        .map_err(|e| e.to_string())
}

#[derive(Debug, serde::Deserialize)]
pub struct SettingsUpdateRequest {
    pub timezone: String,
}

#[tauri::command]
pub fn settings_update(state: tauri::State<'_, DbState>, req: SettingsUpdateRequest) -> Result<Settings, String> {
    state
        .with_conn(|conn| {
            crate::settings::set_timezone(conn, &req.timezone)?;
            Ok(Settings {
                timezone: req.timezone,
            })
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rules_list(state: tauri::State<'_, DbState>) -> Result<Vec<Rule>, String> {
    state
        .with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT id, label, sort_order FROM rules ORDER BY sort_order ASC")?;
            let rows = stmt.query_map([], |row| {
                Ok(Rule {
                    id: row.get(0)?,
                    label: row.get(1)?,
                    sort_order: row.get(2)?,
                })
            })?;

            let mut out = Vec::new();
            for r in rows {
                out.push(r?);
            }
            Ok(out)
        })
        .map_err(|e| e.to_string())
}

#[derive(Debug, serde::Deserialize)]
pub struct RuleUpsertRequest {
    pub id: String,
    pub label: String,
    pub sort_order: i64,
}

#[tauri::command]
pub fn rules_upsert(state: tauri::State<'_, DbState>, req: RuleUpsertRequest) -> Result<(), String> {
    state
        .with_conn(|conn| {
            conn.execute(
                "INSERT INTO rules (id, label, sort_order) VALUES (?1, ?2, ?3)
                 ON CONFLICT(id) DO UPDATE SET label=excluded.label, sort_order=excluded.sort_order",
                rusqlite::params![req.id, req.label, req.sort_order],
            )?;
            Ok(())
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rules_delete(state: tauri::State<'_, DbState>, id: String) -> Result<(), String> {
    state
        .with_conn(|conn| {
            conn.execute("DELETE FROM rules WHERE id = ?1", rusqlite::params![id])?;
            Ok(())
        })
        .map_err(|e| e.to_string())
}

#[derive(Debug, serde::Deserialize)]
pub struct TradesListRequest {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[tauri::command]
pub fn trades_list(state: tauri::State<'_, DbState>, req: TradesListRequest) -> Result<Vec<Trade>, String> {
    let limit = req.limit.unwrap_or(200);
    let offset = req.offset.unwrap_or(0);
    state
        .with_conn(|conn| crate::trades::list_trades(conn, limit, offset))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn trades_get(state: tauri::State<'_, DbState>, id: String) -> Result<TradeWithRules, String> {
    state
        .with_conn(|conn| crate::trades::get_trade_with_rules(conn, &id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn trades_create(state: tauri::State<'_, DbState>, input: TradeInput) -> Result<Trade, String> {
    state
        .with_conn(|conn| crate::trades::create_trade(conn, input))
        .map_err(|e| e.to_string())
}

#[derive(Debug, serde::Deserialize)]
pub struct TradeUpdateRequest {
    pub id: String,
    pub input: TradeInput,
}

#[tauri::command]
pub fn trades_update(state: tauri::State<'_, DbState>, req: TradeUpdateRequest) -> Result<Trade, String> {
    state
        .with_conn(|conn| crate::trades::update_trade(conn, &req.id, req.input))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn trades_delete(state: tauri::State<'_, DbState>, id: String) -> Result<(), String> {
    state
        .with_conn(|conn| crate::trades::delete_trade(conn, &id))
        .map_err(|e| e.to_string())
}

fn config_path(app: &tauri::AppHandle) -> anyhow::Result<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| anyhow::anyhow!("failed to resolve app config dir: {e}"))?;
    Ok(dir.join("ftjournal.json"))
}

fn default_db_path(app: &tauri::AppHandle) -> anyhow::Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| anyhow::anyhow!("failed to resolve app data dir: {e}"))?;
    Ok(dir.join("ftjournal.db"))
}

#[tauri::command]
pub fn app_get_status(state: tauri::State<'_, DbState>) -> AppStatus {
    AppStatus { db: state.status() }
}

#[derive(Debug, serde::Deserialize)]
pub struct DbInitRequest {
    pub encrypted: bool,
    pub passphrase: Option<String>,
}

#[tauri::command]
pub fn db_init(app: tauri::AppHandle, state: tauri::State<'_, DbState>, req: DbInitRequest) -> Result<AppStatus, String> {
    let cfg_path = config_path(&app).map_err(|e| e.to_string())?;
    let db_path = default_db_path(&app).map_err(|e| e.to_string())?;

    state.configure(db_path.to_string_lossy().to_string(), req.encrypted);

    state
        .create_new(&db_path, req.encrypted, req.passphrase.as_deref())
        .map_err(|e| e.to_string())?;

    let cfg = config::AppConfig::default_at(db_path, req.encrypted);
    config::save_config(&cfg_path, &cfg).map_err(|e| e.to_string())?;

    Ok(AppStatus { db: state.status() })
}

#[derive(Debug, serde::Deserialize)]
pub struct DbUnlockRequest {
    pub passphrase: Option<String>,
}

#[tauri::command]
pub fn db_unlock(app: tauri::AppHandle, state: tauri::State<'_, DbState>, req: DbUnlockRequest) -> Result<AppStatus, String> {
    let cfg_path = config_path(&app).map_err(|e| e.to_string())?;
    let cfg = config::load_config(&cfg_path)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "App not initialized".to_string())?;

    let db_path = PathBuf::from(cfg.db_path.clone());
    state.configure(cfg.db_path, cfg.encrypted);

    state
        .open_existing(&db_path, cfg.encrypted, req.passphrase.as_deref())
        .map_err(|e| e.to_string())?;

    Ok(AppStatus { db: state.status() })
}

pub fn try_autoload(app: &tauri::AppHandle, state: &DbState) -> anyhow::Result<()> {
    let cfg_path = config_path(app)?;
    let Some(cfg) = config::load_config(&cfg_path)? else {
        return Ok(());
    };

    state.configure(cfg.db_path.clone(), cfg.encrypted);

    if !cfg.encrypted {
        let db_path = PathBuf::from(cfg.db_path);
        // Open unencrypted automatically.
        state.open_existing(&db_path, false, None)?;
    }

    Ok(())
}
