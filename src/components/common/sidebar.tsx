import { FolderOpen, BarChart3, Tag, Settings, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useAppStore } from '../../store/app-store';
import { cn } from '../../lib/utils';
import { useLocale } from '../../i18n';
import type { Translations } from '../../i18n/locales';

const navItems: { id: 'workspaces' | 'report' | 'tags'; icon: any; labelKey: keyof Translations }[] = [
  { id: 'workspaces', icon: FolderOpen, labelKey: 'workspaces' },
  { id: 'report', icon: BarChart3, labelKey: 'report' },
  { id: 'tags', icon: Tag, labelKey: 'tags' },
];

export default function Sidebar() {
  const { t } = useLocale();
  const { currentPage, setCurrentPage, sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-muted/40 transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Draggable title bar region */}
      <div 
        data-tauri-drag-region
        className="h-12 w-full drag-region shrink-0"
      />

      <div className="p-3">
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-end rounded-md p-2 hover:bg-accent no-drag"
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors no-drag',
                isActive
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>{t[item.labelKey]}</span>}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <button
          onClick={() => setCurrentPage('settings')}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors no-drag',
            currentPage === 'settings'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && <span>{t.settings}</span>}
        </button>
      </div>
    </aside>
  );
}
