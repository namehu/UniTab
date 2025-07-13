// Tab Sorter Pro - Options Script

// 全局状态
const state = {
  currentTab: 'general',
  settings: {},
  stats: {},
  isLoading: false
};

// DOM 元素
const elements = {
  tabButtons: null,
  tabContents: null,
  settingsForm: null,
  notificationContainer: null
};

// 默认设置
const defaultSettings = {
  // 常规设置
  defaultGroupName: '标签页分组 {date}',
  theme: 'auto',
  language: 'zh-CN',
  enableShortcuts: true,
  
  // 行为设置
  autoCloseAfterSave: true,
  confirmBeforeDelete: true,
  restoreInNewWindow: false,
  showNotifications: true,
  notificationDuration: 3000,
  
  // 高级设置
  maxGroupsToKeep: 50,
  enableSync: false,
  syncInterval: 300000, // 5分钟
  enableAnalytics: false
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    initializeElements();
    await loadSettings();
    await loadStats();
    setupEventListeners();
    updateUI();
    
    // 检查URL哈希以确定初始标签页
    const hash = window.location.hash.substring(1);
    if (hash && ['general', 'behavior', 'data', 'about'].includes(hash)) {
      switchTab(hash);
    }
  } catch (error) {
    console.error('初始化失败:', error);
    showNotification('初始化失败，请刷新页面重试', 'error');
  }
});

// 初始化DOM元素
function initializeElements() {
  elements.tabButtons = document.querySelectorAll('.tab-btn');
  elements.tabContents = document.querySelectorAll('.tab-content');
  elements.settingsForm = document.getElementById('settingsForm');
  elements.notificationContainer = document.getElementById('notificationContainer');
}

// 设置事件监听器
function setupEventListeners() {
  // 标签页切换
  elements.tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const tabId = e.currentTarget.dataset.tab;
      switchTab(tabId);
    });
  });
  
  // 设置表单变化
  if (elements.settingsForm) {
    elements.settingsForm.addEventListener('change', handleSettingChange);
    elements.settingsForm.addEventListener('input', debounce(handleSettingChange, 500));
  }
  
  // 按钮事件
  setupButtonListeners();
  
  // 键盘快捷键
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // 文件拖拽
  setupFileDragAndDrop();
}

// 设置按钮监听器
function setupButtonListeners() {
  // 重置设置
  const resetBtn = document.getElementById('resetSettings');
  if (resetBtn) {
    resetBtn.addEventListener('click', handleResetSettings);
  }
  
  // 导出数据
  const exportBtn = document.getElementById('exportData');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExportData);
  }
  
  // 导入数据
  const importBtn = document.getElementById('importData');
  const importFile = document.getElementById('importFile');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', handleImportData);
  }
  
  // 清理数据
  const clearBtn = document.getElementById('clearData');
  if (clearBtn) {
    clearBtn.addEventListener('click', handleClearData);
  }
  
  // 反馈按钮
  const feedbackBtn = document.getElementById('feedbackBtn');
  if (feedbackBtn) {
    feedbackBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'mailto:support@tabsorterpro.com' });
    });
  }
}

// 标签页切换
function switchTab(tabId) {
  // 更新按钮状态
  elements.tabButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tabId);
  });
  
  // 更新内容显示
  elements.tabContents.forEach(content => {
    content.classList.toggle('hidden', content.id !== `${tabId}Tab`);
  });
  
  state.currentTab = tabId;
  
  // 更新URL哈希
  window.location.hash = tabId;
}

// 加载设置
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get('settings');
    state.settings = { ...defaultSettings, ...result.settings };
  } catch (error) {
    console.error('加载设置失败:', error);
    state.settings = { ...defaultSettings };
  }
}

// 保存设置
async function saveSettings() {
  try {
    await chrome.storage.local.set({ settings: state.settings });
    showNotification('设置已保存', 'success');
  } catch (error) {
    console.error('保存设置失败:', error);
    showNotification('保存设置失败', 'error');
  }
}

// 加载统计信息
async function loadStats() {
  try {
    const result = await chrome.storage.local.get(['tabGroups', 'settings']);
    const groups = result.tabGroups || [];
    
    state.stats = {
      totalGroups: groups.length,
      totalTabs: groups.reduce((sum, group) => sum + group.tabs.length, 0),
      storageUsed: JSON.stringify(result).length,
      lastBackup: result.settings?.lastBackup || null
    };
  } catch (error) {
    console.error('加载统计信息失败:', error);
    state.stats = {
      totalGroups: 0,
      totalTabs: 0,
      storageUsed: 0,
      lastBackup: null
    };
  }
}

// 更新UI
function updateUI() {
  updateSettingsForm();
  updateStatsDisplay();
  updateTheme();
}

// 更新设置表单
function updateSettingsForm() {
  Object.keys(state.settings).forEach(key => {
    const element = document.getElementById(key);
    if (element) {
      if (element.type === 'checkbox') {
        element.checked = state.settings[key];
      } else {
        element.value = state.settings[key];
      }
    }
  });
}

// 更新统计显示
function updateStatsDisplay() {
  const statsElements = {
    totalGroups: document.getElementById('totalGroups'),
    totalTabs: document.getElementById('totalTabs'),
    storageUsed: document.getElementById('storageUsed'),
    lastBackup: document.getElementById('lastBackup')
  };
  
  if (statsElements.totalGroups) {
    statsElements.totalGroups.textContent = state.stats.totalGroups;
  }
  
  if (statsElements.totalTabs) {
    statsElements.totalTabs.textContent = state.stats.totalTabs;
  }
  
  if (statsElements.storageUsed) {
    const sizeInKB = (state.stats.storageUsed / 1024).toFixed(2);
    statsElements.storageUsed.textContent = `${sizeInKB} KB`;
  }
  
  if (statsElements.lastBackup) {
    if (state.stats.lastBackup) {
      const date = new Date(state.stats.lastBackup);
      statsElements.lastBackup.textContent = date.toLocaleString();
    } else {
      statsElements.lastBackup.textContent = '从未备份';
    }
  }
}

