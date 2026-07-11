use crate::db::Database;
use crate::errors::{AppError, Result};
use crate::models::tag::Tag;
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub async fn get_tags(db: State<'_, Database>) -> Result<Vec<Tag>> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, name, color, created_at FROM tags ORDER BY name"
    )?;

    let tags = stmt.query_map([], |row| {
        Ok(Tag {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;

    Ok(tags.filter_map(|t| t.ok()).collect())
}

#[tauri::command]
pub async fn create_tag(
    db: State<'_, Database>,
    name: String,
    color: Option<String>,
) -> Result<Tag> {
    let conn = db.conn.lock().unwrap();

    // Check if exists
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM tags WHERE name = ?)",
        params![name],
        |row| row.get(0),
    )?;

    if exists {
        return Err(AppError::AlreadyExists(name));
    }

    let tag = Tag::new(name, color);

    conn.execute(
        "INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)",
        params![tag.id, tag.name, tag.color, tag.created_at],
    )?;

    Ok(tag)
}

#[tauri::command]
pub async fn update_tag(
    db: State<'_, Database>,
    id: String,
    name: Option<String>,
    color: Option<String>,
) -> Result<Tag> {
    let conn = db.conn.lock().unwrap();

    if let Some(n) = &name {
        conn.execute("UPDATE tags SET name = ? WHERE id = ?", params![n, id])?;

        // Cascade update to workspaces
        let mut stmt = conn.prepare("SELECT id, tags FROM workspaces WHERE tags LIKE ?")?;
        let workspaces = stmt.query_map(params![format!("%{}%", n)], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        for workspace in workspaces.filter_map(|w| w.ok()) {
            let (ws_id, tags_str) = workspace;
            if let Ok(mut tags) = serde_json::from_str::<Vec<crate::models::workspace::Tag>>(&tags_str) {
                for tag in &mut tags {
                    if tag.name == *n {
                        tag.name = n.clone();
                        if let Some(c) = &color {
                            tag.color = c.clone();
                        }
                    }
                }
                let new_tags_str = serde_json::to_string(&tags).unwrap();
                conn.execute("UPDATE workspaces SET tags = ? WHERE id = ?", params![new_tags_str, ws_id])?;
            }
        }
    }

    if let Some(c) = &color {
        conn.execute("UPDATE tags SET color = ? WHERE id = ?", params![c, id])?;
    }

    // Return updated tag
    let tag = conn.query_row(
        "SELECT id, name, color, created_at FROM tags WHERE id = ?",
        params![id],
        |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
            })
        },
    )?;

    Ok(tag)
}

#[tauri::command]
pub async fn delete_tag(db: State<'_, Database>, id: String) -> Result<()> {
    let conn = db.conn.lock().unwrap();

    // Get tag name first
    let tag_name: String = conn.query_row(
        "SELECT name FROM tags WHERE id = ?",
        params![id],
        |row| row.get(0),
    )?;

    // Remove tag from all workspaces
    let mut stmt = conn.prepare("SELECT id, tags FROM workspaces WHERE tags LIKE ?")?;
    let workspaces = stmt.query_map(params![format!("%{}%", tag_name)], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    for workspace in workspaces.filter_map(|w| w.ok()) {
        let (ws_id, tags_str) = workspace;
        if let Ok(tags) = serde_json::from_str::<Vec<crate::models::workspace::Tag>>(&tags_str) {
            let filtered_tags: Vec<_> = tags.into_iter().filter(|t| t.name != tag_name).collect();
            let new_tags_str = serde_json::to_string(&filtered_tags).unwrap();
            conn.execute("UPDATE workspaces SET tags = ? WHERE id = ?", params![new_tags_str, ws_id])?;
        }
    }

    conn.execute("DELETE FROM tags WHERE id = ?", params![id])?;
    Ok(())
}
