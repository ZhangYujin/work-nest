mod commands;
mod db;
mod errors;
mod models;

use db::Database;
use tauri::Manager;

pub fn init_db(app_handle: &tauri::AppHandle) -> Result<Database, Box<dyn std::error::Error>> {
    let app_dir = app_handle.path().app_data_dir()?;
    std::fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("workspace-manager.db");
    let db = Database::new(db_path)?;
    db.init_schema()?;

    Ok(db)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(unexpected_cfgs)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let db = init_db(app.handle())?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Workspace commands
            commands::workspace::get_workspaces,
            commands::workspace::get_workspace,
            commands::workspace::create_workspace,
            commands::workspace::restore_workspace,
            commands::workspace::update_workspace,
            commands::workspace::delete_workspace,
            commands::workspace::get_workspace_stats,
            commands::workspace::open_workspace,
            commands::workspace::read_workspace_json,
            commands::workspace::write_workspace_json,
            commands::workspace::check_tools_installed,
            commands::workspace::get_tool_usage_stats,
            // Tag commands
            commands::tag::get_tags,
            commands::tag::create_tag,
            commands::tag::update_tag,
            commands::tag::delete_tag,
            // Settings commands
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            commands::settings::get_scan_directories,
            commands::settings::add_scan_directory,
            commands::settings::remove_scan_directory,
            commands::settings::update_scan_directory_depth,
            commands::settings::update_scan_directory_name,
            commands::settings::scan_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
