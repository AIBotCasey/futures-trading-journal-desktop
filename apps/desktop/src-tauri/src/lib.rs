mod commands;
mod config;
mod db;
mod db_seed;
mod models;
mod settings;
mod trades;
mod journal;
mod backup;

use crate::db::DbState;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(DbState::default())
        .setup(|app| {
            let handle = app.handle();
            let state: tauri::State<'_, DbState> = app.state();
            if let Err(err) = commands::try_autoload(&handle, state.inner()) {
                eprintln!("FTJournal autoload failed: {err:?}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::app_get_status,
            commands::db_init,
            commands::db_unlock,
            commands::settings_get,
            commands::settings_update,
            commands::rules_list,
            commands::rules_upsert,
            commands::rules_delete,
            commands::trades_list,
            commands::trades_get,
            commands::trades_create,
            commands::trades_update,
            commands::trades_delete,
            commands::journal_month_summary,
            commands::journal_day_trades,
            commands::backup_export,
            commands::backup_import
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
