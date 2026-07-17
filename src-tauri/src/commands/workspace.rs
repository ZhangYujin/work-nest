use crate::db::Database;
use crate::errors::{AppError, Result};
use crate::models::workspace::*;
use rusqlite::params;
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::State;
use chrono::{DateTime, Utc, Duration};
use std::collections::HashMap;

fn read_workspace_json_file(path: &str) -> Option<Value> {
    let workspace_json = Path::new(path).join("workspace.json");
    if workspace_json.exists() {
        if let Ok(content) = fs::read_to_string(workspace_json) {
            if let Ok(json) = serde_json::from_str(&content) {
                return Some(json);
            }
        }
    }
    None
}

#[tauri::command]
pub async fn get_workspaces(
    db: State<'_, Database>,
    filter: Option<WorkspaceFilter>,
) -> Result<Vec<Workspace>> {
    let conn = db.conn.lock().unwrap();
    let mut sql = "SELECT id, name, path, description, status, project_type, tools, tags, source, open_count, open_count_7d, created_at, updated_at, last_opened_at FROM workspaces WHERE deleted = 0".to_string();
    let mut params_vec: Vec<String> = Vec::new();
    let mut has_search = false;
    let mut search_term: Option<String> = None;

    if let Some(f) = &filter {
        if let Some(status) = &f.status {
            sql.push_str(" AND status = ?");
            params_vec.push(status.clone());
        }
        if let Some(project_type) = &f.project_type {
            sql.push_str(" AND project_type = ?");
            params_vec.push(project_type.clone());
        }
        if let Some(search) = &f.search {
            has_search = true;
            search_term = Some(search.clone());
            sql.push_str(" AND (name LIKE ? OR path LIKE ?)");
            params_vec.push(format!("%{}%", search));
            params_vec.push(format!("%{}%", search));
        }
        if let Some(tool) = &f.tool {
            sql.push_str(" AND tools LIKE ?");
            params_vec.push(format!("%{}%", tool));
        }
        if let Some(tag) = &f.tag {
            sql.push_str(" AND tags LIKE ?");
            params_vec.push(format!("%{}%", tag));
        }
        if let Some(scan_dir_path) = &f.scan_dir_path {
            sql.push_str(" AND path LIKE ?");
            params_vec.push(format!("{}%", scan_dir_path));
        }

        if has_search {
            // 有搜索时，先按名称匹配优先，再按路径匹配，然后按用户选择的排序
            let sort_by = f.sort_by.as_deref().unwrap_or("name");
            let sort_order = f.sort_order.as_deref().unwrap_or("asc");
            sql.push_str(&format!(
                " ORDER BY 
                    CASE WHEN name LIKE ? THEN 0 ELSE 1 END, 
                    {} {}", 
                sort_by, sort_order
            ));
            // 添加用于排序的参数
            if let Some(search) = search_term {
                params_vec.push(format!("%{}%", search));
            }
        } else {
            // 没有搜索时，默认先按名称，再按最后打开时间
            let sort_by = f.sort_by.as_deref().unwrap_or("name");
            let sort_order = f.sort_order.as_deref().unwrap_or("asc");
            
            if sort_by == "name" {
                // 当按名称排序时，添加 last_opened_at 作为次要排序
                sql.push_str(&format!(" ORDER BY name {}, last_opened_at DESC", sort_order));
            } else {
                sql.push_str(&format!(" ORDER BY {} {}", sort_by, sort_order));
            }
        }
    } else {
        // 没有筛选器时，默认先按名称升序，再按最后打开时间降序
        sql.push_str(" ORDER BY name ASC, last_opened_at DESC");
    }

    let mut stmt = conn.prepare(&sql)?;
    let workspaces = stmt.query_map(rusqlite::params_from_iter(params_vec), |row| {
        let tools_str: String = row.get(6)?;
        let tags_str: String = row.get(7)?;

        Ok(Workspace {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            description: row.get(3)?,
            status: row.get(4)?,
            project_type: row.get(5)?,
            tools: serde_json::from_str(&tools_str).unwrap_or_default(),
            tags: serde_json::from_str(&tags_str).unwrap_or_default(),
            source: row.get(8)?,
            open_count: row.get(9)?,
            open_count_7d: row.get(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
            last_opened_at: row.get(13)?,
        })
    })?;

    Ok(workspaces.filter_map(|w| w.ok()).collect())
}

#[tauri::command]
pub async fn get_workspace(db: State<'_, Database>, id: String) -> Result<Workspace> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, name, path, description, status, project_type, tools, tags, source, open_count, open_count_7d, created_at, updated_at, last_opened_at
         FROM workspaces WHERE id = ?"
    )?;

    let workspace = stmt.query_row(params![id], |row| {
        let tools_str: String = row.get(6)?;
        let tags_str: String = row.get(7)?;

        Ok(Workspace {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            description: row.get(3)?,
            status: row.get(4)?,
            project_type: row.get(5)?,
            tools: serde_json::from_str(&tools_str).unwrap_or_default(),
            tags: serde_json::from_str(&tags_str).unwrap_or_default(),
            source: row.get(8)?,
            open_count: row.get(9)?,
            open_count_7d: row.get(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
            last_opened_at: row.get(13)?,
        })
    })?;

    Ok(workspace)
}

#[tauri::command]
pub async fn create_workspace(
    db: State<'_, Database>,
    request: CreateWorkspaceRequest,
) -> Result<Workspace> {
    let conn = db.conn.lock().unwrap();

    // Case 1: Already in list (deleted = 0) -> error "already added"
    let active_exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM workspaces WHERE path = ? AND deleted = 0)",
        params![request.path],
        |row| row.get(0),
    )?;

    if active_exists {
        return Err(AppError::AlreadyExists(request.path));
    }

    // Case 2: Was deleted (deleted = 1) -> error "was deleted", let frontend confirm
    let was_deleted: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM workspaces WHERE path = ? AND deleted = 1)",
        params![request.path],
        |row| row.get(0),
    )?;

    if was_deleted {
        return Err(AppError::WasDeleted(request.path));
    }

    let name = request.name.unwrap_or_else(|| {
        Path::new(&request.path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Untitled")
            .to_string()
    });

    let mut workspace = Workspace::new(name, request.path.clone());
    workspace.description = request.description.unwrap_or_default();
    workspace.tools = request.tools.unwrap_or_else(|| vec!["claude".to_string()]);
    workspace.tags = request.tags.unwrap_or_default();
    workspace.source = request.source.unwrap_or_else(|| "manual".to_string());
    workspace.project_type = crate::models::workspace::detect_project_type(&request.path);

    // Try to read workspace.json
    if let Some(json) = read_workspace_json_file(&request.path) {
        if let Some(n) = json.get("name").and_then(|v| v.as_str()) {
            workspace.name = n.to_string();
        }
        if let Some(d) = json.get("description").and_then(|v| v.as_str()) {
            workspace.description = d.to_string();
        }
        if let Some(s) = json.get("status").and_then(|v| v.as_str()) {
            workspace.status = s.to_string();
        }
        if let Some(t) = json.get("tools").and_then(|v| v.as_array()) {
            workspace.tools = t.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect();
        }
        if let Some(t) = json.get("tags").and_then(|v| v.as_array()) {
            workspace.tags = t.iter()
                .filter_map(|v| {
                    let name = v.get("name")?.as_str()?.to_string();
                    let color = v.get("color")?.as_str()?.to_string();
                    Some(Tag { name, color })
                })
                .collect();
        }
    }

    let tools_json = serde_json::to_string(&workspace.tools)?;
    let tags_json = serde_json::to_string(&workspace.tags)?;

    // Write workspace.json to the workspace directory first
    let workspace_json_path = Path::new(&workspace.path).join("workspace.json");
    let workspace_json_content = serde_json::json!({
        "name": workspace.name,
        "description": workspace.description,
        "status": workspace.status,
        "tools": workspace.tools,
        "tags": workspace.tags,
    });
    fs::write(
        &workspace_json_path,
        serde_json::to_string_pretty(&workspace_json_content).unwrap_or_else(|_| "{}".to_string()),
    )?;

    // Then insert into database
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

    Ok(workspace)
}

