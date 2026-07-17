import { useWorkspaceStore } from '../../store/workspace-store';
import { useAppStore } from '../../store/app-store';
import { openWorkspace, deleteWorkspace } from '../../utils/commands';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { cn, formatRelativeTime, getProjectTypeIcon, truncatePath } from '../../lib/utils';
import { useLocale } from '../../i18n';
import { OpencodeIcon } from '../icons/OpencodeIcon';
import { ClaudeIcon } from '../icons/ClaudeIcon';
import { IDEAIcon } from '../icons/IDEAIcon';
import { VSCodeIcon } from '../icons/VSCodeIcon';
import { GitIcon } from '../icons/GitIcon';
import { FolderOpen, ExternalLink, Trash2, Check, AlertTriangle, Terminal, Folder, FolderKanban } from 'lucide-react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useState } from 'react';
import EditWorkspaceDialog from './edit-workspace-dialog';
import type { Workspace } from '../../types';

export function WorkspaceList() {
  const { t } = useLocale();
  const workspaces = useWorkspaceStore(state => state.workspaces);
  const loading = useWorkspaceStore(state => state.loading);
  const error = useWorkspaceStore(state => state.error);
  const fetchWorkspaces = useWorkspaceStore(state => state.fetchWorkspaces);
  const fetchStats = useWorkspaceStore(state => state.fetchStats);
  const toolsInstalled = useAppStore(state => state.toolsInstalled);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const tools = [
    { key: 'opencode', name: 'Opencode', displayName: '从 Opencode 打开' },
    { key: 'claude', name: 'Claude', displayName: '从 Claude Code 打开' },
    { key: 'idea', name: 'IDEA', displayName: '从 IDEA 打开' },
    { key: 'vscode', name: 'VSCode', displayName: '从 VSCode 打开' },
  ];

  const statusLabels: Record<string, string> = {
    active: t.status_active,
    archived: t.status_archived,
    deprecated: t.status_deprecated,
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-600',
    archived: 'bg-amber-500/10 text-amber-600',
    deprecated: 'bg-red-500/10 text-red-600',
  };

  const typeLabels: Record<string, string> = {
    directory: t.type_directory,
    git: t.type_git,
    multi_git: t.type_multi_git,
  };

  const handleOpen = async (workspace: Workspace, tool: string) => {
    try {
      await openWorkspace(workspace.id, tool);
      await Promise.all([fetchWorkspaces(), fetchStats()]);
    } catch (error) {
      console.error(`Failed to open with ${tool}:`, error);
    }
  };

  const handleRevealInFinder = async (path: string) => {
    try {
      await revealItemInDir(path);
    } catch (error) {
      console.error('Failed to reveal in finder:', error);
    }
  };

  const handleDelete = async () => {
    if (!workspaceToDelete) return;
    try {
      await deleteWorkspace(workspaceToDelete.id);
      setDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
      await fetchWorkspaces();
    } catch (error) {
      console.error('Failed to delete workspace:', error);
    }
  };

  const handleEdit = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setEditDialogOpen(true);
  };

  const handleCopyPath = async (path: string) => {
    try {
      await writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch (error) {
      console.error('Failed to copy path:', error);
    }
  };

  if (loading && workspaces.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{t.loading}</p>
      </div>
    );
  }

  if (error && workspaces.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchWorkspaces()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {workspaces.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center space-y-3">
          <div className="rounded-full bg-muted p-4">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium">{t.no_workspaces}</p>
          <p className="text-sm text-muted-foreground">{t.no_workspaces_desc}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className="group/row flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-muted-foreground">
                    {getProjectTypeIcon(workspace.project_type) === 'git' && <GitIcon className="h-4 w-4" />}
                    {getProjectTypeIcon(workspace.project_type) === 'multi_git' && <FolderKanban className="h-4 w-4" />}
                    {getProjectTypeIcon(workspace.project_type) === 'directory' && <Folder className="h-4 w-4" />}
                  </span>
                  <span
                    className="font-medium truncate hover:text-primary transition-colors cursor-pointer"
                    onClick={() => handleEdit(workspace)}
                  >
                    {workspace.name}
                  </span>
                  <span className={cn('rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground')}>
                    {typeLabels[workspace.project_type] || workspace.project_type}
                  </span>
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', statusColors[workspace.status])}>
                    {statusLabels[workspace.status] || workspace.status}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full"
                        style={{ width: `${Math.min(workspace.open_count * 5, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px]">{workspace.open_count}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div
                    className="relative group/path min-w-0 max-w-full cursor-pointer hover:text-foreground transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyPath(workspace.path);
                    }}
                    onMouseEnter={() => setHoveredPath(workspace.path)}
                    onMouseLeave={() => setHoveredPath(null)}
                  >
                    <span className="truncate font-mono block">
                      {truncatePath(workspace.path)}
                    </span>
                    {hoveredPath === workspace.path && (
                      <div className="absolute z-50 bottom-full left-0 mb-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow border whitespace-nowrap pointer-events-none">
                        {workspace.path}
                      </div>
                    )}
                  </div>
                  {copiedPath === workspace.path && (
                    <span className="flex items-center gap-1 text-green-500 shrink-0">
                      <Check className="h-3 w-3" />
                      已复制
                    </span>
                  )}
                  {workspace.last_opened_at && (
                    <span>{formatRelativeTime(workspace.last_opened_at)}</span>
                  )}
                </div>

                {workspace.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {workspace.tags.map((tag) => (
                      <span
                        key={tag.name}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: tag.color + '20', color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity ml-4">
                 {tools.map((tool) =>
                   toolsInstalled[tool.key] ? (
                     <div key={tool.key} className="relative group/btn">
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-7 w-7"
                         onClick={(e) => {
                           e.stopPropagation();
                           handleOpen(workspace, tool.key);
                         }}
                       >
                         {tool.key === 'opencode' && <OpencodeIcon className="h-4 w-4" />}
                         {tool.key === 'claude' && <ClaudeIcon className="h-4 w-4" />}
                         {tool.key === 'idea' && <IDEAIcon className="h-4 w-4" />}
                         {tool.key === 'vscode' && <VSCodeIcon className="h-4 w-4" />}
                       </Button>
                       <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow border whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none z-50">
                         {tool.displayName}
                       </div>
                     </div>
                   ) : null
                 )}

                 <div className="relative group/btn">
                   <Button
                     variant="ghost"
                     size="icon"
                     className="h-7 w-7"
                     onClick={(e) => {
                       e.stopPropagation();
                       handleOpen(workspace, 'terminal');
                     }}
                   >
                     <Terminal className="h-3.5 w-3.5" />
                   </Button>
                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow border whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none z-50">
                     在终端中打开
                   </div>
                 </div>

                 <div className="relative group/btn">
                   <Button
                     variant="ghost"
                     size="icon"
                     className="h-7 w-7"
                     onClick={(e) => {
                       e.stopPropagation();
                       handleRevealInFinder(workspace.path);
                     }}
                   >
                     <ExternalLink className="h-3.5 w-3.5" />
                   </Button>
                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow border whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none z-50">
                     在访达中显示
                   </div>
                 </div>

                 <div className="relative group/btn">
                   <Button
                     variant="ghost"
                     size="icon"
                     className="h-7 w-7 text-red-500 hover:bg-red-500/10"
                     onClick={(e) => {
                       e.stopPropagation();
                       setWorkspaceToDelete(workspace);
                       setDeleteDialogOpen(true);
                     }}
                   >
                     <Trash2 className="h-3.5 w-3.5" />
                   </Button>
                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow border whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none z-50">
                     删除工作空间
                   </div>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedWorkspace && (
        <EditWorkspaceDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          workspace={selectedWorkspace}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              确认删除工作空间
            </DialogTitle>
            <DialogDescription className="pt-2">
              这将在 <strong>{workspaceToDelete?.name}</strong> 的 workspace.json 中标记为已删除。下次扫描时该工作空间将不再出现在列表中。
              <br /><br />
              <span className="text-muted-foreground">
                路径：{workspaceToDelete?.path}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteDialogOpen(false);
                setWorkspaceToDelete(null);
              }}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
            >
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}