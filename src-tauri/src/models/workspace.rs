use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum WorkspaceStatus {
    Active,
    Archived,
    Deprecated,
}

impl ToString for WorkspaceStatus {
    fn to_string(&self) -> String {
        match self {
            WorkspaceStatus::Active => "active".to_string(),
            WorkspaceStatus::Archived => "archived".to_string(),
            WorkspaceStatus::Deprecated => "deprecated".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum ProjectType {
    Directory,
    Git,
    MultiGit,
}

impl ToString for ProjectType {
    fn to_string(&self) -> String {
        match self {
            ProjectType::Directory => "directory".to_string(),
            ProjectType::Git => "git".to_string(),
            ProjectType::MultiGit => "multi_git".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: String,
    pub status: String,
    pub project_type: String,
    pub tools: Vec<String>,
    pub tags: Vec<Tag>,
    pub source: String,
    pub open_count: i64,
    pub open_count_7d: i64,
    pub created_at: String,
    pub updated_at: String,
    pub last_opened_at: Option<String>,
}

pub fn detect_project_type(path: &str) -> String {
    let path = Path::new(path);
    let mut git_count = 0;

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() && entry.file_name() == ".git" {
                    return "git".to_string();
                }
                if file_type.is_dir() {
                    if let Ok(sub_entries) = fs::read_dir(entry.path()) {
                        for sub_entry in sub_entries.flatten() {
                            if sub_entry.file_name() == ".git" {
                                git_count += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    if git_count > 1 {
        "multi_git".to_string()
    } else if git_count == 1 {
        "git".to_string()
    } else {
        "directory".to_string()
    }
}

impl Workspace {
    pub fn new(name: String, path: String) -> Self {
        let now: DateTime<Utc> = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            path,
            description: String::new(),
            status: "active".to_string(),
            project_type: "directory".to_string(),
            tools: vec!["opencode".to_string()],
            tags: vec![],
            source: "manual".to_string(),
            open_count: 0,
            open_count_7d: 0,
            created_at: now.to_rfc3339(),
            updated_at: now.to_rfc3339(),
            last_opened_at: None,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceRequest {
    pub path: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub tools: Option<Vec<String>>,
    pub tags: Option<Vec<Tag>>,
    pub source: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub tools: Option<Vec<String>>,
    pub tags: Option<Vec<Tag>>,
}

#[derive(Debug, Deserialize)]
pub struct WorkspaceFilter {
    pub status: Option<String>,
    pub project_type: Option<String>,
    pub tool: Option<String>,
    pub tag: Option<String>,
    pub search: Option<String>,
    pub scan_dir_path: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceStats {
    pub total: i64,
    pub active: i64,
    pub archived: i64,
    pub deprecated: i64,
    pub git_projects: i64,
    pub multi_git_projects: i64,
    pub directories: i64,
}
