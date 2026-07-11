import { invoke } from '@tauri-apps/api/core';
import type {
  Workspace,
  WorkspaceFilter,
  WorkspaceStats,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  Tag,
  ScanDirectory,
  Setting,
} from '../types';

// Workspace commands
export const getWorkspaces = (filter?: WorkspaceFilter): Promise<Workspace[]> =>
  invoke('get_workspaces', { filter });

export const getWorkspace = (id: string): Promise<Workspace> =>
  invoke('get_workspace', { id });

export const createWorkspace = (request: CreateWorkspaceRequest): Promise<Workspace> =>
  invoke('create_workspace', { request });

export const restoreWorkspace = (request: CreateWorkspaceRequest): Promise<Workspace> =>
  invoke('restore_workspace', { request });

export const updateWorkspace = (id: string, request: UpdateWorkspaceRequest): Promise<Workspace> =>
  invoke('update_workspace', { id, request });

export const deleteWorkspace = (id: string): Promise<void> =>
  invoke('delete_workspace', { id });

export const getWorkspaceStats = (): Promise<WorkspaceStats> =>
  invoke('get_workspace_stats');

export const openWorkspace = (id: string, tool: string, toolPath?: string): Promise<string> =>
  invoke('open_workspace', { id, tool, toolPath });

export const readWorkspaceJson = (id: string): Promise<string> =>
  invoke('read_workspace_json', { id });

export const writeWorkspaceJson = (id: string, content: string): Promise<void> =>
  invoke('write_workspace_json', { id, content });

export const checkToolsInstalled = (): Promise<Record<string, boolean>> =>
  invoke('check_tools_installed');

export const getToolUsageStats = (): Promise<Array<[string, number]>> =>
  invoke('get_tool_usage_stats');

// Tag commands
export const getTags = (): Promise<Tag[]> =>
  invoke('get_tags');

export const createTag = (name: string, color?: string): Promise<Tag> =>
  invoke('create_tag', { name, color });

export const updateTag = (id: string, name?: string, color?: string): Promise<Tag> =>
  invoke('update_tag', { id, name, color });

export const deleteTag = (id: string): Promise<void> =>
  invoke('delete_tag', { id });

// Settings commands
export const getSetting = (key: string): Promise<string | null> =>
  invoke('get_setting', { key });

export const setSetting = (key: string, value: string): Promise<void> =>
  invoke('set_setting', { key, value });

export const getAllSettings = (): Promise<Setting[]> =>
  invoke('get_all_settings');

export const getScanDirectories = (): Promise<ScanDirectory[]> =>
  invoke('get_scan_directories');

export const addScanDirectory = (path: string, name?: string, depth?: number): Promise<ScanDirectory> =>
  invoke('add_scan_directory', { path, name, depth });

export const removeScanDirectory = (id: string): Promise<void> =>
  invoke('remove_scan_directory', { id });

export const updateScanDirectoryDepth = (id: string, depth: number): Promise<void> =>
  invoke('update_scan_directory_depth', { id, depth });

export const updateScanDirectoryName = (id: string, name: string): Promise<void> =>
  invoke('update_scan_directory_name', { id, name });

export const scanDirectory = (id: string): Promise<import('../types/settings').ScanResult> =>
  invoke('scan_directory', { id });