// 更新主题
function updateTheme() {
  const theme = state.settings.theme;
  const html = document.documentElement;
  
  if (theme === 'dark') {
    html.classList.add('dark');
  } else if (theme === 'light') {
    html.classList.remove('dark');
  } else {
    // auto - 跟随系统
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.classList.toggle('dark', prefersDark);
  }
}

// 处理设置变化
function handleSettingChange(event) {
  const { id, type, checked, value } = event.target;
  
  if (type === 'checkbox') {
    state.settings[id] = checked;
  } else {
    state.settings[id] = value;
  }
  
  // 特殊处理
  if (id === 'theme') {
    updateTheme();
  }
  
  saveSettings();
}

// 重置设置
async function handleResetSettings() {
  if (!confirm('确定要重置所有设置吗？此操作不可撤销。')) {
    return;
  }
  
  try {
    state.settings = { ...defaultSettings };
    await saveSettings();
    updateUI();
    showNotification('设置已重置', 'success');
  } catch (error) {
    console.error('重置设置失败:', error);
    showNotification('重置设置失败', 'error');
  }
}

// 导出数据
async function handleExportData() {
  try {
    const result = await chrome.storage.local.get(null);
    const data = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: result
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tab-sorter-pro-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    
    // 更新最后备份时间
    state.settings.lastBackup = new Date().toISOString();
    await saveSettings();
    await loadStats();
    updateStatsDisplay();
    
    showNotification('数据导出成功', 'success');
  } catch (error) {
    console.error('导出数据失败:', error);
    showNotification('导出数据失败', 'error');
  }
}

// 导入数据
async function handleImportData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    // 验证数据格式
    if (!data.data || typeof data.data !== 'object') {
      throw new Error('无效的备份文件格式');
    }
    
    if (!confirm('确定要导入数据吗？这将覆盖当前所有数据。')) {
      return;
    }
    
    // 清除现有数据
    await chrome.storage.local.clear();
    
    // 导入新数据
    await chrome.storage.local.set(data.data);
    
    // 重新加载
    await loadSettings();
    await loadStats();
    updateUI();
    
    showNotification('数据导入成功', 'success');
  } catch (error) {
    console.error('导入数据失败:', error);
    showNotification('导入数据失败：' + error.message, 'error');
  } finally {
    event.target.value = ''; // 清除文件选择
  }
}

// 清理数据
async function handleClearData() {
  if (!confirm('确定要清除所有数据吗？此操作不可撤销。')) {
    return;
  }
  
  const secondConfirm = prompt('请输入 "CLEAR" 来确认清除所有数据：');
  if (secondConfirm !== 'CLEAR') {
    return;
  }
  
  try {
    await chrome.storage.local.clear();
    
    // 重置为默认设置
    state.settings = { ...defaultSettings };
    await saveSettings();
    
    await loadStats();
    updateUI();
    
    showNotification('所有数据已清除', 'success');
  } catch (error) {
    console.error('清除数据失败:', error);
    showNotification('清除数据失败', 'error');
  }
}

// 设置文件拖拽
function setupFileDragAndDrop() {
  const dropZone = document.getElementById('fileDropZone');
  if (!dropZone) return;
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const importFile = document.getElementById('importFile');
      if (importFile) {
        importFile.files = files;
        handleImportData({ target: importFile });
      }
    }
  });
}

// 键盘快捷键
function handleKeyboardShortcuts(event) {
  if (!state.settings.enableShortcuts) return;
  
  // Ctrl/Cmd + S: 保存设置
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    saveSettings();
  }
  
  // Ctrl/Cmd + E: 导出数据
  if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
    event.preventDefault();
    handleExportData();
  }
  
  // 数字键切换标签页
  if (event.key >= '1' && event.key <= '4' && !event.ctrlKey && !event.metaKey) {
    const tabs = ['general', 'behavior', 'data', 'about'];
    const tabIndex = parseInt(event.key) - 1;
    if (tabs[tabIndex]) {
      switchTab(tabs[tabIndex]);
    }
  }
}

// 显示通知
function showNotification(message, type = 'info', duration = 3000) {
  if (!elements.notificationContainer) return;
  
  const notification = document.createElement('div');
  notification.className = `notification ${type} bg-white border border-gray-200 rounded-lg shadow-lg p-4 mb-4 flex items-center justify-between`;
  
  const iconMap = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  };
  
  notification.innerHTML = `
    <div class="flex items-center">
      <span class="text-lg mr-3">${iconMap[type] || iconMap.info}</span>
      <span>${escapeHtml(message)}</span>
    </div>
    <button class="text-gray-400 hover:text-gray-600 ml-4" onclick="this.parentElement.remove()">
      ✕
    </button>
  `;
  
  elements.notificationContainer.appendChild(notification);
  
  // 自动移除
  if (duration > 0) {
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, duration);
  }
}

// 工具函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 监听系统主题变化
if (window.matchMedia) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addListener(() => {
    if (state.settings.theme === 'auto') {
      updateTheme();
    }
  });
}

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.settings) {
      state.settings = { ...defaultSettings, ...changes.settings.newValue };
      updateUI();
    }
    
    if (changes.tabGroups) {
      loadStats().then(updateStatsDisplay);
    }
  }
});

// 导出全局函数供HTML使用
window.TabSorterOptions = {
  switchTab,
  showNotification,
  handleExportData,
  handleImportData,
  handleClearData,
  handleResetSettings
};