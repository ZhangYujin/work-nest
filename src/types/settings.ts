export interface ScanDirectory {
  id: string;
  path: string;
  name: string;
  depth: number;
  enabled: boolean;
  last_scanned_at: string | null;
}

export interface ScanResult {
  found: number;
  added: number;
  removed: number;
  unchanged: number;
  added_names: string[];
  removed_names: string[];
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

export type Theme = 'light' | 'dark' | 'system';
export type Locale = 'zh' | 'en' | 'system';

export interface AppSettings {
  theme: Theme;
  locale: Locale;
  auto_scan: boolean;
  scan_interval: number;
  terminal_app: 'terminal' | 'iterm2';
  tool_path_qoder: string;
  tool_path_claude: string;
  tool_path_vscode: string;
  tool_path_idea: string;
  tool_path_wukong: string;
}
