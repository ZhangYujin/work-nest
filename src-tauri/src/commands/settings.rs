use crate::db::Database;
use crate::errors::{AppError, Result};
use crate::models::settings::{ScanDirectory, Setting};
use rusqlite::params;
use tauri::State;
use tauri::Emitter;
use std::fs;
use std::path::Path;
use crate::models::workspace::{Workspace, detect_project_type};
use serde::Serialize;

#[tauri::command]
pub async fn get_setting(db: State<'_, Database>, key: String) -> Result<Option<String>> {
    let conn = db.conn.lock().unwrap();

    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?",
        params![key],
        |row| row.get(0),
    );

    match result {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

#[tauri::command]
pub async fn set_setting(db: State<'_, Database>, key: String, value: String) -> Result<()> {
    let conn = db.conn.lock().unwrap();

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        params![key, value],
    )?;

    Ok(())
}

#[tauri::command]
pub async fn get_all_settings(db: State<'_, Database>) -> Result<Vec<Setting>> {
    let conn = db.conn.lock().unwrap();

    let mut stmt = conn.prepare("SELECT key, value, updated_at FROM settings")?;
    let settings = stmt.query_map([], |row| {
        Ok(Setting {
            key: row.get(0)?,
            value: row.get(1)?,
            updated_at: row.get(2)?,
        })
    })?;

    Ok(settings.filter_map(|s| s.ok()).collect())
}

#[tauri::command]
pub async fn get_scan_directories(db: State<'_, Database>) -> Result<Vec<ScanDirectory>> {
    let conn = db.conn.lock().unwrap();

    let mut stmt = conn.prepare(
        "SELECT id, path, name, depth, enabled, last_scanned_at FROM scan_directories ORDER BY name, path"
    )?;

    let dirs = stmt.query_map([], |row| {
        Ok(ScanDirectory {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
            depth: row.get(3)?,
            enabled: row.get::<_, i64>(4)? == 1,
            last_scanned_at: row.get(5)?,
        })
    })?;

    Ok(dirs.filter_map(|d| d.ok()).collect())
}

#[tauri::command]
pub async fn add_scan_directory(
    db: State<'_, Database>,
    path: String,
    name: Option<String>,
    depth: Option<i64>,
) -> Result<ScanDirectory> {
    let conn = db.conn.lock().unwrap();

    // Check if already exists
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM scan_directories WHERE path = ?)",
        params![path],
        |row| row.get(0),
    )?;

    if exists {
        return Err(AppError::AlreadyExists(path));
    }

    let dir = ScanDirectory::new(path, name, depth);

    conn.execute(
        "INSERT INTO scan_directories (id, path, name, depth, enabled, last_scanned_at)
         VALUES (?, ?, ?, ?, 1, NULL)",
        params![dir.id, dir.path, dir.name, dir.depth],
    )?;

    Ok(dir)
}

#[tauri::command]
pub async fn remove_scan_directory(db: State<'_, Database>, id: String) -> Result<()> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM scan_directories WHERE id = ?", params![id])?;
    Ok(())
}

#[tauri::command]
pub async fn update_scan_directory_depth(db: State<'_, Database>, id: String, depth: i64) -> Result<()> {
    let conn = db.conn.lock().unwrap();
    conn.execute("UPDATE scan_directories SET depth = ? WHERE id = ?", params![depth, id])?;
    Ok(())
}

#[tauri::command]
pub async fn update_scan_directory_name(db: State<'_, Database>, id: String, name: String) -> Result<()> {
    let conn = db.conn.lock().unwrap();
    conn.execute("UPDATE scan_directories SET name = ? WHERE id = ?", params![name, id])?;
    Ok(())
}

fn scan_directory_recursive(
    path: &Path,
    current_depth: i64,
    max_depth: i64,
    results: &mut Vec<String>,
) {
    if current_depth > max_depth {
        return;
    }

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    let entry_path = entry.path();
                    let entry_path_str = entry_path.to_string_lossy().to_string();

                    // Check if this is a workspace
                    let workspace_json = entry_path.join("workspace.json");
                    let git_dir = entry_path.join(".git");

                    if workspace_json.exists() || git_dir.exists() {
                        results.push(entry_path_str.clone());
                    }

                    // Recurse
                    scan_directory_recursive(&entry_path, current_depth + 1, max_depth, results);
                }
            }
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ScanResult {
    pub found: i64,
    pub added: i64,
    pub removed: i64,
    pub unchanged: i64,
    pub added_names: Vec<String>,
    pub removed_names: Vec<String>,
}

