# Workspace Manager 技术规格书

## 项目概述

本地 AI Workspace 统一管理工具，用于管理 Qoder、Claude、悟空、VSCode、IntelliJ IDEA 等多种开发工具的 workspace。支持自动扫描发现、手动添加、一键打开、频次统计、标签管理、报告统计等能力。

---

## 技术选型

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | Tauri | 2.x | Rust 后端 + Web 前端的桌面应用框架 |
| 后端 | Rust | 2021 edition | 文件扫描、系统集成、数据库操作 |
| 前端 | React + TypeScript | React 19 / TS 5.8 | UI 交互层 |
| 构建 | Vite | 7.x | 前端构建工具 |
| UI 库 | shadcn/ui + Tailwind CSS | Tailwind 4.3 | 组件库 |
| 状态管理 | Zustand | 5.x | 轻量状态管理 |
| 图标 | Lucide React | 1.21 | 图标库 |
| 字体 | Geist Variable | - | 等宽现代字体 |
| 数据库 | SQLite (rusqlite) | 0.32 | 本地持久化存储 |
| 包管理 | npm + Cargo | - | 前后端依赖管理 |
| 对话框 | @tauri-apps/plugin-dialog | 2.7 | 系统原生对话框 |
| 文件打开 | @tauri-apps/plugin-opener | 2.x | Finder 中显示文件 |
| 命令面板 | cmdk | 1.1 | Command 组件 |
---

## 应用窗口配置

```json
{
  "title": "Workspace Manager",
  "width": 1200,
  "height": 800,
  "minWidth": 800,
  "minHeight": 600,
  "resizable": true,
  "center": true,
  "titleBarStyle": "Overlay",
  "hiddenTitle": true
}
```
- **titleBarStyle: Overlay** — macOS 标题栏覆盖模式，窗口按钮（红绿灯）叠加在内容上

- **hiddenTitle: true** — 隐藏标题文字，左上角区域留空

- **拖拽区域** — 顶部 `h-10` 固定区域 `z-[9999]`，通过 `getCurrentWindow().startDragging()` 实现窗口拖拽

---

## 界面设计风格

采用**简洁现代风**（参考 Linear / Raycast 风格），核心原则：

1. **布局清晰**：信息层级分明，操作路径短

2. **留白充足**：内容不拥挤，呼吸感强

3. **配色克制**：主色调不超过 3 种，辅以中性灰（oklch 色彩系统）

4. **圆角统一**：基础 radius `0.625rem`，组件通过乘数因子计算

5. **字体精简**：Geist Variable 字体栈，字号层级 4 级（text-2xl / text-sm / text-xs / text-[13px] / text-[10px]）

6. **微动效**：hover/transition 轻柔自然，`transition-colors` 为主

### 主题模式

支持三种主题模式：

- **浅色模式**（Light）

- **深色模式**（Dark）

- **跟随系统**（System）— 默认

通过 `document.documentElement.classList.add/remove('dark')` 切换。

### 色彩系统（oklch）

#### 浅色模式

```css
--background: oklch(1 0 0);           /* 纯白 */
--foreground: oklch(0.145 0 0);       /* 近黑 */
--primary: oklch(0.205 0 0);          /* 深黑主色 */
--primary-foreground: oklch(0.985 0 0);
--secondary: oklch(0.97 0 0);         /* 浅灰 */
--muted: oklch(0.97 0 0);             /* 弱化背景 */
--muted-foreground: oklch(0.556 0 0); /* 弱化文字 */
--accent: oklch(0.97 0 0);
--border: oklch(0.922 0 0);           /* 边框 */
--input: oklch(0.922 0 0);            /* 输入框边框 */
--ring: oklch(0.708 0 0);             /* 聚焦环 */
--destructive: oklch(0.577 0.245 27.325); /* 红色危险 */
--radius: 0.625rem;
```
#### 深色模式

```css
--background: oklch(0.145 0 0);       /* 深背景 */
--foreground: oklch(0.985 0 0);       /* 浅文字 */
--primary: oklch(0.922 0 0);
--card: oklch(0.205 0 0);
--muted: oklch(0.269 0 0);
--muted-foreground: oklch(0.708 0 0);
--border: oklch(1 0 0 / 10%);         /* 半透明白边框 */
--input: oklch(1 0 0 / 15%);
--destructive: oklch(0.704 0.191 22.216);
```
### 圆角系统

