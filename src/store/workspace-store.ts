import { create } from 'zustand';
import type { Workspace, WorkspaceStats, WorkspaceFilter, Tag } from '../types';
import {
  getWorkspaces,
  getWorkspaceStats,
  createWorkspace,
  restoreWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getTags,
} from '../utils/commands';

interface WorkspaceState {
  workspaces: Workspace[];
  stats: WorkspaceStats | null;
  filter: WorkspaceFilter;
  tags: Tag[];
  loading: boolean;
  error: string | null;
  lastAddedWorkspaceName: string | null;

  fetchWorkspaces: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchTags: () => Promise<void>;
  setFilter: (filter: Partial<WorkspaceFilter>) => void;
  setFilterWithoutDebounce: (filter: Partial<WorkspaceFilter>) => void;
  addWorkspace: typeof createWorkspace;
  restoreWorkspace: typeof restoreWorkspace;
  updateWorkspace: typeof updateWorkspace;
  deleteWorkspace: typeof deleteWorkspace;
  clearLastAddedWorkspaceName: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  stats: null,
  filter: {
    sort_by: 'name',
    sort_order: 'asc',
  },
  tags: [],
  loading: false,
  error: null,
  lastAddedWorkspaceName: null,

  fetchWorkspaces: async () => {
    set({ loading: true, error: null });
    try {
      const { filter } = get();
      const workspaces = await getWorkspaces(filter);
      console.log('[store] fetchWorkspaces got:', workspaces.length, 'workspaces');
      set({ workspaces });
    } catch (error) {
      console.error('[store] fetchWorkspaces error:', error);
      set({ error: String(error) });
    } finally {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await getWorkspaceStats();
      set({ stats });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  },

  fetchTags: async () => {
    try {
      const tags = await getTags();
      set({ tags });
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  },

  setFilter: (newFilter) => {
    set((state) => ({
      filter: { ...state.filter, ...newFilter },
    }));
    // fetchWorkspaces 现在在组件端通过防抖调用
  },

  setFilterWithoutDebounce: (newFilter) => {
    set((state) => ({
      filter: { ...state.filter, ...newFilter },
    }));
    get().fetchWorkspaces();
  },

  addWorkspace: async (request) => {
    const result = await createWorkspace(request);
    set({ lastAddedWorkspaceName: result.name });
    await get().fetchWorkspaces();
    await get().fetchStats();
    return result;
  },

  restoreWorkspace: async (request) => {
    const result = await restoreWorkspace(request);
    set({ lastAddedWorkspaceName: result.name });
    await get().fetchWorkspaces();
    await get().fetchStats();
    return result;
  },

  updateWorkspace: async (id, request) => {
    const result = await updateWorkspace(id, request);
    await get().fetchWorkspaces();
    await get().fetchStats();
    return result;
  },

  deleteWorkspace: async (id) => {
    await deleteWorkspace(id);
    await get().fetchWorkspaces();
    await get().fetchStats();
  },

  clearLastAddedWorkspaceName: () => {
    set({ lastAddedWorkspaceName: null });
  },
}));
