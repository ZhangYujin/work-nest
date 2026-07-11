# WorkNest

A modern workspace manager for developers, built with Tauri 2.0.

Quickly discover, organize, and open your project workspaces from a single native app — with integrated support for opencode, Claude Code, VS Code, IDEA, and terminal.

## Features

- **Workspace Management** — Add, edit, delete, and search workspaces with a smooth, debounced search experience
- **Directory Scanning** — Auto-discover projects under configured directories with configurable scan depth
- **Project Type Detection** — Automatically identifies `git`, `multi_git`, and `directory` project types
- **One-Click Open** — Launch workspaces directly with opencode, Claude Code, VS Code, IDEA, or terminal (Terminal.app / iTerm2)
- **Tag System** — Organize workspaces with colored tags
- **Workspace JSON** — Each workspace gets a `workspace.json` for portable metadata; deleted workspaces can be restored
- **Internationalization** — Chinese and English UI
- **Themes** — Light, dark, and system modes
- **Statistics** — Open counts, 7-day activity, tool usage stats

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust + SQLite (rusqlite) |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS 4 |
| State Management | Zustand 5 |
| Framework | Tauri 2.0 |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri 2.0 prerequisites](https://tauri.app/start/prerequisites/)

## Getting Started

```bash
# Install dependencies
npm install

# Start development (hot reload for frontend + backend)
npm run tauri dev

# Start frontend only
npm run dev
```

## Build

```bash
# Production build (creates .app and .dmg on macOS)
npm run tauri build

# Universal macOS binary (Apple Silicon + Intel)
npm run build:mac
```

Build artifacts are output to `src-tauri/target/release/bundle/`.

## Type Checking

```bash
# TypeScript
npx tsc --noEmit

# Rust
cd src-tauri && cargo check
```

## Architecture

```
work-nest/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers (API boundary)
│   │   │   ├── workspace.rs    # Workspace CRUD, open, restore, stats
│   │   │   ├── settings.rs      # Settings, scan directories, tool detection
│   │   │   └── tag.rs           # Tag management
│   │   ├── db/             # SQLite connection & schema
│   │   ├── models/         # Data structures (Workspace, Tag, Settings)
│   │   └── errors.rs      # AppError type
│   └── tauri.conf.json
├── src/                    # React frontend
│   ├── components/
│   │   ├── workspace-list/ # Workspace listing, add/edit dialogs
│   │   ├── settings/       # Settings page
│   │   ├── tags/           # Tag management
│   │   ├── common/         # Sidebar navigation
│   │   └── ui/             # Reusable UI (Button, Card, Dialog, Input)
│   ├── store/              # Zustand stores (workspace, app)
│   ├── utils/commands.ts   # Type-safe Tauri invoke wrappers
│   ├── types/              # TypeScript types mirroring Rust structs
│   └── i18n/               # Internationalization (zh/en)
└── package.json
```

### Data Flow

1. Frontend calls type-safe wrappers in `utils/commands.ts`
2. Wrappers invoke Tauri commands in `src-tauri/src/commands/`
3. Commands query/manipulate SQLite database
4. Results returned via Promise to frontend

### Database Tables

| Table | Description |
|-------|-------------|
| `workspaces` | Main workspace table (soft delete via `deleted` flag) |
| `scan_directories` | Directory scan configuration |
| `settings` | Key-value settings store |
| `tags` | Tag definitions |
| `workspace_open_logs` | Audit log for workspace openings |

## Key Conventions

- **Database** — Parameterized queries (`?` binding) to prevent SQL injection
- **Workspace creation** — Checks for existing path; writes `workspace.json` before DB insert
- **Deleted workspaces** — Soft-deleted workspaces can be restored via confirm dialog
- **Search** — Debounced (200ms); name matches prioritized over path matches in results
- **Sorting** — Default: name ascending, then last opened; configurable per column
- **Terminal** — Supports Terminal.app and iTerm2 (configurable in settings)

## License

Private project.