```css
--radius: 0.625rem;        /* 基础 10px */
--radius-sm: 0.375rem;     /* 6px，小组件 */
--radius-md: 0.5rem;       /* 8px，中等组件 */
--radius-lg: 0.625rem;     /* 10px，卡片 */
--radius-xl: 0.875rem;     /* 14px */
```
### 输入框聚焦样式

统一规范：`border-border/60 focus-visible:border-border focus-visible:ring-1 focus-visible:ring-border/50`

---

## 整体布局结构

```
┌──────────────────────────────────────────────────────────┐
│ [拖拽区域 h-10 fixed z-[9999]]                            │
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│ Sidebar  │  Main Content (bg-muted/20)                   │
│ w-60     │  px-8 pt-12 pb-4                              │
│ (可收起   │                                               │
│  w-16)   │  - workspaces 页面: 固定头部 + 可滚动列表      │
│          │  - 其他页面: ScrollArea 整体可滚动             │
│ bg-muted │                                               │
│ /40      │                                               │
│ border-r │                                               │
├──────────┤                                               │
│ Settings │                                               │
│ (底部)    │                                               │
└──────────┴───────────────────────────────────────────────┘
```
---

## 侧边栏（Sidebar）

### 结构

- 宽度：展开 `w-60`，收起 `w-16`

- 背景：`bg-muted/40`

- 右边框：`border-r`

- 过渡动画：`transition-all duration-200`

### 导航项

| 图标 | 页面 ID | 文字 |
|------|---------|------|
| FolderOpen | workspaces | 工作空间 |
| BarChart3 | report | 报告 |
| Tag | tags | 标签 |
| Settings | settings | 设置（底部独立） |
### 选中态样式

- 选中：`bg-background text-foreground shadow-sm`

- 未选中：`text-muted-foreground hover:bg-background/60 hover:text-foreground`

### 收起/展开按钮

- 展开图标：`PanelLeft`

- 收起图标：`PanelLeftClose`

- 位置：Header 区域（pt-10 pb-2）

---

## 页面一：Workspaces 列表页

### 布局

固定头部（搜索 + 筛选）+ 可滚动列表区域（`overflow-y-auto`）。

### 页头

- 标题：`text-2xl font-semibold tracking-tight` — "Workspaces"

- 副标题：`text-xs text-muted-foreground` — "管理你的所有 AI 工作空间"

- 添加按钮：`Button size="sm"` + `Plus` 图标

### 搜索栏

- 高度：`h-8`

- 左侧图标：`Search h-3.5 w-3.5`

- 字号：`text-[13px]`

- 内边距：`pl-8`

### 筛选栏

一排自定义下拉按钮，间距 `gap-2.5`：

| 筛选项 | 选项 |
|--------|------|
| 状态 | 全部 / 在用 / 已归档 / 已废弃 |
| 项目类型 | 全部 / 普通目录 / Git 项目 / 多 Git 空间 |
| 工具 | 全部 / qoder / claude / wukong / vscode |
| 扫描目录 | 全部目录 / 各扫描目录（按 name 显示）|
| 排序 | 名称 / 最近打开 / 打开次数 / 更新时间 |
| 排序方向 | ↑ (asc) / ↓ (desc) 按钮 |
| 标签筛选 | 带 Tag 图标 + 颜色圆点的下拉 |
#### 筛选按钮样式

```
h-8 min-w-[90px] rounded-md border border-border bg-background px-3
text-[13px] text-foreground/80 shadow-sm
hover:border-foreground/30
```
#### 下拉面板样式

```
absolute left-0 top-full z-50 mt-1 min-w-[110px]
rounded-md border border-border bg-background py-1 shadow-lg
```
#### 选中项 vs 未选中

- 选中：`text-foreground font-medium`

- 未选中：`text-foreground/70`

### 列表项

每个 workspace 卡片样式：

```
group flex cursor-pointer items-center justify-between
rounded-lg border p-4 transition-colors hover:bg-accent
```
#### 左侧信息

- 名称：`font-medium`

- 项目类型标签：`rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground`

- 状态标签：同上样式

