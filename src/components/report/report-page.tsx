import { useEffect, useState } from 'react';
import { Layers, Activity, Archive, AlertTriangle, FolderGit2, Folder } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspace-store';
import { getToolUsageStats } from '../../utils/commands';
import { Card, CardContent } from '../ui/card';
import { useLocale } from '../../i18n';
import type { Workspace } from '../../types';

export default function ReportPage() {
  const { t } = useLocale();
  const { stats, workspaces } = useWorkspaceStore();
  const [toolStats, setToolStats] = useState<Array<[string, number]>>([]);

  useEffect(() => {
    const loadToolStats = async () => {
      const data = await getToolUsageStats();
      setToolStats(data);
    };
    loadToolStats();
  }, []);

  const topGitProjects = [...workspaces]
    .filter((w) => w.project_type === 'git')
    .sort((a, b) => b.open_count - a.open_count)
    .slice(0, 3);

  const topRegularProjects = [...workspaces]
    .filter((w) => w.project_type !== 'git')
    .sort((a, b) => b.open_count - a.open_count)
    .slice(0, 3);

  const totalOpens = toolStats.reduce((sum, [_, count]) => sum + count, 0);

  const statCards = [
    {
      key: 'total',
      label: t.total_workspaces,
      value: stats?.total || 0,
      icon: Layers,
      color: 'text-blue-600',
      bg: 'bg-blue-500/5',
      border: 'border-blue-200/60',
    },
    {
      key: 'active',
      label: t.active_workspaces,
      value: stats?.active || 0,
      icon: Activity,
      color: 'text-green-600',
      bg: 'bg-green-500/5',
      border: 'border-green-200/60',
    },
    {
      key: 'archived',
      label: t.archived_workspaces,
      value: stats?.archived || 0,
      icon: Archive,
      color: 'text-amber-600',
      bg: 'bg-amber-500/5',
      border: 'border-amber-200/60',
    },
    {
      key: 'deprecated',
      label: t.deprecated_workspaces,
      value: stats?.deprecated || 0,
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-500/5',
      border: 'border-red-200/60',
    },
  ];

  const ProjectRanking = ({ title, projects, icon: Icon }: { title: string; projects: Workspace[]; icon: any }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">{title}</h3>
        </div>
        {projects.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.no_projects}</p>
        ) : (
          <div className="space-y-3">
            {projects.map((project, index) => (
              <div key={project.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary/10 text-[10px] font-bold text-primary flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium truncate max-w-[150px]">{project.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{project.open_count}x</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden ml-7">
                  <div
                    className="h-full bg-primary/30 rounded-full"
                    style={{ width: `${Math.min((project.open_count / (projects[0]?.open_count || 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Draggable title bar region */}
      <div 
        data-tauri-drag-region
        className="h-12 w-full drag-region shrink-0"
      />

      <div className="flex-1 px-8 pb-4 overflow-y-auto">
        <div className="pb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{t.report_title}</h1>
          <p className="text-xs text-muted-foreground mt-1">{t.report_subtitle}</p>
        </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 pb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key} className={`${card.bg} ${card.border}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${card.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-[10px] text-muted-foreground">{card.label}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FolderGit2 className="h-3 w-3" /> Git: {stats?.git_projects || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Folder className="h-3 w-3" /> Dir: {stats?.directories || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Top Projects */}
      <div className="grid grid-cols-2 gap-4 pb-6">
        <ProjectRanking title={t.top_git_projects} projects={topGitProjects} icon={FolderGit2} />
        <ProjectRanking title={t.top_regular_projects} projects={topRegularProjects} icon={Folder} />
      </div>

      {/* Tool Usage */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-sm mb-4">{t.tool_usage}</h3>
          <div className="space-y-3">
            {toolStats.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.no_usage_data}</p>
            ) : (
              toolStats.map(([tool, count]) => (
                <div key={tool} className="flex items-center gap-3">
                  <span className="w-20 text-xs font-medium capitalize">{tool}</span>
                  <div className="flex-1 h-6 rounded-md bg-muted/50 overflow-hidden">
                    <div
                      className="h-full bg-primary/20 transition-all"
                      style={{ width: `${(count / (totalOpens || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs text-muted-foreground">{count}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
