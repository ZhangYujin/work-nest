import { useState, useEffect } from 'react';
import { Play, Trash2, FolderPlus, Pencil, Check, RefreshCw, Sun, Moon, Monitor, Globe, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { homeDir } from '@tauri-apps/api/path';
import {
  getScanDirectories,
  addScanDirectory,
  removeScanDirectory,
  updateScanDirectoryDepth,
  scanDirectory,
  getSetting,
  setSetting,
  checkToolsInstalled,
} from '../../utils/commands';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { useLocale } from '../../i18n';
import { useWorkspaceStore } from '../../store/workspace-store';
import { useAppStore } from '../../store/app-store';
import type { ScanDirectory, ScanResult } from '../../types';

export default function SettingsPage() {
  const { t, locale, setLocale } = useLocale();
  const { fetchWorkspaces, fetchStats } = useWorkspaceStore();
  const { toolsInstalled, setToolsInstalled } = useAppStore();
  const [scanDirs, setScanDirs] = useState<ScanDirectory[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [autoScan, setAutoScan] = useState(false);
  const [scanInterval, setScanInterval] = useState(30);
  const [terminalApp, setTerminalApp] = useState<'terminal' | 'iterm2'>('terminal');
  const [toolPaths, setToolPaths] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [depthConfirm, setDepthConfirm] = useState<{ id: string; depth: number } | null>(null);
  const [redetectDialogOpen, setRedetectDialogOpen] = useState(false);
  const [redetectResult, setRedetectResult] = useState<{ installed: number; total: number; details: string[] } | null>(null);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showAddedNames, setShowAddedNames] = useState(false);
  const [showRemovedNames, setShowRemovedNames] = useState(false);

  // Get default tool paths with dynamic home directory
  const getDefaultToolPaths = async (): Promise<Record<string, string>> => {
    const home = await homeDir();
    return {
      opencode: `${home}/.npm-global/bin/opencode`,
      claude: '/usr/local/bin/claude',
      vscode: '/Applications/Visual Studio Code.app',
      idea: '/Applications/IntelliJ IDEA CE.app',
      terminal: '/Applications/Terminal.app',
      iterm2: '/Applications/iTerm.app',
    };
  };

  useEffect(() => {
    loadScanDirectories();
    loadSettings();
  }, []);

  const loadScanDirectories = async () => {
    const dirs = await getScanDirectories();
    setScanDirs(dirs);
  };

  const loadSettings = async () => {
    const [themeVal, autoScanVal, intervalVal, terminalVal, defaultPaths] = await Promise.all([
      getSetting('theme'),
      getSetting('auto_scan'),
      getSetting('scan_interval'),
      getSetting('terminal_app'),
      getDefaultToolPaths(),
    ]);

    if (themeVal && (themeVal === 'light' || themeVal === 'dark' || themeVal === 'system')) {
      setTheme(themeVal);
    }
    if (autoScanVal) {
      setAutoScan(autoScanVal === 'true');
    }
    if (intervalVal) {
      setScanInterval(parseInt(intervalVal, 10));
    }
    if (terminalVal && (terminalVal === 'terminal' || terminalVal === 'iterm2')) {
      setTerminalApp(terminalVal);
    }

    // Load tool paths
    const paths: Record<string, string> = {};
    for (const tool of Object.keys(defaultPaths)) {
      const saved = await getSetting(`tool_path_${tool}`);
      paths[tool] = saved || defaultPaths[tool];
    }
    setToolPaths(paths);
  };

  const handleRedetect = async () => {
    const installed = await checkToolsInstalled();
    setToolsInstalled(installed);
    
    const details = Object.entries(installed).map(([name, exists]) => 
      `${name === 'iterm2' ? 'iTerm2' : name.charAt(0).toUpperCase() + name.slice(1)}: ${exists ? '✓ 已安装' : '✗ 未安装'}`
    );
    const installedCount = Object.values(installed).filter(Boolean).length;
    const totalCount = Object.keys(installed).length;
    
    setRedetectResult({ installed: installedCount, total: totalCount, details });
    setRedetectDialogOpen(true);
  };

  const handleToolPathChange = async (tool: string, path: string) => {
    setToolPaths((prev) => ({ ...prev, [tool]: path }));
    await setSetting(`tool_path_${tool}`, path);
  };

  const handleTerminalChange = async (app: 'terminal' | 'iterm2') => {
    setTerminalApp(app);
    await setSetting('terminal_app', app);
  };

  const handleAddScanDirectory = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Directory to Scan',
    });

    if (selected && typeof selected === 'string') {
      const name = selected.split('/').pop() || '';
      await addScanDirectory(selected, name, 3);
      await loadScanDirectories();
    }
  };

  const handleScan = async (id: string) => {
    setScanningId(id);
    try {
      const result = await scanDirectory(id);
      console.log('Scan completed:', result);
      setScanResult(result);
      setScanDialogOpen(true);
      await Promise.all([fetchWorkspaces(), fetchStats()]);
      console.log('Workspaces refreshed');
    } catch (error) {
      console.error('Failed to scan directory:', error);
    } finally {
      setScanningId(null);
      await loadScanDirectories();
    }
  };

  const handleDepthChange = async (id: string, delta: number) => {
    const dir = scanDirs.find((d) => d.id === id);
    if (!dir) return;

    const newDepth = Math.max(1, Math.min(10, dir.depth + delta));
    await updateScanDirectoryDepth(id, newDepth);

    setDepthConfirm({ id, depth: newDepth });
    setTimeout(() => setDepthConfirm(null), 3000);
    await loadScanDirectories();
  };

  const handleRemoveScanDirectory = async (id: string) => {
    await removeScanDirectory(id);
    await loadScanDirectories();
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    await setSetting('theme', newTheme);

    if (newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleAutoScanChange = async (value: boolean) => {
    setAutoScan(value);
    await setSetting('auto_scan', String(value));
  };

  const handleScanIntervalChange = async (delta: number) => {
    const newInterval = Math.max(5, Math.min(1440, scanInterval + delta));
    setScanInterval(newInterval);
    await setSetting('scan_interval', String(newInterval));
  };

  const startEditingName = (dir: ScanDirectory) => {
    setEditingName(dir.id);
    setEditNameValue(dir.name);
  };

  const saveName = async (id: string) => {
    await setSetting(`scan_dir_name_${id}`, editNameValue);
    setEditingName(null);
    await loadScanDirectories();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Draggable title bar region */}
      <div 
        data-tauri-drag-region
        className="h-12 w-full drag-region shrink-0"
      />

      <div className="flex-1 px-8 pb-4 overflow-y-auto">
      <div className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t.settings}</h1>
      </div>

      <div className="space-y-6">
        {/* Scan Directories */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t.scan_directories}</CardTitle>
              <Button variant="outline" size="sm" onClick={handleAddScanDirectory}>
                <FolderPlus className="mr-1 h-4 w-4" />
                {t.add_scan_directory}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {scanDirs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.empty_scan_dirs}</p>
            ) : (
              scanDirs.map((dir) => (
                <div key={dir.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    {editingName === dir.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveName(dir.id)}>
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{dir.name}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditingName(dir)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => handleScan(dir.id)}
                        disabled={scanningId === dir.id}
                      >
                        {scanningId === dir.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:bg-red-500/10"
                        onClick={() => handleRemoveScanDirectory(dir.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground font-mono">{dir.path}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t.scan_depth}:</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDepthChange(dir.id, -1)}
                          disabled={dir.depth <= 1}
                        >
                          -
                        </Button>
                        <span className="text-xs w-4 text-center">{dir.depth}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDepthChange(dir.id, 1)}
                          disabled={dir.depth >= 10}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                    {depthConfirm?.id === dir.id && (
                      <span className="text-[10px] text-green-500">Saved</span>
                    )}
                    {dir.last_scanned_at && (
                      <span className="text-xs text-muted-foreground">
                        {t.last_scanned}: {new Date(dir.last_scanned_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Auto Scan */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t.auto_scan}</CardTitle>
              <Button
                variant={autoScan ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleAutoScanChange(!autoScan)}
              >
                {autoScan ? 'On' : 'Off'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {autoScan && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t.scan_interval}:</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleScanIntervalChange(-5)}
                >
                  -
                </Button>
                <span className="text-sm w-12 text-center">{scanInterval}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleScanIntervalChange(5)}
                >
                  +
                </Button>
                <span className="text-sm text-muted-foreground">{t.minutes}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tool Paths */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t.tool_paths}</CardTitle>
              <Button variant="outline" size="sm" onClick={handleRedetect}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                {t.redetect}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(toolPaths).map(([tool, path]) => (
              <div key={tool} className="flex items-center gap-3">
                <span className="w-16 text-sm">
                  {tool === 'iterm2' ? 'iTerm2' : tool.charAt(0).toUpperCase() + tool.slice(1)}
                </span>
                <Input
                  value={path}
                  onChange={(e) => handleToolPathChange(tool, e.target.value)}
                  className="h-7 text-xs font-mono flex-1"
                />
                {toolsInstalled[tool] !== undefined && (
                  <span className={`text-xs ${toolsInstalled[tool] ? 'text-green-600' : 'text-red-500'}`}>
                    {toolsInstalled[tool] ? '✓' : '✗'}
                  </span>
                )}
              </div>
            ))}

            {/* Terminal App Selection */}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">{t.terminal_app}</p>
              <div className="flex gap-2 justify-start">
                <Button
                  variant={terminalApp === 'terminal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTerminalChange('terminal')}
                  className="w-24"
                >
                  <Terminal className="mr-1 h-3.5 w-3.5" />
                  Terminal
                </Button>
                <Button
                  variant={terminalApp === 'iterm2' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTerminalChange('iterm2')}
                  className="w-24"
                >
                  iTerm2
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Theme */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.theme}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleThemeChange('system')}
                className="flex-1"
              >
                <Monitor className="mr-2 h-4 w-4" />
                {t.theme_system}
              </Button>
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleThemeChange('light')}
                className="flex-1"
              >
                <Sun className="mr-2 h-4 w-4" />
                {t.theme_light}
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleThemeChange('dark')}
                className="flex-1"
              >
                <Moon className="mr-2 h-4 w-4" />
                {t.theme_dark}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.language}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant={locale === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLocale('system')}
                className="flex-1"
              >
                <Globe className="mr-2 h-4 w-4" />
                {t.theme_system}
              </Button>
              <Button
                variant={locale === 'zh' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLocale('zh')}
                className="flex-1"
              >
                中文
              </Button>
              <Button
                variant={locale === 'en' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLocale('en')}
                className="flex-1"
              >
                English
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.about}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-start gap-2 text-sm">
              <span className="text-muted-foreground">{t.app_name}:</span>
              <span className="font-semibold">WorkNest</span>
            </div>
            <div className="flex items-center justify-start gap-2 text-sm">
              <span className="text-muted-foreground">{t.version}:</span>
              <span>0.1.0</span>
            </div>
            <div className="flex items-center justify-start gap-2 text-sm">
              <span className="text-muted-foreground">{t.author}:</span>
              <span>focsim</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Redetect Result Dialog */}
      <Dialog open={redetectDialogOpen} onOpenChange={setRedetectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>工具检测完成</DialogTitle>
            <DialogDescription>
              共检测到 {redetectResult?.installed} / {redetectResult?.total} 个工具
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            {redetectResult?.details.map((detail, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{detail.split(': ')[0]}</span>
                <span className={detail.includes('✓') ? 'text-green-600' : 'text-red-500'}>
                  {detail.split(': ')[1]}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setRedetectDialogOpen(false)}>
              确定
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scan Result Dialog */}
      <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>扫描完成</DialogTitle>
            <DialogDescription>
              共发现 {scanResult?.found} 个项目
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">+{scanResult?.added}</div>
                <div className="text-sm text-muted-foreground">新增</div>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">-{scanResult?.removed}</div>
                <div className="text-sm text-muted-foreground">移除</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="text-2xl font-bold">{scanResult?.unchanged}</div>
                <div className="text-sm text-muted-foreground">不变</div>
              </div>
            </div>

            {scanResult && scanResult.added_names.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  className="w-full px-4 py-2 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
                  onClick={() => setShowAddedNames(!showAddedNames)}
                >
                  <span className="text-sm font-medium">新增项目</span>
                  {showAddedNames ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showAddedNames && (
                  <div className="px-4 py-2 max-h-40 overflow-y-auto">
                    {scanResult.added_names.map((name, i) => (
                      <div key={i} className="text-sm py-1 text-green-600 dark:text-green-400 flex items-center">
                        <span className="mr-2">+</span> {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {scanResult && scanResult.removed_names.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  className="w-full px-4 py-2 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
                  onClick={() => setShowRemovedNames(!showRemovedNames)}
                >
                  <span className="text-sm font-medium">移除项目</span>
                  {showRemovedNames ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showRemovedNames && (
                  <div className="px-4 py-2 max-h-40 overflow-y-auto">
                    {scanResult.removed_names.map((name, i) => (
                      <div key={i} className="text-sm py-1 text-red-600 dark:text-red-400 flex items-center">
                        <span className="mr-2">-</span> {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setScanDialogOpen(false)}>
              确定
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
