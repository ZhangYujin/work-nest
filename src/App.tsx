import { useEffect } from 'react';
import { useAppStore } from './store/app-store';
import { useWorkspaceStore } from './store/workspace-store';
import { checkToolsInstalled } from './utils/commands';
import Sidebar from './components/common/sidebar';
import WorkspacesPage from './components/workspace-list/workspaces-page';
import TagsPage from './components/tags/tags-page';
import ReportPage from './components/report/report-page';
import SettingsPage from './components/settings/settings-page';
import { getSetting } from './utils/commands';

function App() {
  const { currentPage, setToolsInstalled } = useAppStore();
  const { fetchWorkspaces, fetchStats, fetchTags } = useWorkspaceStore();

  useEffect(() => {
    // Initialize theme
    const initTheme = async () => {
      try {
        const savedTheme = await getSetting('theme');
        const theme = savedTheme || 'system';

        if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (error) {
        console.error('Failed to init theme:', error);
      }
    };
    initTheme();
  }, []);

  useEffect(() => {
    // Load initial data
    fetchWorkspaces();
    fetchStats();
    fetchTags();
    checkToolsInstalled().then(setToolsInstalled);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'workspaces':
        return <WorkspacesPage />;
      case 'tags':
        return <TagsPage />;
      case 'report':
        return <ReportPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <WorkspacesPage />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 overflow-hidden">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
