# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important User Preferences

- **Do NOT run build/package unless explicitly requested**: After modifying code, do not run `npm run tauri build` or packaging commands unless specifically asked by the user.

## Project Overview

**WorkNest** - A modern workspace manager for developers built with Tauri 2.0.

- **Backend**: Rust + SQLite
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **State Management**: Zustand

## Common Commands

### Development
```bash
# Start development server (hot reload for both frontend and backend)
npm run tauri dev

# Start only frontend dev server
npm run dev
```

### Build
```bash
# Build for production (creates .app and .dmg on macOS)
npm run tauri build

# Build universal macOS binary (Apple Silicon + Intel)
npm run build:mac
```

### Type Checking
```bash
# TypeScript check
npx tsc --noEmit

# Rust check
cd src-tauri && cargo check
```

## Architecture

### Backend (Rust)

**Location**: `src-tauri/src/`

- **`commands/`**: Tauri command handlers - the API boundary between frontend and backend
  - `workspace.rs`: Workspace CRUD, open, stats
  - `settings.rs`: Settings, scan directories, tool detection
  - `tag.rs`: Tag management

- **`db/`**: SQLite database schema and connection
  - `schema.sql`: Database migrations and table definitions

- **`models/`**: Data structures
  - `workspace.rs`: Workspace struct, Create/Update requests, ProjectType enum
  - `settings.rs`: ScanDirectory, Setting
  - `tag.rs`: Tag struct

- **`errors.rs`**: AppError type for error handling across commands

### Frontend (React/TypeScript)

**Location**: `src/`

- **`utils/commands.ts`**: Type-safe wrappers around Tauri invocations - always use these instead of calling `invoke()` directly

- **`store/`**: Zustand state stores
  - `workspace-store.ts`: Workspace listing, filtering, stats
  - `app-store.ts`: App-level state (tools installed, etc.)

- **`components/`**:
  - `common/sidebar.tsx`: Navigation sidebar
  - `settings/settings-page.tsx`: Settings UI (scan dirs, tool paths, theme, language)
  - `workspace-list/`: Workspace listing and management
  - `ui/`: Reusable UI components (Button, Card, Dialog, etc.)

- **`types/`**: TypeScript type definitions mirroring Rust structs

- **`i18n/`**: Internationalization (Chinese/English)

### Data Flow

1. Frontend calls functions from `utils/commands.ts`
2. These invoke Tauri commands defined in `src-tauri/src/commands/`
3. Commands query/manipulate SQLite database
4. Results returned via Promise to frontend

### Database Tables

- `workspaces`: Main workspace table (soft delete via `deleted` flag)
- `scan_directories`: Directory scan configuration
- `settings`: Key-value settings store
- `tags`: Tag definitions
- `workspace_open_logs`: Audit log for workspace openings

## Key Conventions

- **Database operations**: Use `?` for SQLite parameter binding to prevent SQL injection
- **Workspace creation**: Check for existing path first to avoid duplicates
- **Scan directory**: Returns `ScanResult` with `added`, `removed`, `unchanged` counts and names
- **Tool detection**: Checks filesystem paths against configured/expected paths
- **Theme**: Supports light/dark/system modes
- **Terminal**: Supports both Terminal.app and iTerm2
