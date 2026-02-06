use crate::{config, db::DbState};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, serde::Serialize)]
pub struct AppStatus {
    pub db: crate::db::DbStatus,
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