#[tauri::command]
pub async fn restore_workspace(
    db: State<'_, Database>,
    request: CreateWorkspaceRequest,
) -> Result<Workspace> {
    let conn = db.conn.lock().unwrap();

    // Find the soft-deleted workspace by path
    let row_id: String = conn.query_row(
        "SELECT id FROM workspaces WHERE path = ? AND deleted = 1",
        params![request.path],
        |row| row.get(0),
    )?;

    // Update workspace.json: remove deleted flag, write latest info
    let name = request.name.unwrap_or_else(|| {
        Path::new(&request.path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Untitled")
            .to_string()
    });

    let mut workspace = Workspace::new(name, request.path.clone());
    workspace.description = request.description.unwrap_or_default();
    workspace.tools = request.tools.unwrap_or_else(|| vec!["claude".to_string()]);
    workspace.tags = request.tags.unwrap_or_default();
    workspace.source = request.source.unwrap_or_else(|| "manual".to_string());
    workspace.project_type = crate::models::workspace::detect_project_type(&request.path);
    workspace.id = row_id.clone();

    // Try to read workspace.json (excluding deleted flag)
    if let Some(json) = read_workspace_json_file(&request.path) {
        if let Some(n) = json.get("name").and_then(|v| v.as_str()) {
            workspace.name = n.to_string();
        }
        if let Some(d) = json.get("description").and_then(|v| v.as_str()) {
            workspace.description = d.to_string();
        }
        if let Some(s) = json.get("status").and_then(|v| v.as_str()) {
            workspace.status = s.to_string();
        }
        if let Some(t) = json.get("tools").and_then(|v| v.as_array()) {
            workspace.tools = t.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect();
        }
        if let Some(t) = json.get("tags").and_then(|v| v.as_array()) {
            workspace.tags = t.iter()
                .filter_map(|v| {
                    let name = v.get("name")?.as_str()?.to_string();
                    let color = v.get("color")?.as_str()?.to_string();
                    Some(Tag { name, color })
                })
                .collect();
        }
    }

    let tools_json = serde_json::to_string(&workspace.tools)?;
    let tags_json = serde_json::to_string(&workspace.tags)?;
    let now: DateTime<Utc> = Utc::now();
    let now_str = now.to_rfc3339();

    // Write workspace.json (remove deleted flag)
    let workspace_json_path = Path::new(&workspace.path).join("workspace.json");
    let workspace_json_content = serde_json::json!({
        "name": workspace.name,
        "description": workspace.description,
        "status": workspace.status,
        "tools": workspace.tools,
        "tags": workspace.tags,
    });
    fs::write(
        &workspace_json_path,
        serde_json::to_string_pretty(&workspace_json_content).unwrap_or_else(|_| "{}".to_string()),
    )?;

    // Restore in database: un-delete and update fields
    conn.execute(
        "UPDATE workspaces SET deleted = 0, name = ?, description = ?, status = ?, project_type = ?, tools = ?, tags = ?, source = ?, updated_at = ? WHERE id = ?",
        params![
            workspace.name,
            workspace.description,
            workspace.status,
            workspace.project_type,
            tools_json,
            tags_json,
            workspace.source,
            now_str,
            row_id,
        ],
    )?;

    Ok(workspace)
}

#[tauri::command]
pub async fn update_workspace(
    db: State<'_, Database>,
    id: String,
    request: UpdateWorkspaceRequest,
) -> Result<Workspace> {
    {
        let conn = db.conn.lock().unwrap();
        let now: DateTime<Utc> = Utc::now();
        let now_str = now.to_rfc3339();

        if let Some(name) = &request.name {
            conn.execute("UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?", params![name, now_str, id])?;
        }
        if let Some(description) = &request.description {
            conn.execute("UPDATE workspaces SET description = ?, updated_at = ? WHERE id = ?", params![description, now_str, id])?;
        }
        if let Some(status) = &request.status {
            conn.execute("UPDATE workspaces SET status = ?, updated_at = ? WHERE id = ?", params![status, now_str, id])?;
        }
        if let Some(tools) = &request.tools {
            let tools_json = serde_json::to_string(tools)?;
            conn.execute("UPDATE workspaces SET tools = ?, updated_at = ? WHERE id = ?", params![tools_json, now_str, id])?;
        }
        if let Some(tags) = &request.tags {
            let tags_json = serde_json::to_string(tags)?;
            conn.execute("UPDATE workspaces SET tags = ?, updated_at = ? WHERE id = ?", params![tags_json, now_str, id])?;
        }
    }

    // Return updated workspace
    get_workspace(db, id).await
}

#[tauri::command]
pub async fn delete_workspace(db: State<'_, Database>, id: String) -> Result<()> {
    // Get workspace path first (with lock released during await)
    let workspace_path = {
        if let Ok(workspace) = get_workspace(db.clone(), id.clone()).await {
            Some(workspace.path)
        } else {
            None
        }
    };

    // Mark as deleted in workspace.json if exists
    if let Some(path) = workspace_path {
        let workspace_json_path = Path::new(&path).join("workspace.json");
        if workspace_json_path.exists() {
            if let Ok(mut json) = fs::read_to_string(&workspace_json_path)
                .and_then(|c| serde_json::from_str::<serde_json::Map<String, Value>>(&c).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e)))
            {
                json.insert("deleted".to_string(), Value::Bool(true));
                let _ = fs::write(&workspace_json_path, serde_json::to_string_pretty(&json).unwrap());
            }
        } else {
            // Create workspace.json with deleted flag if it doesn't exist
            let mut json = serde_json::Map::new();
            json.insert("deleted".to_string(), Value::Bool(true));
            let _ = fs::write(&workspace_json_path, serde_json::to_string_pretty(&json).unwrap());
        }
    }

    // Soft delete: mark as deleted in database instead of hard delete
    let conn = db.conn.lock().unwrap();
    conn.execute("UPDATE workspaces SET deleted = 1 WHERE id = ?", params![id])?;
    Ok(())
}

