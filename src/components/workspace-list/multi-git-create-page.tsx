import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  FolderTree,
  GitBranch,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  RefreshCw,
  Search,
} from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { useWorkspaceStore } from '../../store/workspace-store';
import { useAppStore } from '../../store/app-store';
import { useLocale } from '../../i18n';
import { getWorkspaces, getScanDirectories, listGitBranches } from '../../utils/commands';
import { cn, formatTimestamp } from '../../lib/utils';
import type {
  CreateWorktreeWorkspaceRequest,
  CreateWorktreeResult,
  WorktreeProjectInput,
  Tag,
  ScanDirectory,
  Workspace,
} from '../../types';

// Per-row base-branch dropdown. Disabled until the project is selected and its
// branches have been fetched.
const BranchDropdown = ({
  options,
  value,
  loading,
  disabled,
  placeholder,
  onChange,
}: {
  options: string[];
  value: string;
  loading: boolean;
  disabled: boolean;
  placeholder: string;
  onChange: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          'flex h-7 items-center gap-1 rounded-md border border-border/60 bg-background px-2 text-xs text-foreground/80 shadow-sm',
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-foreground/30'
        )}
      >
        {loading ? (
          <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <GitBranch className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="max-w-[120px] truncate font-mono">
          {value || placeholder}
        </span>
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open && !disabled && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[150px] max-h-56 overflow-y-auto rounded-md border border-border bg-background py-1 shadow-lg">
          {options.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">{placeholder}</div>
          ) : (
            options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={cn(
                  'block w-full truncate px-3 py-1.5 text-left font-mono text-xs hover:bg-accent',
                  value === opt ? 'text-foreground font-medium' : 'text-foreground/70'
                )}
                title={opt}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// Scan-directory dropdown (the "working directory").
const WorkingDirDropdown = ({
  options,
  value,
  placeholder,
  onChange,
}: {
  options: ScanDirectory[];
  value: string;
  placeholder: string;
  onChange: (dir: ScanDirectory) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((d) => d.path === value);

  return (
    <div className="relative flex-1" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-full items-center justify-between rounded-md border border-border/60 bg-background px-3 text-[13px] text-foreground/80 shadow-sm hover:border-foreground/30"
      >
        <span className="flex items-center gap-2 truncate">
          <FolderTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{selected ? (selected.name || selected.path) : placeholder}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-full rounded-md border border-border bg-background py-1 shadow-lg">
          {options.map((dir) => (
            <button
              key={dir.id}
              onClick={() => {
                onChange(dir);
                setOpen(false);
              }}
              className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-accent"
            >
              <span className="truncate text-sm text-foreground/80">{dir.name || dir.path}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">{dir.path}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function MultiGitCreatePage() {
  const { t } = useLocale();
  const { setCurrentPage } = useAppStore();
  const { tags, addWorktreeWorkspace } = useWorkspaceStore();

  // Basic info
  const [scanDirs, setScanDirs] = useState<ScanDirectory[]>([]);
  const [workingDir, setWorkingDir] = useState('');
  const [selectedScanDirPath, setSelectedScanDirPath] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>(['qoder']);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  // Branch (the new branch to create, shared across all selected projects)
  const [branchInput, setBranchInput] = useState('');
  const [branchPreview, setBranchPreview] = useState('');

  // Git projects + per-project base branch
  const [gitProjects, setGitProjects] = useState<Workspace[]>([]);
  const [selectedProjectPaths, setSelectedProjectPaths] = useState<string[]>([]);
  const [projectBranches, setProjectBranches] = useState<Record<string, string[]>>({});
  const [projectBaseBranch, setProjectBaseBranch] = useState<Record<string, string>>({});
  const [branchLoading, setBranchLoading] = useState<Record<string, boolean>>({});
  const [projectSearch, setProjectSearch] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [worktreeResult, setWorktreeResult] = useState<CreateWorktreeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tools = ['opencode', 'claude', 'vscode', 'idea'];

  useEffect(() => {
    getScanDirectories().then(setScanDirs).catch(() => {});
    getWorkspaces({ project_type: 'git' }).then(setGitProjects).catch(() => {});
  }, []);

  // Refresh the final-branch-name preview whenever the user-typed part changes.
  useEffect(() => {
    const trimmed = branchInput.trim();
    if (!trimmed) {
      setBranchPreview('');
      return;
    }
    setBranchPreview(`${trimmed}_${formatTimestamp()}`);
  }, [branchInput]);

  // Open the OS directory picker (optionally defaulted to a scan dir) and let the
  // user create / select a folder. The chosen folder becomes the working directory;
  // its basename auto-fills the workspace name.
  const pickWorkingDirectory = async (baseDir?: string) => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: 'Select / Create Working Directory',
      defaultPath: baseDir,
    });
    if (selected && typeof selected === 'string') {
      setWorkingDir(selected);
      const baseName = selected.split('/').pop() || '';
      setName(baseName);
    }
  };

  const handleWorkingDirSelect = (dir: ScanDirectory) => {
    setSelectedScanDirPath(dir.path);
    // Pop up the picker defaulted to the scan dir so the user can create a new
    // subfolder under it as the working directory.
    pickWorkingDirectory(dir.path);
  };

  const handleBrowseWorkingDir = () => {
    pickWorkingDirectory(workingDir || selectedScanDirPath || undefined);
  };

  // Quick filter for the git project list.
  const filteredProjects = gitProjects.filter((p) => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q);
  });

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((x) => x !== tool) : [...prev, tool]
    );
  };

  const toggleTag = (tag: Tag) => {
    setSelectedTags((prev) =>
      prev.find((x) => x.id === tag.id)
        ? prev.filter((x) => x.id !== tag.id)
        : [...prev, tag]
    );
  };

  const ensureBranches = async (projectPath: string) => {
    if (projectBranches[projectPath] || branchLoading[projectPath]) return;
    setBranchLoading((prev) => ({ ...prev, [projectPath]: true }));
    try {
      const branches = await listGitBranches(projectPath);
      setProjectBranches((prev) => ({ ...prev, [projectPath]: branches }));
      const def = branches.includes('origin/master')
        ? 'origin/master'
        : branches.includes('master')
          ? 'master'
          : '';
      setProjectBaseBranch((prev) => ({ ...prev, [projectPath]: def }));
    } catch {
      setProjectBranches((prev) => ({ ...prev, [projectPath]: [] }));
    } finally {
      setBranchLoading((prev) => ({ ...prev, [projectPath]: false }));
    }
  };

  const toggleProject = (projectPath: string) => {
    setSelectedProjectPaths((prev) => {
      if (prev.includes(projectPath)) {
        return prev.filter((p) => p !== projectPath);
      }
      // Fetch branches on first select.
      ensureBranches(projectPath);
      return [...prev, projectPath];
    });
  };

  const setBaseFor = (projectPath: string, branch: string) => {
    setProjectBaseBranch((prev) => ({ ...prev, [projectPath]: branch }));
  };

  const allBasesSelected = selectedProjectPaths.every(
    (p) => !!projectBaseBranch[p]
  );

  const submitDisabled =
    !workingDir ||
    !name.trim() ||
    !branchInput.trim() ||
    selectedProjectPaths.length === 0 ||
    !allBasesSelected ||
    submitting;

  const handleSubmit = async () => {
    if (submitDisabled) return;
    setError(null);
    setSubmitting(true);

    // workingDir is the full target folder the user created/selected; split it
    // back into parent_path + name for the backend (target = parent/name).
    const segs = workingDir.split('/').filter(Boolean);
    const folderName = segs.pop() || name.trim();
    const parentPath = (workingDir.startsWith('/') ? '/' : '') + segs.join('/');

    const finalBranch = `${branchInput.trim()}_${formatTimestamp()}`;
    const projects: WorktreeProjectInput[] = selectedProjectPaths.map((p) => ({
      path: p,
      base_branch: projectBaseBranch[p],
    }));

    const request: CreateWorktreeWorkspaceRequest = {
      parent_path: parentPath,
      name: folderName,
      description: description || undefined,
      tools: selectedTools,
      tags: selectedTags,
      branch: finalBranch,
      projects,
    };

    try {
      const result = await addWorktreeWorkspace(request);
      resetForm();
      if (result.failure_count > 0) {
        setWorktreeResult(result);
      } else {
        setCurrentPage('workspaces');
      }
    } catch (err: any) {
      const errMsg = String(err?.message ?? err);
      if (errMsg.includes('already exists')) {
        setError('该目录已是工作空间或目标目录已存在');
      } else {
        setError(`创建失败：${errMsg}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setWorkingDir('');
    setSelectedScanDirPath('');
    setName('');
    setDescription('');
    setSelectedTools(['opencode']);
    setSelectedTags([]);
    setBranchInput('');
    setSelectedProjectPaths([]);
    setProjectBranches({});
    setProjectBaseBranch({});
    setBranchLoading({});
    setProjectSearch('');
    setError(null);
  };

  const handleBack = () => setCurrentPage('workspaces');

  return (
    <div className="flex h-full flex-col">
      {/* Draggable title bar region */}
      <div data-tauri-drag-region className="h-12 w-full drag-region shrink-0" />

      <div className="flex-1 px-8 pb-4 overflow-y-auto">
        <div className="pb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{t.multi_git_create_title}</h1>
              <p className="text-xs text-muted-foreground mt-1">{t.multi_git_create_subtitle}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t.back_to_workspaces}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Card A · Basic info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.basic_info}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.working_directory}</label>
                <div className="flex gap-2">
                  {scanDirs.length > 0 && (
                    <WorkingDirDropdown
                      options={scanDirs}
                      value={selectedScanDirPath}
                      placeholder={t.working_directory_placeholder}
                      onChange={handleWorkingDirSelect}
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBrowseWorkingDir}
                    title={t.working_directory}
                  >
                    <FolderTree className="h-4 w-4" />
                  </Button>
                </div>
                {workingDir && (
                  <p className="truncate font-mono text-xs text-muted-foreground">{workingDir}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.name}</label>
                <Input
                  value={name}
                  readOnly
                  placeholder={t.name_placeholder}
                  className="bg-muted/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.description}</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.description_placeholder}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.associate_tools}</label>
                <div className="flex flex-wrap gap-2">
                  {tools.map((tool) => (
                    <Button
                      key={tool}
                      variant={selectedTools.includes(tool) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleTool(tool)}
                      className="h-7 text-xs capitalize"
                    >
                      {tool}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.select_tags}</label>
                <div className="flex flex-wrap gap-2">
                  {tags.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t.empty_tags}</p>
                  ) : (
                    tags.map((tag) => {
                      const selected = selectedTags.find((x) => x.id === tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag)}
                          className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-medium transition-all',
                            selected ? 'opacity-100' : 'opacity-60 hover:opacity-100'
                          )}
                          style={{
                            backgroundColor: selected ? tag.color : tag.color + '20',
                            color: selected ? '#fff' : tag.color,
                            boxShadow: selected ? `0 0 0 2px ${tag.color}40` : 'none',
                          }}
                        >
                          {tag.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card B · Select git projects & branch (merged) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t.projects_and_branch}</CardTitle>
                {selectedProjectPaths.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t.selected_count.replace('{count}', String(selectedProjectPaths.length))}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New branch (shared) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.branch_name}</label>
                <div className="flex gap-2">
                  <GitBranch className="h-4 w-4 mt-2.5 text-muted-foreground" />
                  <Input
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    placeholder={t.branch_name_placeholder}
                    className="flex-1"
                  />
                </div>
                {branchPreview && (
                  <p className="text-xs text-muted-foreground">
                    {t.branch_final_name}：
                    <span className="font-mono text-foreground/80">{branchPreview}</span>
                  </p>
                )}
              </div>

              {/* Git project list with per-row base branch */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
                  <span className="flex-1">{t.select_git_projects}</span>
                  <span>{t.base_branch}</span>
                </div>

                {/* Search box */}
                {gitProjects.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder={t.search}
                      className="h-8 pl-8 text-[13px]"
                    />
                  </div>
                )}

                <ScrollArea className="h-80 rounded-md border border-border">
                  {gitProjects.length === 0 ? (
                    <div className="p-3">
                      <p className="text-xs font-medium text-foreground/70">{t.no_git_projects}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t.no_git_projects_desc}</p>
                    </div>
                  ) : filteredProjects.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">{t.no_projects}</div>
                  ) : (
                    filteredProjects.map((p) => {
                      const selected = selectedProjectPaths.includes(p.path);
                      const branches = projectBranches[p.path] || [];
                      const baseValue = projectBaseBranch[p.path] || '';
                      const loading = !!branchLoading[p.path];
                      return (
                        <div
                          key={p.id}
                          className={cn(
                            'flex items-start gap-2 border-b border-border/40 px-3 py-2 last:border-0 hover:bg-accent/40',
                            selected && 'bg-accent/30'
                          )}
                        >
                          <button
                            onClick={() => toggleProject(p.path)}
                            className="mt-0.5 flex shrink-0 items-center"
                          >
                            <span
                              className={cn(
                                'flex h-4 w-4 items-center justify-center rounded-[2px] border',
                                selected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-muted-foreground/40'
                              )}
                            >
                              {selected && <Check className="h-3 w-3" />}
                            </span>
                          </button>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground/90">{p.name}</p>
                            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                              {p.path}
                            </p>
                          </div>

                          <div className="shrink-0">
                            <BranchDropdown
                              options={branches}
                              value={baseValue}
                              loading={loading}
                              disabled={!selected}
                              placeholder={
                                !selected
                                  ? t.base_branch
                                  : branches.length === 0 && !loading
                                    ? t.base_branch_none
                                    : t.base_branch_select
                              }
                              onChange={(v) => setBaseFor(p.path, v)}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </ScrollArea>
                {selectedProjectPaths.length > 0 && !allBasesSelected && (
                  <p className="px-1 text-xs text-amber-600 dark:text-amber-400">
                    {t.base_branch_select}
                  </p>
                )}

                {/* Selected projects summary */}
                {selectedProjectPaths.length > 0 && (
                  <div className="rounded-md border border-border/60 bg-muted/20">
                    <div className="border-b border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {t.selected_count.replace('{count}', String(selectedProjectPaths.length))}
                    </div>
                    <div className="divide-y divide-border/30">
                      {selectedProjectPaths.map((path) => {
                        const proj = gitProjects.find((p) => p.path === path);
                        const base = projectBaseBranch[path] || '';
                        return (
                          <div
                            key={path}
                            className="flex items-start gap-2 px-3 py-1.5 text-xs"
                          >
                            <GitBranch className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground/90">
                                {proj?.name || path.split('/').pop() || path}
                              </p>
                              <p className="mt-0.5 truncate font-mono text-muted-foreground">
                                {path}
                              </p>
                            </div>
                            <span className="ml-auto shrink-0 font-mono text-muted-foreground">
                              {base || t.base_branch_select}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pb-4">
            <Button variant="outline" onClick={handleBack}>
              {t.cancel}
            </Button>
            <Button onClick={handleSubmit} disabled={submitDisabled}>
              {submitting ? t.loading : t.create}
            </Button>
          </div>
        </div>
      </div>

      {/* Worktree creation result dialog (partial failures) */}
      <Dialog open={!!worktreeResult} onOpenChange={(o) => !o && setWorktreeResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {worktreeResult?.failure_count === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              {t.worktree_result_title}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {worktreeResult?.failure_count === 0
                ? t.worktree_all_success
                : t.worktree_partial_success}
              <br />
              <span className="text-muted-foreground">
                {t.worktree_success_count.replace('{count}', String(worktreeResult?.success_count ?? 0))}
                {' · '}
                {t.worktree_failure_count.replace('{count}', String(worktreeResult?.failure_count ?? 0))}
              </span>
            </DialogDescription>
          </DialogHeader>
          {worktreeResult && worktreeResult.failure_count > 0 && (
            <ScrollArea className="max-h-60 rounded-md border border-border">
              {worktreeResult.results
                .filter((r) => !r.success)
                .map((r) => (
                  <div key={r.path} className="border-b border-border/40 px-3 py-2 text-sm last:border-0">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                      <span className="truncate font-medium">{r.name}</span>
                    </div>
                    <p className="mt-1 ml-6 break-all font-mono text-xs text-muted-foreground">{r.path}</p>
                    {r.error && (
                      <p className="mt-1 ml-6 break-all text-xs text-red-500/80">{r.error}</p>
                    )}
                  </div>
                ))}
            </ScrollArea>
          )}
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => {
                setWorktreeResult(null);
                setCurrentPage('workspaces');
              }}
            >
              {t.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
