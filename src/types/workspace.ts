import type { Tag } from './tag';

export type WorkspaceStatus = 'active' | 'archived' | 'deprecated';

export type ProjectType = 'directory' | 'git' | 'multi_git';

export interface Workspace {
  id: string;
  name: string;
  path: string;
  description: string;
  status: WorkspaceStatus;
  project_type: ProjectType;
  tools: string[];
  tags: Tag[];
  source: 'scan' | 'manual';
  open_count: number;
  open_count_7d: number;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
}

export interface WorkspaceFilter {
  status?: string;
  project_type?: string;
  tool?: string;
  tag?: string;
  search?: string;
  scan_dir_path?: string;
  sort_by?: 'name' | 'updated_at' | 'last_opened_at' | 'open_count';
  sort_order?: 'asc' | 'desc';
}

export interface CreateWorkspaceRequest {
  path: string;
  name?: string;
  description?: string;
  tools?: string[];
  tags?: Tag[];
  source?: 'scan' | 'manual';
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  status?: WorkspaceStatus;
  tools?: string[];
  tags?: Tag[];
}

export interface WorkspaceStats {
  total: number;
  active: number;
  archived: number;
  deprecated: number;
  git_projects: number;
  multi_git_projects: number;
  directories: number;
}
