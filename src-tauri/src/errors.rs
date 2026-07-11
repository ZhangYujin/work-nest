use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Workspace not found: {0}")]
    #[allow(dead_code)]
    NotFound(String),

    #[error("Workspace already exists: {0}")]
    AlreadyExists(String),

    #[error("Workspace was deleted: {0}")]
    WasDeleted(String),

    #[error("Invalid parameter: {0}")]
    #[allow(dead_code)]
    InvalidParameter(String),

    #[error("Tool not found: {0}")]
    ToolNotFound(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_str())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
