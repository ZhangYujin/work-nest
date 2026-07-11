use rusqlite::{Connection, OpenFlags};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: PathBuf) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open_with_flags(
            path,
            OpenFlags::SQLITE_OPEN_CREATE | OpenFlags::SQLITE_OPEN_READ_WRITE,
        )?;

        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", ())?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn init_schema(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();

        // Create tables from schema
        let schema = include_str!("schema.sql");
        conn.execute_batch(schema)?;

        // Run migrations: add deleted column to existing databases
        let _ = conn.execute(
            "ALTER TABLE workspaces ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0",
            (),
        );

        Ok(())
    }
}