#[tauri::command]
pub async fn get_workspace_stats(db: State<'_, Database>) -> Result<WorkspaceStats> {
    let conn = db.conn.lock().unwrap();

    let total: i64 = conn.query_row("SELECT COUNT(*) FROM workspaces", [], |row| row.get(0))?;
    let active: i64 = conn.query_row("SELECT COUNT(*) FROM workspaces WHERE status = 'active'", [], |row| row.get(0))?;
    let archived: i64 = conn.query_row("SELECT COUNT(*) FROM workspaces WHERE status = 'archived'", [], |row| row.get(0))?;
    let deprecated: i64 = conn.query_row("SELECT COUNT(*) FROM workspaces WHERE status = 'deprecated'", [], |row| row.get(0))?;
    let git_projects: i64 = conn.query_row("SELECT COUNT(*) FROM workspaces WHERE project_type = 'git'", [], |row| row.get(0))?;
    let multi_git_projects: i64 = conn.query_row("SELECT COUNT(*) FROM workspaces WHERE project_type = 'multi_git'", [], |row| row.get(0))?;
    let directories: i64 = conn.query_row("SELECT COUNT(*) FROM workspaces WHERE project_type = 'directory'", [], |row| row.get(0))?;

    Ok(WorkspaceStats {
        total,
        active,
        archived,
        deprecated,
        git_projects,
        multi_git_projects,
        directories,
    })
}

