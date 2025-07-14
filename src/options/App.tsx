import React, { useState, useEffect, useCallback, useRef } from 'react';

// 类型定义
interface Settings {
  defaultGroupName: string;
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'zh-CN';
  aggregateInNewTab: boolean;
  restoreInNewWindow: boolean;
  showNotifications: boolean;
  shortcut: string;
}

const initialSettings: Settings = {
  defaultGroupName: 'yyyy-MM-dd HH:mm:ss',
  theme: 'system',
  language: 'zh-CN',
  aggregateInNewTab: true,
  restoreInNewWindow: false,
  showNotifications: true,
  shortcut: 'Alt+Shift+S',
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (['general', 'behavior', 'data', 'about'].includes(hash)) {
      setActiveTab(hash);
    }

    chrome.storage.local.get('settings', (result) => {
      if (result.settings) {
        setSettings({ ...initialSettings, ...result.settings });
      }
    });
  }, []);

  const handleSettingChange = useCallback((key: keyof Settings, value: any) => {
    setIsSaving(true);
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    chrome.storage.local.set({ settings: newSettings }, () => {
      setTimeout(() => setIsSaving(false), 500); // Simulate save delay
    });
  }, [settings]);

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings settings={settings} onSettingChange={handleSettingChange} />;
      case 'behavior':
        return <BehaviorSettings settings={settings} onSettingChange={handleSettingChange} />;
      case 'data':
        return <DataManagement />;
      case 'about':
        return <About />;
      default:
        return <GeneralSettings settings={settings} onSettingChange={handleSettingChange} />;
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <img src="../icons/icon48.svg" alt="Tab Sorter Pro" className="w-8 h-8" />
              <h1 className="text-xl font-semibold text-gray-900">Tab Sorter Pro 设置</h1>
            </div>
            {isSaving && <div className="text-sm text-gray-500">保存中...</div>}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <aside className="md:col-span-1">
            <nav className="space-y-1">
              <TabButton id="general" activeTab={activeTab} onClick={handleTabClick}>常规设置</TabButton>
              <TabButton id="behavior" activeTab={activeTab} onClick={handleTabClick}>行为设置</TabButton>
              <TabButton id="data" activeTab={activeTab} onClick={handleTabClick}>数据管理</TabButton>
              <TabButton id="about" activeTab={activeTab} onClick={handleTabClick}>关于</TabButton>
            </nav>
          </aside>
          <div className="md:col-span-3">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const TabButton: React.FC<{ id: string; activeTab: string; onClick: (id: string) => void; children: React.ReactNode }> = ({ id, activeTab, onClick, children }) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      activeTab === id
        ? 'bg-blue-100 text-blue-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`}>
    {children}
  </button>
);

const SettingsCard: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="mb-8">
    <h3 className="text-lg font-medium text-gray-900">{title}</h3>
    {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
    <div className="mt-4 space-y-4">{children}</div>
  </div>
);

const GeneralSettings: React.FC<{ settings: Settings; onSettingChange: (key: keyof Settings, value: any) => void; }> = ({ settings, onSettingChange }) => {
  return (
    <div>
      <SettingsCard title="默认分组名称" description="为新分组设置默认名称格式。">
        <input
          type="text"
          className="input-field"
          value={settings.defaultGroupName}
          onChange={(e) => onSettingChange('defaultGroupName', e.target.value)}
        />
      </SettingsCard>
      <SettingsCard title="主题" description="选择界面主题。">
        <select
          className="input-field"
          value={settings.theme}
          onChange={(e) => onSettingChange('theme', e.target.value)}
        >
          <option value="system">跟随系统</option>
          <option value="light">浅色模式</option>
          <option value="dark">深色模式</option>
        </select>
      </SettingsCard>
      <SettingsCard title="快捷键" description="设置聚合当前窗口标签的快捷键。">
        <input
          type="text"
          className="input-field"
          value={settings.shortcut}
          onChange={(e) => onSettingChange('shortcut', e.target.value)}
        />
      </SettingsCard>
    </div>
  );
};

