import { useState } from 'react';
import { Plus, Pencil, Trash2, Tag as TagIcon } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspace-store';
import { createTag, updateTag, deleteTag } from '../../utils/commands';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { useLocale } from '../../i18n';
import { PRESET_COLORS } from '../../lib/utils';
import type { Tag } from '../../types';

export default function TagsPage() {
  const { t } = useLocale();
  const { tags, fetchTags, workspaces, fetchWorkspaces } = useWorkspaceStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(PRESET_COLORS[0]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const isTagInUse = (tagId: string) =>
    workspaces.some((w) => w.tags.some((tag) => tag.id === tagId));

  const handleAdd = () => {
    setEditingTag(null);
    setTagName('');
    setTagColor(PRESET_COLORS[0]);
    setDialogOpen(true);
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (isTagInUse(id)) {
      showToast(t.tag_in_use);
      setDeleteConfirm(null);
      return;
    }
    try {
      await deleteTag(id);
      await fetchTags();
      await fetchWorkspaces();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete tag:', error);
      showToast(String(error));
    }
  };

  const handleSubmit = async () => {
    if (!tagName.trim()) return;

    try {
      if (editingTag) {
        await updateTag(editingTag.id, tagName, tagColor);
      } else {
        await createTag(tagName, tagColor);
      }
      await fetchTags();
      await fetchWorkspaces();
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save tag:', error);
      showToast(String(error));
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Draggable title bar region */}
      <div 
        data-tauri-drag-region
        className="h-12 w-full drag-region shrink-0"
      />

      <div className="flex-1 px-8 pb-4 overflow-hidden">
        <div className="h-full flex flex-col">
          {toast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg bg-popover text-popover-foreground text-sm shadow-lg border">
              {toast}
            </div>
          )}
          <div className="flex items-start justify-between pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.tags_title}</h1>
        </div>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="mr-1 h-4 w-4" />
          {t.add_tag}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tags.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center space-y-3">
            <div className="rounded-full bg-muted p-4">
              <TagIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">{t.empty_tags}</p>
            <p className="text-sm text-muted-foreground">{t.empty_tags_desc}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="group rounded-lg border p-3 hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="font-medium">{tag.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEdit(tag)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {deleteConfirm === tag.id ? (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDelete(tag.id)}
                      >
                        ✓
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:text-destructive disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        disabled={isTagInUse(tag.id)}
                        title={isTagInUse(tag.id) ? t.tag_in_use : t.delete}
                        onClick={() => {
                          setDeleteConfirm(tag.id);
                          setTimeout(() => setDeleteConfirm(null), 3000);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTag ? t.edit_tag : t.add_tag}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.tag_name}</label>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Tag name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t.tag_color}</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setTagColor(color)}
                    className="h-8 w-8 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: color,
                      borderColor: tagColor === color ? color : 'transparent',
                      boxShadow: tagColor === color ? `0 0 0 2px ${color}40` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Preview</label>
              <div className="flex items-center">
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: tagColor, color: '#fff' }}
                >
                  {tagName || 'Tag'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleSubmit} disabled={!tagName.trim()}>
              {t.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}
