use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: String,
}

impl Tag {
    pub fn new(name: String, color: Option<String>) -> Self {
        let now: DateTime<Utc> = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            color: color.unwrap_or_else(|| "#6B7280".to_string()),
            created_at: now.to_rfc3339(),
        }
    }
}