#[tauri::command]
pub async fn scan_directory(
    db: State<'_, Database>,
    id: String,
    app_handle: tauri::AppHandle,
) -> Result<ScanResult> {
    // Read scan directory config (lock released after this block)
    let dir: ScanDirectory = {
        let conn = db.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, path, name, depth, enabled, last_scanned_at FROM scan_directories WHERE id = ?",
            params![id],
            |row| {
                Ok(ScanDirectory {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    name: row.get(2)?,
                    depth: row.get(3)?,
                    enabled: row.get::<_, i64>(4)? == 1,
                    last_scanned_at: row.get(5)?,
                })
            },
        )?
    };

    // Scan filesystem (no lock held)
    let mut found_paths = Vec::new();
    scan_directory_recursive(Path::new(&dir.path), 0, dir.depth, &mut found_paths);

    let mut added_count = 0;
    let mut removed_count = 0;
    let mut unchanged_count = 0;
    let mut added_names = Vec::new();
    let mut removed_names = Vec::new();

    // Emit progress
    let _ = app_handle.emit("scan-progress", serde_json::json!({
        "dir_id": id,
        "status": "started",
        "found": found_paths.len(),
    }));

    // Process found paths and insert into DB (lock held only during DB ops)
    {
        let conn = db.conn.lock().unwrap();

        // Get existing workspaces under this scan directory
        let existing_paths: Vec<(String, String)> = {
            let mut stmt = conn.prepare(
                "SELECT path, name FROM workspaces WHERE path LIKE ? AND deleted = 0"
            )?;
            let prefix = format!("{}%", dir.path);
            let rows = stmt.query_map(params![prefix], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })?;
            rows.filter_map(|r| r.ok()).collect()
        };

        // Check for removed workspaces (in DB but not on filesystem)
        for (existing_path, name) in existing_paths.iter() {
            let path_exists = found_paths.contains(existing_path) || Path::new(existing_path).exists();
            if !path_exists {
                // Mark as deleted
                conn.execute(
                    "UPDATE workspaces SET deleted = 1 WHERE path = ?",
                    params![existing_path],
                )?;
                removed_count += 1;
                removed_names.push(name.clone());
            }
        }

        // Check for new workspaces
        for (i, path) in found_paths.iter().enumerate() {
            // Check if already in database
            let exists: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM workspaces WHERE path = ? AND deleted = 0)",
                params![path],
                |row| row.get(0),
            )?;

            if !exists {
                // Check if marked as deleted in workspace.json
                let workspace_json_path = Path::new(path).join("workspace.json");
                let mut is_deleted = false;

                if workspace_json_path.exists() {
                    if let Ok(content) = fs::read_to_string(&workspace_json_path) {
                        if let Ok(json) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&content) {
                            if let Some(true) = json.get("deleted").and_then(|v| v.as_bool()) {
                                is_deleted = true;
                            }
                        }
                    }
                }

                if !is_deleted {
                    let name = Path::new(path)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("Untitled")
                        .to_string();

                    let mut workspace = Workspace::new(name.clone(), path.clone());
                    workspace.source = "scan".to_string();
                    workspace.project_type = detect_project_type(path);

                    let tools_json = serde_json::to_string(&workspace.tools).unwrap();
                    let tags_json = serde_json::to_string(&workspace.tags).unwrap();

                    conn.execute(
                        "INSERT INTO workspaces (id, name, path, description, status, project_type, tools, tags, source, open_count, open_count_7d, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)",
                        params![
                            workspace.id,
                            workspace.name,
                            workspace.path,
                            workspace.description,
                            workspace.status,
                            workspace.project_type,
                            tools_json,
                            tags_json,
                            workspace.source,
                            workspace.created_at,
                            workspace.updated_at,
                        ],
                    )?;

                    added_count += 1;
                    added_names.push(name);
                }
            } else {
                unchanged_count += 1;
                // 对于已存在的工作空间，更新项目类型
                let current_project_type: String = conn.query_row(
                    "SELECT project_type FROM workspaces WHERE path = ?",
                    params![path],
                    |row| row.get(0),
                )?;

                let new_project_type = detect_project_type(path);

                if current_project_type != new_project_type {
                    conn.execute(
                        "UPDATE workspaces SET project_type = ?, updated_at = datetime('now') WHERE path = ?",
                        params![new_project_type, path],
                    )?;
                }
            }

            // Emit progress
            let _ = app_handle.emit("scan-progress", serde_json::json!({
                "dir_id": id,
                "status": "scanning",
                "found": i + 1,
                "progress": (i + 1) as f64 / found_paths.len() as f64,
                "current_path": path,
            }));
        }

        // Update last scanned time
        conn.execute(
            "UPDATE scan_directories SET last_scanned_at = datetime('now') WHERE id = ?",
            params![id],
        )?;
    }

    let result = ScanResult {
        found: found_paths.len() as i64,
        added: added_count,
        removed: removed_count,
        unchanged: unchanged_count,
        added_names,
        removed_names,
    };

    let _ = app_handle.emit("scan-progress", serde_json::json!({
        "dir_id": id,
        "status": "completed",
        "found": result.found,
        "added": result.added,
        "removed": result.removed,
    }));

    Ok(result)
}
