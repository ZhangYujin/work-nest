import { create } from 'zustand';

type Page = 'workspaces' | 'tags' | 'report' | 'settings';

interface AppState {
  currentPage: Page;
  sidebarCollapsed: boolean;
  searchQuery: string;
  toolsInstalled: Record<string, boolean>;
  sidebarWidth: number;

  setCurrentPage: (page: Page) => void;
  toggleSidebar: () => void;
  setSearchQuery: (query: string) => void;
  setToolsInstalled: (tools: Record<string, boolean>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'workspaces',
  sidebarCollapsed: false,
  searchQuery: '',
  toolsInstalled: {},
  sidebarWidth: 240,

  setCurrentPage: (page) => set({ currentPage: page }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setToolsInstalled: (toolsInstalled) => set({ toolsInstalled }),
}));