- 打开次数：进度条 `h-1.5 w-12 bg-muted` + `bg-primary/60` 填充

- 路径：`truncate text-sm text-muted-foreground`

- 标签：`rounded-full px-2 py-0.5 text-[10px] font-medium` + 颜色 `backgroundColor: color + '20', color: color`

#### 右侧操作按钮（hover 时显示）

- 容器：`opacity-0 group-hover:opacity-100`

- 按钮列表：

  - **Qoder**：自定义 SVG 图标 `h-4 w-4`

  - **Claude**：自定义 SVG 图标 `h-4 w-4`

  - **IDEA**：自定义 SVG 图标 `h-4 w-4`

  - **VSCode**：文字按钮（仅 tools 包含 vscode 时显示）

  - **Finder**：`ExternalLink` 图标

  - **删除**：`Trash2` 图标 `text-destructive`

所有按钮：`variant="ghost" size="sm" className="h-7 w-7 p-0"`

### 空状态

- 圆形图标容器：`rounded-full bg-muted p-4` + `FolderOpen h-8 w-8`

- 标题：`text-lg font-medium`

- 提示：`text-sm text-muted-foreground`

---

## 页面二：添加 Workspace 弹窗

### 弹窗结构

`Dialog` + `DialogContent` 标准 shadcn 弹窗。

### 表单字段（间距 `space-y-5 py-3`）

| 字段 | 控件 | 说明 |
|------|------|------|
| 目录路径 | Input + 浏览按钮 | 支持扫描目录快捷选择下拉 |
| 名称 | Input | 选择目录后自动填充末级目录名 |
| 描述 | Input | 可选 |
| 关联工具 | 多选按钮组 | 默认选中 qoder |
| 标签 | 多选标签 + 快捷创建 | 支持 Enter 快速新建标签 |
### 标签选择样式

- 选中：`ring-2 ring-offset-1` + 颜色 boxShadow

- 未选中：`opacity-60 hover:opacity-100`

- 标签 pill：`rounded-full px-2.5 py-1 text-xs font-medium`

### 路径下拉（扫描目录快捷选择）

- 当 path 为空且 input 聚焦/点击时显示

- 展示已配置的扫描目录列表

- 选择后打开系统目录选择对话框（defaultPath 设为扫描目录路径）

---

## 页面三：编辑 Workspace 弹窗

### 弹窗配置

```
max-w-lg max-h-[85vh] flex flex-col overflow-hidden
```
### Tab 切换

两个 Tab：

- **基本信息** — 编辑名称、状态、工具、标签

- **workspace.json** — K-V 编辑器

Tab 样式：

- 选中：`border-b-2 border-primary text-primary`

- 未选中：`text-muted-foreground hover:text-foreground`

### 基本信息 Tab

- 内容区高度：`h-[420px] overflow-y-auto`

- 字段：名称、备注、状态（按钮组）、关联工具（按钮组）、标签（多选）、路径（只读 + 复制按钮）

### workspace.json Tab

- K-V 编辑器：固定字段（status / tools / description）+ 自定义字段

- 固定字段区域：`rounded-md border border-border/40 bg-muted/20 p-3`

- 自定义字段：动态添加/删除 key-value 对

### 路径复制功能

- 复制按钮：`Copy` / `Check` 图标切换

- 复制成功反馈：图标变为绿色 ✓，2 秒后恢复

---

## 页面四：标签管理页

### 布局

- 标题：`text-2xl font-bold tracking-tight` — "标签管理"

- 添加按钮：`Button size="sm"` + `Plus` 图标

### 标签网格

- 布局：`grid grid-cols-2 sm:grid-cols-3 gap-3`

- 每个标签卡片：`group rounded-lg border p-3 hover:bg-accent`

- 左侧：颜色圆点 `h-4 w-4 rounded-full` + 名称

- 右侧（hover 显示）：编辑（`Pencil`）+ 删除（`Trash2 text-destructive`）

### 创建/编辑弹窗

- 名称输入

- 颜色选择：8 个预设颜色圆点

  ```
  #EF4444, #F59E0B, #10B981, #3B82F6,
  #8B5CF6, #EC4899, #6B7280, #14B8A6
  ```
- 选中态：`borderColor: currentColor`，未选中 `transparent`

