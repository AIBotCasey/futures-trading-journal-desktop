use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub db_path: String,
    pub encrypted: bool,
    pub schema_version: u32,
}

impl AppConfig {
    pub fn default_at(db_path: PathBuf, encrypted: bool) -> Self {
        Self {
            db_path: db_path.to_string_lossy().to_string(),
            encrypted,
            schema_version: 1,
        }
    }
}

pub fn load_config(config_path: &PathBuf) -> anyhow::Result<Option<AppConfig>> {
    if !config_path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(config_path)?;
    let cfg: AppConfig = serde_json::from_str(&raw)?;
    Ok(Some(cfg))
}

pub fn save_config(config_path: &PathBuf, cfg: &AppConfig) -> anyhow::Result<()> {
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let raw = serde_json::to_string_pretty(cfg)?;
    fs::write(config_path, raw)?;
    Ok(())
}