#[tauri::command]
pub async fn open_workspace(
    db: State<'_, Database>,
    id: String,
    tool: String,
    _tool_path: Option<String>,
) -> Result<String> {
    // Get workspace first (with lock released during await)
    let workspace = get_workspace(db.clone(), id.clone()).await?;
    let workspace_path = workspace.path.clone();

    {
        let conn = db.conn.lock().unwrap();

        // Update open count and log
        let now: DateTime<Utc> = Utc::now();
        let now_str = now.to_rfc3339();

        conn.execute(
            "UPDATE workspaces SET open_count = open_count + 1, last_opened_at = ?, updated_at = ? WHERE id = ?",
            params![now_str, now_str, id],
        )?;

        conn.execute(
            "INSERT INTO workspace_open_logs (workspace_id, tool_name, opened_at) VALUES (?, ?, ?)",
            params![id, tool, now_str],
        )?;

        // Update 7d count
        let seven_days_ago = now - Duration::days(7);
        let seven_days_ago_str = seven_days_ago.to_rfc3339();

        conn.execute(
            "UPDATE workspaces SET open_count_7d = (
                SELECT COUNT(*) FROM workspace_open_logs
                WHERE workspace_id = ? AND opened_at >= ?
            ) WHERE id = ?",
            params![id, seven_days_ago_str, id],
        )?;
    }

    // Get all tool path settings
    let settings = {
        let conn = db.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT key, value FROM settings WHERE key LIKE 'tool_path_%' OR key = 'terminal_app'").unwrap();
        let settings_iter = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }).unwrap();
        settings_iter.filter_map(|s| s.ok()).collect::<std::collections::HashMap<_, _>>()
    };

    let terminal_app = settings.get("terminal_app").map(|s| s.as_str()).unwrap_or("terminal");

    // Get user home directory for dynamic path resolution
    let home_dir = std::env::var("HOME").unwrap_or_else(|_| "/Users/zhangyujin".to_string());

    // Get user configured tool paths
    // If configured path is a .app directory, convert to the actual executable inside
    fn get_app_executable(app_path: &str, executable_suffix: &str) -> String {
        if app_path.ends_with(".app") {
            format!("{}{}", app_path, executable_suffix)
        } else {
            app_path.to_string()
        }
    }

    let claude_path = settings.get("tool_path_claude").map(|s| s.as_str()).unwrap_or("/usr/local/bin/claude").to_string();
    let default_opencode_path = format!("{}/.npm-global/bin/opencode", home_dir);
    let opencode_path = settings.get("tool_path_opencode").map(|s| s.as_str()).unwrap_or(&default_opencode_path).to_string();
    let vscode_path = get_app_executable(
        settings.get("tool_path_vscode").map(|s| s.as_str()).unwrap_or("/Applications/Visual Studio Code.app"),
        "/Contents/Resources/app/bin/code"
    );
    let idea_path = get_app_executable(
        settings.get("tool_path_idea").map(|s| s.as_str()).unwrap_or("/Applications/IntelliJ IDEA CE.app"),
        "/Contents/MacOS/idea"
    );

    match tool.as_str() {
        "claude" | "opencode" | "terminal" | "iterm2" => {
            let cmd = match tool.as_str() {
                "claude" => format!("'{}' .", claude_path.replace("'", "'\\''")),
                "opencode" => format!("'{}' .", opencode_path.replace("'", "'\\''")),
                _ => "".to_string(),
            };

            if terminal_app == "iterm2" {
                // iTerm2 AppleScript
                let script = format!(
                    r#"tell application "iTerm"
                        activate
                        if not (exists window 1) then
                            create window with default profile
                        else
                            tell current window
                                create tab with default profile
                            end tell
                        end if
                        tell current session of current window
                            write text "cd '{path}'{cmd}"
                        end tell
                    end tell"#,
                    path = workspace_path.replace("'", "'\\''"),
                    cmd = if cmd.is_empty() { "".to_string() } else { format!(" && {}", cmd) }
                );
                let _ = Command::new("osascript").args(["-e", &script]).spawn();
            } else {
                // Terminal AppleScript
                // Note: `do script` must come before `activate`. When Terminal.app is not
                // running, `activate` launches it and opens a startup window; `do script`
                // then opens another window to run the command — resulting in two windows.
                // Putting `do script` first lets it create the single window (launching the
                // app if needed), and `activate` only brings it to the front.
                let script = format!(
                    r#"tell application "Terminal"
                        do script "cd '{path}'{cmd}"
                        activate
                    end tell"#,
                    path = workspace_path.replace("'", "'\\''"),
                    cmd = if cmd.is_empty() { "".to_string() } else { format!(" && {}", cmd) }
                );
                let _ = Command::new("osascript").args(["-e", &script]).spawn();
            }
        }
        "vscode" | "idea" => {
            let executable = match tool.as_str() {
                "vscode" => vscode_path,
                "idea" => idea_path,
                _ => unreachable!(),
            };
            let _ = Command::new(executable).arg(&workspace_path).spawn();
        }
        _ => return Err(AppError::ToolNotFound(tool)),
    }

    Ok(workspace_path)
}