- 预览：实时预览标签样式 `rounded-full px-3 py-1 text-xs font-medium`

---

## 页面五：报告页

### 布局

- 标题：`text-2xl font-semibold tracking-tight` — "报告"

- 副标题：`text-xs text-muted-foreground`

### 工作空间数量汇总（4 列网格）

`grid grid-cols-4 gap-3`

每张状态卡片结构：

```
rounded-lg border ${borderColor} p-3 ${bg}
```
| 卡片 | 图标 | 颜色 | 边框色 |
|------|------|------|--------|
| 全部 | Layers | text-blue-600 / bg-blue-500/5 | border-blue-200/60 |
| 在用 | Activity | text-green-600 / bg-green-500/5 | border-green-200/60 |
| 已归档 | Archive | text-amber-600 / bg-amber-500/5 | border-amber-200/60 |
| 已废弃 | AlertTriangle | text-red-500 / bg-red-500/5 | border-red-200/60 |
每张卡片底部包含类型分布：

- Git 仓库（FolderGit2）

- 多 Git 空间（GitFork）

- 普通目录（Folder）

### Top 3 排行榜（2 列网格）

`grid grid-cols-2 gap-4`

- Top 3 Git 项目

- Top 3 普通项目

排名项样式：

- 序号：`h-5 w-5 rounded-full bg-primary/10 text-[10px] font-bold text-primary`

- 进度条：`h-1.5 rounded-full bg-muted/60` + `bg-primary/30` 填充

### 工具使用统计

横向柱状图：

- 工具名：`w-20 text-xs font-medium`

- 进度条：`h-6 rounded-md bg-muted/50` + `bg-primary/20` 填充

- 计数：`w-10 text-right text-xs text-muted-foreground`

---

## 页面六：设置页

### 模块分区（Card 组件 + Separator 分隔）

#### 1. 扫描目录管理

- 标题 + "添加目录"按钮（`FolderPlus` 图标）

- 每个目录卡片：`rounded-lg border p-3 space-y-1.5`

  - 目录名（可编辑 inline）+ 编辑/确认/取消按钮

  - 路径：`text-xs text-muted-foreground font-mono`

  - 上次扫描时间

  - 扫描深度控制：`-` / 数字 / `+` 按钮（范围 1~10）

  - 操作按钮：扫描（`Play`）、删除（`Trash2`）

  - 扫描进度条：`h-1.5 bg-primary animate-pulse`

#### 2. 自动扫描

- 开关按钮：`variant={autoScan ? 'default' : 'outline'}`

- 扫描间隔：`-` / 数字 / `+` 控制（范围 5~1440 分钟，步长 5）

#### 3. 工具路径配置

| 工具 | 默认路径 |
|------|----------|
| Qoder | /Applications/Qoder.app/Contents/Resources/app/bin/code |
| Claude | /usr/local/bin/claude |
| VSCode | /Applications/Visual Studio Code.app/Contents/Resources/app/bin/code |
| IDEA | /Applications/IntelliJ IDEA CE.app/Contents/MacOS/idea |
| Wukong | /Applications/Wukong.app |
- "重新检测"按钮：`RefreshCw` 图标

- 终端应用选择：Terminal / iTerm2 按钮组

#### 4. 主题

按钮组：跟随系统 / 浅色 / 深色

#### 5. 语言

按钮组：跟随系统 / 中文 / English

#### 6. 关于

- 版本号：0.1.0

- Changelog 按钮：`FileText` 图标，弹窗展示更新日志

- 作者：focsim

---

## 国际化（i18n）

### 架构

- React Context + useLocale Hook

- 语言持久化：存储在 SQLite settings 表 `locale` 键

- 系统语言检测：`navigator.language`，zh 开头用中文，否则英文

- 参数模板：`{count}` / `{original}` / `{current}` 等占位符

### 支持语言

- `zh` — 中文

- `en` — English

- `system` — 跟随系统

---

## 状态管理（Zustand）

### app-store

```typescript
interface AppState {
  currentPage: 'workspaces' | 'tags' | 'report' | 'settings';
  sidebarCollapsed: boolean;
  searchQuery: string;
  toolsInstalled: Record<string, boolean>;
}
```
### workspace-store