const BehaviorSettings: React.FC<{ settings: Settings; onSettingChange: (key: keyof Settings, value: any) => void; }> = ({ settings, onSettingChange }) => (
  <div>
    <SettingsCard title="聚合行为">
      <label className="flex items-center">
        <input
          type="checkbox"
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          checked={settings.aggregateInNewTab}
          onChange={(e) => onSettingChange('aggregateInNewTab', e.target.checked)}
        />
        <span className="ml-2 text-sm text-gray-700">聚合后在新标签页打开管理页面</span>
      </label>
    </SettingsCard>
    <SettingsCard title="恢复行为">
      <label className="flex items-center">
        <input
          type="checkbox"
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          checked={settings.restoreInNewWindow}
          onChange={(e) => onSettingChange('restoreInNewWindow', e.target.checked)}
        />
        <span className="ml-2 text-sm text-gray-700">在新窗口中恢复标签页</span>
      </label>
    </SettingsCard>
    <SettingsCard title="通知设置">
      <label className="flex items-center">
        <input
          type="checkbox"
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          checked={settings.showNotifications}
          onChange={(e) => onSettingChange('showNotifications', e.target.checked)}
        />
        <span className="ml-2 text-sm text-gray-700">显示操作结果通知</span>
      </label>
    </SettingsCard>
  </div>
);

const DataManagement: React.FC = () => {
  const [stats, setStats] = useState({ groupCount: 0, tabCount: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ action: 'getStatistics' }).then((response: any) => {
      if (response.success) {
        setStats(response.data);
      }
    });
  }, []);

  const handleExport = (format: 'json' | 'csv') => {
    chrome.runtime.sendMessage({ action: 'exportData', format });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          chrome.runtime.sendMessage({ action: 'importData', data }).then((response: any) => {
            if (response.success) {
              alert('导入成功！');
              window.location.reload();
            } else {
              alert(`导入失败: ${response.error}`);
            }
          });
        } catch (error) {
          alert('文件格式错误，请选择正确的 JSON 文件。');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleClearData = () => {
    if (confirm('确定要清除所有数据吗？此操作不可恢复。')) {
      chrome.runtime.sendMessage({ action: 'clearAllData' }).then((response: any) => {
        if (response.success) {
          alert('数据已清除！');
          window.location.reload();
        } else {
          alert(`清除失败: ${response.error}`);
        }
      });
    }
  };

  return (
    <div>
      <SettingsCard title="统计信息">
        <div className="flex space-x-8">
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.groupCount}</div>
            <div className="text-sm text-gray-500">分组数量</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.tabCount}</div>
            <div className="text-sm text-gray-500">标签页总数</div>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard title="数据导出" description="将您的数据备份到本地。">
        <div className="flex space-x-2">
          <button onClick={() => handleExport('json')} className="btn btn-secondary">导出为 JSON</button>
          <button onClick={() => handleExport('csv')} className="btn btn-secondary">导出为 CSV</button>
        </div>
      </SettingsCard>
      <SettingsCard title="数据导入" description="从 JSON 文件导入数据。">
        <button onClick={handleImportClick} className="btn btn-secondary">选择文件导入</button>
        <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".json" />
      </SettingsCard>
      <SettingsCard title="清空数据" description="删除所有分组和标签页数据。">
        <button onClick={handleClearData} className="btn btn-danger">清空所有数据</button>
      </SettingsCard>
    </div>
  );
};

const About: React.FC = () => {
  const [version, setVersion] = useState('');

  useEffect(() => {
    const manifest = chrome.runtime.getManifest();
    setVersion(manifest.version);
  }, []);

  return (
    <div>
      <SettingsCard title="关于 Tab Sorter Pro">
        <p className="text-sm text-gray-700">版本: {version}</p>
        <p className="text-sm text-gray-700 mt-2">一款帮助您管理和组织浏览器标签页的扩展程序。</p>
        <div className="mt-4">
          <a href="https://github.com/your-repo/tab-sorter-pro" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">GitHub 仓库</a>
        </div>
      </SettingsCard>
    </div>
  );
};

export default App;