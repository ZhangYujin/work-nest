import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspace-store';
import { getScanDirectories } from '../../utils/commands';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useLocale } from '../../i18n';
import AddWorkspaceDialog from './add-workspace-dialog';
import { WorkspaceList } from './workspace-list';
import type { WorkspaceFilter, ScanDirectory } from '../../types';
import { cn } from '../../lib/utils';

// FilterDropdown 组件
const FilterDropdown = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="h-8 min-w-[90px] justify-between border-border/60 bg-background text-[13px] text-foreground/80 shadow-sm hover:border-foreground/30"
      >
        <span>{options.find((o) => o.value === value)?.label || label}</span>
        <ChevronDown className="h-3.5 w-3.5 ml-1.5 opacity-70" />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[110px] rounded-md border border-border bg-background py-1 shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value === 'all' ? undefined : option.value);
                setOpen(false);
              }}
              className={cn(
                'w-full px-3 py-1.5 text-left text-sm hover:bg-accent',
                value === option.value || (option.value === 'all' && !value)
                  ? 'text-foreground font-medium'
                  : 'text-foreground/70'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function WorkspacesPage() {
  const { t } = useLocale();
  const filter = useWorkspaceStore(state => state.filter);
  const setFilter = useWorkspaceStore(state => state.setFilter);
  const setFilterWithoutDebounce = useWorkspaceStore(state => state.setFilterWithoutDebounce);
  const fetchWorkspaces = useWorkspaceStore(state => state.fetchWorkspaces);
  const lastAddedWorkspaceName = useWorkspaceStore(state => state.lastAddedWorkspaceName);
  const clearLastAddedWorkspaceName = useWorkspaceStore(state => state.clearLastAddedWorkspaceName);
  const tags = useWorkspaceStore(state => state.tags);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [scanDirs, setScanDirs] = useState<ScanDirectory[]>([]);
  const [localSearch, setLocalSearch] = useState(filter.search || '');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<number | undefined>(undefined);

  const tools = [
    { key: 'opencode', name: 'Opencode' },
    { key: 'claude', name: 'Claude' },
    { key: 'idea', name: 'IDEA' },
    { key: 'vscode', name: 'VSCode' },
  ];

  // 同步 store 中的 filter 到本地状态
  useEffect(() => {
    if (filter.search !== localSearch) {
      setLocalSearch(filter.search || '');
    }
  }, [filter.search]);

  // 处理搜索输入
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    
    // 清除之前的定时器
    if (debounceTimerRef.current !== undefined) {
      window.clearTimeout(debounceTimerRef.current);
    }
    
    // 设置新的定时器
    debounceTimerRef.current = window.setTimeout(() => {
      setFilter({ search: value });
      fetchWorkspaces();
    }, 200);
  }, [setFilter, fetchWorkspaces]);

  // 处理输入法开始
  const handleCompositionStart = useCallback(() => {
    // 可以在这里添加一些逻辑
  }, []);

  // 处理输入法结束
  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    const value = (e.target as HTMLInputElement).value;
    setLocalSearch(value);
    
    // 清除之前的定时器
    if (debounceTimerRef.current !== undefined) {
      window.clearTimeout(debounceTimerRef.current);
    }
    
    // 设置新的定时器
    debounceTimerRef.current = window.setTimeout(() => {
      setFilter({ search: value });
      fetchWorkspaces();
    }, 200);
  }, [setFilter, fetchWorkspaces]);

  // 初始化时和筛选器变化时（除了搜索）获取工作空间
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== undefined) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 处理添加工作空间后的逻辑
  useEffect(() => {
    if (lastAddedWorkspaceName && searchInputRef.current) {
      setLocalSearch(lastAddedWorkspaceName);
      setFilter({ search: lastAddedWorkspaceName });
      fetchWorkspaces();
      // 等待下一次渲染后选中文字
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
        clearLastAddedWorkspaceName();
      }, 50);
    }
  }, [lastAddedWorkspaceName, setFilter, fetchWorkspaces, clearLastAddedWorkspaceName]);

  useEffect(() => {
    getScanDirectories().then(setScanDirs).catch(() => {});
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Draggable title bar region */}
      <div 
        data-tauri-drag-region
        className="h-12 w-full drag-region shrink-0"
      />

      <div className="flex-1 px-8 pb-4 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="flex items-start justify-between pb-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{t.workspace_title}</h1>
              <p className="text-xs text-muted-foreground mt-1">{t.workspace_subtitle}</p>
            </div>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              {t.add_workspace}
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="space-y-3 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={t.search}
                className="h-8 pl-8 text-[13px]"
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <FilterDropdown
                label={t.filter_status}
                value={filter.status}
                options={[
                  { value: 'all', label: t.status_all },
                  { value: 'active', label: t.status_active },
                  { value: 'archived', label: t.status_archived },
                  { value: 'deprecated', label: t.status_deprecated },
                ]}
                onChange={(value) => setFilterWithoutDebounce({ status: value })}
              />

              <FilterDropdown
                label={t.filter_type}
                value={filter.project_type}
                options={[
                  { value: 'all', label: t.type_all },
                  { value: 'directory', label: t.type_directory },
                  { value: 'git', label: t.type_git },
                  { value: 'multi_git', label: t.type_multi_git },
                ]}
                onChange={(value) => setFilterWithoutDebounce({ project_type: value })}
              />

               <FilterDropdown
                  label={t.filter_tool}
                  value={filter.tool}
                  options={[
                    { value: 'all', label: t.type_all },
                    ...tools.map((tool) => ({ value: tool.key, label: tool.name })),
                  ]}
                  onChange={(value) => setFilterWithoutDebounce({ tool: value })}
                />

              {scanDirs.length > 0 && (
                <FilterDropdown
                  label={t.filter_scan_dir}
                  value={filter.scan_dir_path}
                  options={[
                    { value: 'all', label: t.all_scan_dirs },
                    ...scanDirs.map((dir) => ({ value: dir.path, label: dir.name || dir.path })),
                  ]}
                  onChange={(value) => setFilterWithoutDebounce({ scan_dir_path: value })}
                />
              )}

              {tags.length > 0 && (
                <FilterDropdown
                  label={t.filter_tag}
                  value={filter.tag}
                  options={[
                    { value: 'all', label: t.type_all },
                    ...tags.map((tag) => ({ value: tag.name, label: tag.name })),
                  ]}
                  onChange={(value) => setFilterWithoutDebounce({ tag: value })}
                />
              )}

              <FilterDropdown
                label={t.sort_by}
                value={filter.sort_by}
                options={[
                  { value: 'name', label: t.sort_name },
                  { value: 'last_opened_at', label: t.sort_opened },
                  { value: 'updated_at', label: t.sort_updated },
                  { value: 'open_count', label: t.sort_count },
                ]}
                onChange={(value) => {
                  const sortBy = value as WorkspaceFilter['sort_by'];
                  const sortOrder = sortBy === 'name' ? 'asc' : 'desc';
                  setFilterWithoutDebounce({ sort_by: sortBy, sort_order: sortOrder });
                }}
              />

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-border/60 bg-background shadow-sm hover:border-foreground/30"
                onClick={() =>
                  setFilterWithoutDebounce({ sort_order: filter.sort_order === 'asc' ? 'desc' : 'asc' })
                }
                title={filter.sort_order === 'asc' ? t.sort_asc : t.sort_desc}
              >
                {filter.sort_order === 'asc' ? (
                  <ArrowUp className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Workspace List */}
          <WorkspaceList />
        </div>
      </div>

      <AddWorkspaceDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}