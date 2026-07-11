import { useState, useEffect } from 'react';
import { Copy, Check, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useWorkspaceStore } from '../../store/workspace-store';
import { useLocale } from '../../i18n';
import { readWorkspaceJson, writeWorkspaceJson } from '../../utils/commands';
import { cn } from '../../lib/utils';
import type { Workspace, Tag } from '../../types';

interface EditWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
}

interface KVPair {
  key: string;
  value: string;
  isFixed?: boolean;
}

export default function EditWorkspaceDialog({
  open,
  onOpenChange,
  workspace,
}: EditWorkspaceDialogProps) {
  const { t } = useLocale();
  const { tags, updateWorkspace } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<'basic' | 'json'>('basic');
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description);
  const [status, setStatus] = useState(workspace.status);
  const [selectedTools, setSelectedTools] = useState<string[]>(workspace.tools);
  const [selectedTags, setSelectedTags] = useState<Tag[]>(workspace.tags);
  const [kvPairs, setKvPairs] = useState<KVPair[]>([]);
  const [copied, setCopied] = useState(false);

  // JSON tab state
  const [jsonName, setJsonName] = useState(workspace.name);
  const [jsonStatus, setJsonStatus] = useState<'active' | 'archived' | 'deprecated'>(workspace.status as any);
  const [jsonTools, setJsonTools] = useState<string[]>(workspace.tools);
  const [jsonDescription, setJsonDescription] = useState(workspace.description);

  useEffect(() => {
    if (open) {
      setName(workspace.name);
      setDescription(workspace.description);
      setStatus(workspace.status);
      setSelectedTools(workspace.tools);
      setSelectedTags(workspace.tags);
      setJsonName(workspace.name);
      setJsonStatus(workspace.status);
      setJsonTools(workspace.tools);
      setJsonDescription(workspace.description);
      loadWorkspaceJson();
    }
  }, [open, workspace]);

  const loadWorkspaceJson = async () => {
    try {
      const content = await readWorkspaceJson(workspace.id);
      const parsed = JSON.parse(content);
      const pairs: KVPair[] = [];

      // Fixed fields
      if ('name' in parsed) {
        setJsonName(String(parsed.name));
      }
      if ('status' in parsed) {
        setJsonStatus(String(parsed.status) as any);
      }
      if ('tools' in parsed) {
        setJsonTools(Array.isArray(parsed.tools) ? parsed.tools : []);
      }
      if ('description' in parsed) {
        setJsonDescription(String(parsed.description));
      }

      // Custom fields (exclude fixed fields and name/tags)
      for (const [key, value] of Object.entries(parsed)) {
        if (!['status', 'tools', 'description', 'name', 'tags'].includes(key)) {
          pairs.push({ key, value: typeof value === 'string' ? value : JSON.stringify(value) });
        }
      }

      setKvPairs(pairs);
    } catch (error) {
      console.error('Failed to load workspace.json:', error);
      setKvPairs([]);
    }
  };

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const toggleJsonTool = (tool: string) => {
    setJsonTools((prev) =>
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

  const handleCopyPath = async () => {
    await navigator.clipboard.writeText(workspace.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateKVPair = (index: number, field: 'key' | 'value', val: string) => {
    setKvPairs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const addKVPair = () => {
    setKvPairs((prev) => [...prev, { key: '', value: '' }]);
  };

  const removeKVPair = (index: number) => {
    setKvPairs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveJson = async () => {
    try {
      const obj: Record<string, any> = {};
      obj.name = jsonName;
      obj.status = jsonStatus;
      obj.tools = jsonTools;
      obj.description = jsonDescription;
      for (const pair of kvPairs) {
        if (pair.key) {
          if (pair.key === 'tools') {
            try {
              obj[pair.key] = JSON.parse(pair.value);
            } catch {
              obj[pair.key] = pair.value.split(',').map((s) => s.trim());
            }
          } else {
            obj[pair.key] = pair.value;
          }
        }
      }
      obj.tags = selectedTags;

      // 1. Write to workspace.json file
      await writeWorkspaceJson(workspace.id, JSON.stringify(obj, null, 2));

      // 2. Also update the database with the basic fields
      await updateWorkspace(workspace.id, {
        name: jsonName,
        description: jsonDescription,
        status: jsonStatus as any,
        tools: jsonTools,
        tags: selectedTags,
      });

      // 3. Close the dialog
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to write workspace.json:', error);
    }
  };

  const handleSaveBasic = async () => {
    try {
      await updateWorkspace(workspace.id, {
        name,
        description,
        status: status as any,
        tools: selectedTools,
        tags: selectedTags,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update workspace:', error);
    }
  };

  const tools = ['opencode', 'claude', 'vscode', 'idea'];
  const statuses = ['active', 'archived', 'deprecated'];

  const statusLabels: Record<string, string> = {
    active: t.status_active,
    archived: t.status_archived,
    deprecated: t.status_deprecated,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base">{t.edit} {workspace.name}</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('basic')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === 'basic'
                ? 'border-primary text-primary bg-background'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {t.basic_info}
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === 'json'
                ? 'border-primary text-primary bg-background'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            workspace.json
          </button>
        </div>

        {activeTab === 'basic' ? (
          <div className="space-y-3 py-3 overflow-y-auto pr-1">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t.name}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.name_placeholder}
                className="h-8 text-sm w-full"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">{t.description}</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.description_placeholder}
                className="h-8 text-sm w-full"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">{t.status_label}</label>
              <div className="flex gap-2">
                {statuses.map((s) => (
                  <Button
                    key={s}
                    variant={status === s ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatus(s as any)}
                    className="h-7 text-sm"
                  >
                    {statusLabels[s]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">{t.associate_tools}</label>
              <div className="flex flex-wrap gap-2">
                {tools.map((tool) => (
                  <Button
                    key={tool}
                    variant={selectedTools.includes(tool) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleTool(tool)}
                    className="h-7 text-sm capitalize"
                  >
                    {tool}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">{t.select_tags}</label>
              <div className="flex flex-wrap gap-2">
                {tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.empty_tags}</p>
                ) : (
                  tags.map((tag) => {
                    const selected = selectedTags.find((t) => t.id === tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          'rounded-full px-3 py-1 text-sm font-medium transition-all',
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

            <div className="space-y-1">
              <label className="text-sm font-medium">{t.path_readonly}</label>
              <div className="flex gap-2">
                <Input value={workspace.path} readOnly className="flex-1 font-mono text-sm h-8" />
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopyPath}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-3 overflow-y-auto pr-1">
            {/* Basic info with button selection */}
            <div className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-2.5">
              <p className="text-sm text-muted-foreground">{t.basic_info}</p>

              {/* Name - first */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium w-20 shrink-0">{t.name}</label>
                <Input
                  value={jsonName}
                  onChange={(e) => setJsonName(e.target.value)}
                  placeholder={t.name_placeholder}
                  className="h-8 text-sm flex-1"
                />
              </div>

              {/* Description */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium w-20 shrink-0">{t.description}</label>
                <Input
                  value={jsonDescription}
                  onChange={(e) => setJsonDescription(e.target.value)}
                  placeholder={t.description_placeholder}
                  className="h-8 text-sm flex-1"
                />
              </div>

              {/* Status */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium w-20 shrink-0">{t.status_label}</label>
                <div className="flex gap-2 flex-1">
                  {statuses.map((s) => (
                    <Button
                      key={s}
                      variant={jsonStatus === s ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setJsonStatus(s as any)}
                      className="h-7 text-sm"
                    >
                      {statusLabels[s]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tools */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium w-20 shrink-0">{t.associate_tools}</label>
                <div className="flex flex-wrap gap-2 flex-1">
                  {tools.map((tool) => (
                    <Button
                      key={tool}
                      variant={jsonTools.includes(tool) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleJsonTool(tool)}
                      className="h-7 text-sm capitalize"
                    >
                      {tool}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom fields */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t.custom_fields}</p>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addKVPair}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {kvPairs.map((pair) => {
                const actualIndex = kvPairs.indexOf(pair);
                return (
                  <div key={actualIndex} className="flex items-center gap-2">
                    <Input
                      value={pair.key}
                      onChange={(e) => updateKVPair(actualIndex, 'key', e.target.value)}
                      placeholder="key"
                      className="h-8 text-sm w-28"
                    />
                    <Input
                      value={pair.value}
                      onChange={(e) => updateKVPair(actualIndex, 'value', e.target.value)}
                      placeholder="value"
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive"
                      onClick={() => removeKVPair(actualIndex)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button size="sm" onClick={activeTab === 'basic' ? handleSaveBasic : handleSaveJson}>
            {t.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