```typescript
interface WorkspaceState {
  workspaces: Workspace[];
  stats: WorkspaceStats | null;
  filter: WorkspaceFilter;
  loading: boolean;
  error: string | null;
}
```
---

## 数据模型

### Workspace

```typescript
interface Workspace {
  id: string;
  name: string;
  path: string;
  description: string;
  status: 'active' | 'archived' | 'deprecated';
  projectType: 'directory' | 'git' | 'multi-git';
  tools: string[];
  tags: { name: string; color: string }[];
  source: 'scan' | 'manual';
  openCount: number;
  openCount7d: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
}
```
### Tag

```typescript
interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}
```
### ScanDirectory

```typescript
interface ScanDirectory {
  id: string;
  name: string;
  path: string;
  depth: number;
  enabled: boolean;
  lastScannedAt: string | null;
}
```
### WorkspaceFilter

```typescript
interface WorkspaceFilter {
  status?: string;
  projectType?: string;
  tool?: string;
  tag?: string;
  search?: string;
  scanDirPath?: string;
  sortBy?: 'name' | 'updatedAt' | 'lastOpenedAt' | 'openCount';
  sortOrder?: 'asc' | 'desc';
}
```
---

## 数据库设计（SQLite）

### workspaces 主表

```sql
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active', 'archived', 'deprecated')),
    project_type TEXT NOT NULL DEFAULT 'directory'
        CHECK(project_type IN ('directory', 'git', 'multi-git')),
    tools TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT 'manual'
        CHECK(source IN ('scan', 'manual')),
    open_count INTEGER NOT NULL DEFAULT 0,
    open_count_7d INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_opened_at TEXT
);
```
### workspace_open_logs 打开日志表

```sql
CREATE TABLE IF NOT EXISTS workspace_open_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    opened_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
```
### tags 全局标签库

```sql
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6B7280',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
### settings 设置表（KV 存储）

```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
### scan_directories 扫描目录配置

```sql
CREATE TABLE IF NOT EXISTS scan_directories (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    depth INTEGER NOT NULL DEFAULT 3,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_scanned_at TEXT
);
```
### 索引

```sql
CREATE INDEX idx_workspaces_status ON workspaces(status);
CREATE INDEX idx_workspaces_path ON workspaces(path);
CREATE INDEX idx_workspaces_open_count ON workspaces(open_count DESC);
CREATE INDEX idx_workspaces_last_opened ON workspaces(last_opened_at DESC);
CREATE INDEX idx_open_logs_workspace ON workspace_open_logs(workspace_id);
CREATE INDEX idx_open_logs_time ON workspace_open_logs(opened_at);
```
### 数据库迁移

使用自定义 migration 机制，通过 `db_migrations` 表跟踪版本：

| 版本 | 描述 |
|------|------|
| v1 | 初始 schema |
| v2 | 添加 project_type 列 |
| v3 | 添加 scan_directories.name 列 |
---

## Tauri 后端 API（Rust Commands）

### Workspace 命令

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| get_workspaces | filter?: WorkspaceFilter | Workspace[] | 获取列表（含筛选排序） |
| get_workspace | id: string | Workspace | 获取单个 |
| create_workspace | request: CreateWorkspaceRequest | Workspace | 创建 |
| update_workspace | id: string, request: UpdateWorkspaceRequest | Workspace | 更新 |
| delete_workspace | id: string | void | 删除 |
| get_workspace_stats | - | WorkspaceStats | 统计数据 |
| open_workspace | id: string, tool: string | string (path) | 打开并记录日志 |
| read_workspace_json | id: string | string | 读取 workspace.json |
| write_workspace_json | id: string, content: string | void | 写入 workspace.json |
| check_tools_installed | - | Record<string, boolean> | 检查工具安装状态 |
| get_tool_usage_stats | - | { tool, count }[] | 工具使用统计 |
### Tag 命令

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| get_tags | - | Tag[] | 获取全部标签 |
| create_tag | name, color? | Tag | 创建标签 |
| update_tag | id, name?, color? | Tag | 更新标签 |
| delete_tag | id | void | 删除标签 |
### Settings 命令

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| get_setting | key | unknown | 获取设置项 |
| set_setting | key, value | void | 设置项 |
| get_all_settings | - | Setting[] | 所有设置 |
| get_scan_directories | - | ScanDirectory[] | 获取扫描目录 |
| add_scan_directory | path, name?, depth? | ScanDirectory | 添加扫描目录 |
| remove_scan_directory | id | void | 删除扫描目录 |
| update_scan_directory_depth | id, depth | void | 更新深度 |
| update_scan_directory_name | id, name | void | 更新名称 |
| scan_directory | id | number | 执行扫描，返回发现数量 |
### 扫描进度事件

