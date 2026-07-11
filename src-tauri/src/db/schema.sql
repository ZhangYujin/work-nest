-- Database migrations tracking table
CREATE TABLE IF NOT EXISTS db_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Workspaces main table
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active', 'archived', 'deprecated')),
    project_type TEXT NOT NULL DEFAULT 'directory'
        CHECK(project_type IN ('directory', 'git', 'multi_git')),
    tools TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT 'manual'
        CHECK(source IN ('scan', 'manual')),
    open_count INTEGER NOT NULL DEFAULT 0,
    open_count_7d INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_opened_at TEXT,
    deleted INTEGER NOT NULL DEFAULT 0
);

-- Workspace open logs
CREATE TABLE IF NOT EXISTS workspace_open_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    opened_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6B7280',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Settings table (KV storage)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scan directories configuration
CREATE TABLE IF NOT EXISTS scan_directories (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    depth INTEGER NOT NULL DEFAULT 3,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_scanned_at TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_workspaces_path ON workspaces(path);
CREATE INDEX IF NOT EXISTS idx_workspaces_open_count ON workspaces(open_count DESC);
CREATE INDEX IF NOT EXISTS idx_workspaces_last_opened ON workspaces(last_opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_open_logs_workspace ON workspace_open_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_open_logs_time ON workspace_open_logs(opened_at DESC);

-- Insert initial migration version
INSERT OR IGNORE INTO db_migrations (version) VALUES ('v4');
