use anyhow::Context;
use std::path::{Path, PathBuf};

use crate::{config, db::DbState};
use tauri::Manager;

fn config_path(app: &tauri::AppHandle) -> anyhow::Result<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| anyhow::anyhow!("failed to resolve app config dir: {e}"))?;
    Ok(dir.join("ftjournal.json"))
}

pub fn export_db(app: &tauri::AppHandle, state: &DbState, dest_path: &Path) -> anyhow::Result<()> {
    let cfg_path = config_path(app)?;
    let cfg = config::load_config(&cfg_path)?.context("App not initialized")?;
    let src = PathBuf::from(cfg.db_path);

    // Close DB before copying to avoid WAL weirdness.
    state.close();

    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent).with_context(|| format!("create dir {}", parent.display()))?;
    }

    std::fs::copy(&src, dest_path).with_context(|| {
        format!("copy db from {} to {}", src.display(), dest_path.display())
    })?;

    // Re-open automatically if unencrypted.
    if !cfg.encrypted {
        state.configure(src.to_string_lossy().to_string(), false);
        state.open_existing(&src, false, None)?;
    } else {
        state.configure(src.to_string_lossy().to_string(), true);
    }

    Ok(())
}

pub fn import_db(app: &tauri::AppHandle, state: &DbState, src_path: &Path) -> anyhow::Result<()> {
    let cfg_path = config_path(app)?;
    let cfg = config::load_config(&cfg_path)?.context("App not initialized")?;
    let dest = PathBuf::from(cfg.db_path);

    // Close DB before replacing.
    state.close();

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).with_context(|| format!("create dir {}", parent.display()))?;
    }

    std::fs::copy(src_path, &dest).with_context(|| {
        format!("copy db from {} to {}", src_path.display(), dest.display())
    })?;

    // Re-open automatically if unencrypted. Encrypted will require unlock.
    if !cfg.encrypted {
        state.configure(dest.to_string_lossy().to_string(), false);
        state.open_existing(&dest, false, None)?;
    } else {
        state.configure(dest.to_string_lossy().to_string(), true);
    }

    Ok(())
}