通过 Tauri event 系统（`emit`）发送 `scan-progress` 事件：

```typescript
interface ScanProgress {
  dir_id: string;
  status: 'started' | 'scanning' | 'completed';
  found: number;
  progress?: number;
  current_path?: string;
}
```---
## Workspace 识别规则（三重识别）

按优先级从高到低：

1. **workspace.json** — 本工具特有的元数据文件，最高优先级

2. **claude.md** — Claude 项目文件，次优先级

3. **.git 目录** — Git 仓库标识，最低优先级

### 项目类型判定

- **directory**：普通目录（无 .git）

- **git**：包含 .git 目录的单 Git 仓库

- **multi-git**：目录下包含多个 .git 子目录的聚合空间

---

## workspace.json Schema

```json
{
  "name": "项目名称",
  "description": "项目描述",
  "status": "active",
  "tools": ["qoder", "claude"],
  "tags": [
    { "name": "前端", "color": "#3B82F6" }
  ]
}
```
支持自定义扩展字段（K-V 编辑器中管理）。

---

## 前端目录结构

```
src/
├── assets/                    # 静态资源（SVG 图标）
│   ├── claude-icon.svg
│   ├── idea-icon.svg
│   ├── qoder-icon.svg
│   └── react.svg
├── components/
│   ├── common/
│   │   └── sidebar.tsx        # 左侧导航栏
│   ├── report/
│   │   └── report-page.tsx    # 报告页
│   ├── settings/
│   │   └── settings-page.tsx  # 设置页
│   ├── tags/
│   │   └── tags-page.tsx      # 标签管理页
│   ├── ui/                    # shadcn/ui 基础组件
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── command.tsx
│   │   ├── dialog.tsx
│   │   ├── input-group.tsx
│   │   ├── input.tsx
│   │   ├── scroll-area.tsx
│   │   ├── separator.tsx
│   │   └── textarea.tsx
│   └── workspace-list/
│       ├── add-workspace-dialog.tsx    # 添加弹窗
│       ├── edit-workspace-dialog.tsx   # 编辑弹窗
│       └── workspaces-page.tsx         # 列表页
├── i18n/
│   ├── index.tsx              # I18nProvider + useLocale
│   └── locales.ts             # 中英文文案
├── lib/
│   └── utils.ts               # cn() 工具函数
├── store/
│   ├── app-store.ts           # 应用全局状态
│   └── workspace-store.ts     # Workspace 业务状态
├── types/
│   ├── index.ts               # 类型导出入口
│   ├── settings.ts            # 设置相关类型
│   ├── tag.ts                 # 标签类型
│   └── workspace.ts           # Workspace 类型
├── utils/
│   └── commands.ts            # Tauri invoke 封装
├── App.tsx                    # 应用主组件
├── index.css                  # 全局样式（主题变量）
├── main.tsx                   # 入口文件
└── vite-env.d.ts
```
---

## 后端目录结构（Rust）

```
src-tauri/src/
├── commands/
│   ├── mod.rs                 # 模块导出
│   ├── settings.rs            # 设置相关命令
│   ├── tag.rs                 # 标签相关命令
│   └── workspace.rs           # Workspace 相关命令
├── db/
│   ├── mod.rs                 # Database 结构体
│   ├── migration.rs           # 数据库迁移
│   └── schema.sql             # 初始建表 SQL
├── models/
│   ├── mod.rs
│   ├── settings.rs
│   ├── tag.rs
│   └── workspace.rs
├── errors.rs                  # 错误处理
├── lib.rs                     # 应用入口（Plugin 注册 + Command 注册）
└── main.rs                    # 主程序入口
```
---

## Rust 依赖

