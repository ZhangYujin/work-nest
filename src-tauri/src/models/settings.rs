use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanDirectory {
    pub id: String,
    pub path: String,
    pub name: String,
    pub depth: i64,
    pub enabled: bool,
    pub last_scanned_at: Option<String>,
}

impl ScanDirectory {
    pub fn new(path: String, name: Option<String>, depth: Option<i64>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            path,
            name: name.unwrap_or_default(),
            depth: depth.unwrap_or(3),
            enabled: true,
            last_scanned_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}
