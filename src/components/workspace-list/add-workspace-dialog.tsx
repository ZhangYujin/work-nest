import { useState, useEffect, useRef } from 'react';
import { FolderOpen, AlertTriangle } from 'lucide-react';
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
import { useWorkspaceStore } from '../../store/workspace-store';
import { useLocale } from '../../i18n';
import { getScanDirectories } from '../../utils/commands';
import { cn } from '../../lib/utils';
import type { CreateWorkspaceRequest, Tag, ScanDirectory } from '../../types';

interface AddWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddWorkspaceDialog({ open, onOpenChange }: AddWorkspaceDialogProps) {
  const { t } = useLocale();
  const { tags, addWorkspace, restoreWorkspace } = useWorkspaceStore();
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>(['qoder']);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [scanDirs, setScanDirs] = useState<ScanDirectory[]>([]);
  const [showQuickSelect, setShowQuickSelect] = useState(false);
  const pathRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  useEffect(() => {
    if (open) {
      getScanDirectories().then(setScanDirs).catch(() => {});
    }
  }, [open]);

  const tools = ['opencode', 'claude', 'vscode', 'idea'];

  const handleBrowse = async (defaultPath?: string) => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: 'Select Workspace Directory',
      defaultPath,
    });

    if (selected && typeof selected === 'string') {
      setPath(selected);
      const dirName = selected.split('/').pop() || '';
      setName(dirName);
    }
  };

  const handleQuickSelect = async (dir: ScanDirectory) => {
    setShowQuickSelect(false);
    await handleBrowse(dir.path);
  };

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const toggleTag = (tag: Tag) => {
    setSelectedTags((prev) =>
      prev.find((t) => t.id === tag.id)
        ? prev.filter((t) => t.id !== tag.id)
        : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!path) return;

    setError(null);

    const request: CreateWorkspaceRequest = {
      path,
      name: name || undefined,
      description: description || undefined,
      tools: selectedTools,
      tags: selectedTags,
      source: 'manual',
    };

    try {
      await addWorkspace(request);
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      const errMsg = String(err?.message ?? err);

      // Already in list (deleted = 0)
      if (errMsg.includes('already exists')) {
        setError('该工作空间已在列表中，无需重复添加');
        return;
      }

      // Was deleted (deleted = 1) -> show confirm dialog
      if (errMsg.includes('was deleted')) {
        setConfirmRestore(true);
        return;
      }

      // Other errors
      setError(`添加失败：${errMsg}`);
    }
  };

  const handleConfirmRestore = async () => {
    const request: CreateWorkspaceRequest = {
      path,
      name: name || undefined,
      description: description || undefined,
      tools: selectedTools,
      tags: selectedTags,
      source: 'manual',
    };

    try {
      await restoreWorkspace(request);
      setConfirmRestore(false);
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      setError(`恢复失败：${String(err?.message ?? err)}`);
    }
  };

  const resetForm = () => {
    setPath('');
    setName('');
    setDescription('');
    setSelectedTools(['opencode']);
    setSelectedTags([]);
    setError(null);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.add_workspace}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.directory_path}</label>
            <div className="flex gap-2">
              <Input
                ref={pathRef}
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onFocus={() => {
                  if (!path && scanDirs.length > 0) setShowQuickSelect(true);
                }}
                placeholder="/path/to/workspace"
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={() => handleBrowse()}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            {showQuickSelect && !path && scanDirs.length > 0 && (
              <div className="rounded-md border border-border bg-background py-1 shadow-lg">
                {scanDirs.map((dir) => (
                  <button
                    key={dir.id}
                    onClick={() => handleQuickSelect(dir)}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent text-foreground/70"
                  >
                    <span className="font-medium">{dir.name || dir.path}</span>
                    <span className="ml-2 text-xs text-muted-foreground font-mono">{dir.path}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t.name}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.name_placeholder}
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
                  const selected = selectedTags.find((t) => t.id === tag.id);
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

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={!path}>
            {t.add}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Confirm Restore Dialog */}
    <Dialog open={confirmRestore} onOpenChange={setConfirmRestore}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            该工作空间已被删除
          </DialogTitle>
          <DialogDescription className="pt-2">
            此目录之前已添加过但被标记为已删除。是否要重新添加回来？
            <br /><br />
            <span className="text-muted-foreground font-mono text-xs">{path}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setConfirmRestore(false)}>
            取消
          </Button>
          <Button onClick={handleConfirmRestore}>
            确认恢复
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