#[tauri::command]
pub async fn read_workspace_json(db: State<'_, Database>, id: String) -> Result<String> {
    let workspace = get_workspace(db.clone(), id).await?;
    let workspace_json_path = Path::new(&workspace.path).join("workspace.json");

    if workspace_json_path.exists() {
        let content = fs::read_to_string(workspace_json_path)?;
        Ok(content)
    } else {
        // Create default workspace.json
        let default_json = serde_json::json!({
            "name": workspace.name,
            "description": workspace.description,
            "status": workspace.status,
            "tools": workspace.tools,
            "tags": workspace.tags,
        });
        Ok(serde_json::to_string_pretty(&default_json).unwrap())
    }
}

#[tauri::command]
pub async fn write_workspace_json(db: State<'_, Database>, id: String, content: String) -> Result<()> {
    let workspace = get_workspace(db.clone(), id).await?;
    let workspace_json_path = Path::new(&workspace.path).join("workspace.json");

    fs::write(workspace_json_path, content)?;
    Ok(())
}

#[tauri::command]
pub async fn check_tools_installed(db: State<'_, Database>) -> Result<HashMap<String, bool>> {
    let mut result = HashMap::new();

    // Get user home directory for dynamic path resolution
    let home_dir = std::env::var("HOME").unwrap_or_else(|_| "/Users/zhangyujin".to_string());

    // Default paths for each tool
    // For .app bundles, we check the .app directory itself, not the deep binary path
    let default_paths = [
        ("claude", "/usr/local/bin/claude".to_string()),
        ("vscode", "/Applications/Visual Studio Code.app".to_string()),
        ("idea", "/Applications/IntelliJ IDEA CE.app".to_string()),
        ("opencode", format!("{}/.npm-global/bin/opencode", home_dir)),
        ("terminal", "/Applications/Terminal.app".to_string()),
        ("iterm2", "/Applications/iTerm.app".to_string()),
    ];

    // Additional common paths to check for IDEA (for better compatibility)
    let idea_additional_paths = [
        "/Applications/IntelliJ IDEA.app",
        "/Applications/IntelliJ IDEA Ultimate.app",
        "/Applications/IntelliJ IDEA Community Edition.app",
    ];

    let conn = db.conn.lock().unwrap();

    for (name, default_path) in default_paths.iter() {
        let setting_key = format!("tool_path_{}", name);

        // Try to get user-customized path from settings
        let user_path: Option<String> = conn.query_row(
            "SELECT value FROM settings WHERE key = ?",
            params![setting_key],
            |row| row.get(0),
        ).ok();

        let path_to_check = user_path.as_deref().unwrap_or(default_path);
        let path_obj = Path::new(path_to_check);

        // For .app bundles, just check the .app directory exists
        // For other tools, check the exact file exists
        let mut exists = if path_to_check.ends_with(".app") {
            path_obj.is_dir()
        } else {
            path_obj.exists()
        };

        // For IDEA, if user path doesn't exist, also check common alternative paths
        if !exists && *name == "idea" && user_path.is_none() {
            for alt_path in idea_additional_paths.iter() {
                if Path::new(alt_path).is_dir() {
                    exists = true;
                    break;
                }
            }
        }

        result.insert(name.to_string(), exists);
    }

    Ok(result)
}

#[tauri::command]
pub async fn get_tool_usage_stats(db: State<'_, Database>) -> Result<Vec<(String, i64)>> {
    let conn = db.conn.lock().unwrap();

    let mut stmt = conn.prepare(
        "SELECT tool_name, COUNT(*) as count
         FROM workspace_open_logs
         GROUP BY tool_name
         ORDER BY count DESC",
    )?;

    let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}