| Crate | 版本 | 用途 |
|-------|------|------|
| tauri | 2 | 应用框架 |
| tauri-plugin-opener | 2 | 文件管理器打开 |
| tauri-plugin-dialog | 2.7.1 | 系统对话框 |
| serde / serde_json | 1 | 序列化 |
| rusqlite | 0.32 (bundled) | SQLite |
| notify | 7 | 文件系统监听 |
| tokio | 1 (full) | 异步运行时 |
| chrono | 0.4 (serde) | 时间处理 |
| thiserror | 2 | 错误类型 |
| uuid | 1 (v4) | UUID 生成 |
---

## 构建与运行

```bash
# 开发模式
npm run tauri dev
# 构建（macOS DMG + app）
npm run build:mac
# 前端独立开发（Vite dev server）
npm run dev
# 格式化
npm run format
# Lint
npm run lint
```
### Vite 配置

- 端口：1420（严格模式）

- 路径别名：`@` → `./src`

- Tailwind CSS v4 via `@tailwindcss/vite` 插件

### 打包配置

- targets: `["dmg", "app"]`

- 最低 macOS 版本：10.15

- Bundle ID: `com.focsim.workspace-manager`

- DMG 布局：应用图标 (180, 170)，Applications 快捷方式 (480, 170)

---

## 设置项（settings 表 KV 键）

| Key | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| theme | string | system | 主题模式 |
| locale | string | system | 语言设置 |
| auto_scan | string(bool) | false | 自动扫描开关 |
| scan_interval | string(number) | 30 | 扫描间隔（分钟）|
| terminal_app | string | terminal | 终端应用 (terminal / iterm2) |
| tool_path_qoder | string | - | Qoder 可执行路径 |
| tool_path_claude | string | - | Claude 可执行路径 |
| tool_path_vscode | string | - | VSCode 可执行路径 |
| tool_path_idea | string | - | IDEA 可执行路径 |
| tool_path_wukong | string | - | Wukong 可执行路径 |
---

## 核心交互逻辑

### 工具打开流程

1. 前端检查 `toolsInstalled[tool]`，未安装则 alert 提示

2. 调用 `open_workspace(id, tool)` 后端命令

3. 后端：记录 open_log → 更新 open_count → 读取 tool_path 配置 → 启动进程

4. 特殊处理：`finder` 工具在前端通过 `revealItemInDir` 打开

5. 打开后刷新列表和统计

### 删除 Workspace 流程

1. 弹出确认弹窗（描述：仅标记删除，不删除实际文件）

2. 后端：在 workspace.json 中标记 deleted

3. 后续扫描忽略已标记目录

### 扫描深度修改流程

1. +/- 按钮修改深度

2. 300ms 后弹出确认弹窗："仅保存" / "保存并扫描"

3. 选择保存并扫描则立即触发该目录重新扫描

### 标签级联逻辑

- 删除标签时，所有关联的 workspace 自动移除该标签

- 标签颜色修改后同步到所有关联的 workspace

---

## UI 组件规格速查

| 组件 | 高度 | 字号 | 说明 |
|------|------|------|------|
| 筛选按钮 | h-8 | text-[13px] | 自定义下拉组件 |
| 操作按钮(小) | h-7 w-7 | - | ghost 图标按钮 |
| 工具选择按钮 | h-7 | text-xs | 选中 default / 未选 outline |
| 搜索输入框 | h-8 | text-[13px] | 带左侧搜索图标 |
| 深度控制按钮 | h-6 w-6 | - | outline 方形按钮 |
| 标签 pill | - | text-[10px] | rounded-full px-2 py-0.5 |
| 对话框内容区 | h-[420px] | - | overflow-y-auto |
| 图标尺寸(导航) | h-4 w-4 | - | shrink-0 |
| 图标尺寸(操作) | h-3.5 w-3.5 | - | 列表项操作区 |
---

## 里程碑

| 里程碑 | 内容 |
|--------|------|
| M1 基础框架 | 项目初始化、数据库建表、基本 CRUD |
| M2 扫描与列表 | 扫描引擎、Workspace 列表展示与筛选 |
| M3 编辑与管理 | 详情编辑、手动添加、workspace.json 处理 |
| M4 统计与标签 | 频次统计、标签管理、标签筛选 |
| M5 设置与优化 | 设置模块、主题切换、工具路径配置、体验优化 |
| M6 报告模块 | 工作空间统计、排行榜、工具使用统计 |
