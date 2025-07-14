// Background Service Worker
// 处理核心的标签页管理逻辑

// 数据存储键名
const STORAGE_KEY = 'tabSorterData';

// 默认数据结构
const DEFAULT_DATA = {
  version: '1.0.0',
  settings: {
    sync: {
      provider: null,
      gistId: null,
      lastSync: null
    },
    excludeList: [
      'chrome://',
      'chrome-extension://',
      'edge://',
      'about:'
    ]
  },
  groups: []
};

// 初始化存储
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Uni Tab installed');

  // 检查是否已有数据，如果没有则初始化
  const result = await chrome.storage.local.get(STORAGE_KEY);
  if (!result[STORAGE_KEY]) {
    await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_DATA });
    console.log('Initialized default data');
  }
});

// 监听插件图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  // 如果点击时没有popup（比如在某些特殊页面），则直接执行聚合操作
  await aggregateCurrentWindowTabs();
});

// 聚合当前窗口的标签页
async function aggregateCurrentWindowTabs() {
  try {
    // 获取当前窗口的所有标签页
    const tabs = await chrome.tabs.query({ currentWindow: true });

    // 过滤掉固定的标签页和排除列表中的标签页
    const data = await getStorageData();
    const excludeList = data.settings.excludeList || [];

    const tabsToSave = tabs.filter(tab => {
      // 排除固定的标签页
      if (tab.pinned) return false;

      // 排除当前插件的页面
      if (tab.url.includes('chrome-extension://')) return false;

      // 排除设置中的域名
      return !excludeList.some(excludeUrl => tab.url.startsWith(excludeUrl));
    });

    if (tabsToSave.length === 0) {
      console.log('No tabs to save');
      return;
    }

    // 创建新的标签页分组
    const newGroup = {
      id: Date.now(),
      name: `标签页分组 - ${new Date().toLocaleString('zh-CN')}`,
      createdAt: new Date().toISOString(),
      pinned: false,
      tabs: tabsToSave.map(tab => ({
        title: tab.title,
        url: tab.url,
        favIconUrl: tab.favIconUrl || `https://www.google.com/s2/favicons?sz=64&domain_url=${new URL(tab.url).hostname}`
      }))
    };

    // 保存到存储
    data.groups.unshift(newGroup); // 添加到开头
    await chrome.storage.local.set({ [STORAGE_KEY]: data });

    // 关闭已保存的标签页
    const tabIdsToClose = tabsToSave.map(tab => tab.id);
    await chrome.tabs.remove(tabIdsToClose);

    // 打开标签页列表页面
    await chrome.tabs.create({ url: chrome.runtime.getURL('tab_list.html') });

    console.log(`Saved ${tabsToSave.length} tabs to group: ${newGroup.name}`);

  } catch (error) {
    console.error('Error aggregating tabs:', error);
  }
}

// 获取存储数据
async function getStorageData() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || DEFAULT_DATA;
}

// 监听来自其他组件的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'aggregateTabs':
      aggregateCurrentWindowTabs().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // 保持消息通道开放

    case 'getData':
      getStorageData().then(data => {
        sendResponse({ success: true, data });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'saveData':
      chrome.storage.local.set({ [STORAGE_KEY]: request.data }).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'restoreTabs':
      restoreTabs(request.tabs).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'createGroup':
      createGroup(request.name, request.tabs).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'updateGroupName':
      updateGroupName(request.groupId, request.newName).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'toggleGroupLock':
      toggleGroupLock(request.groupId).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'deleteGroup':
      deleteGroup(request.groupId).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'getStatistics':
      getStatistics().then(stats => {
        sendResponse({ success: true, data: stats });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'exportData':
      exportData(request.format).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'importData':
      importData(request.data).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'clearAllData':
      clearAllData().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;
  }
});

// 恢复标签页
async function restoreTabs(tabs) {
  for (const tab of tabs) {
    await chrome.tabs.create({ url: tab.url, active: false });
  }
}

// 创建新分组
async function createGroup(name, tabs) {
  const data = await getStorageData();
  const newGroup = {
    id: Date.now(),
    name: name || `标签页分组 - ${new Date().toLocaleString('zh-CN')}`,
    createdAt: new Date().toISOString(),
    locked: false,
    tabs: tabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl || `https://www.google.com/s2/favicons?sz=64&domain_url=${new URL(tab.url).hostname}`
    }))
  };

  data.groups.unshift(newGroup);
  await chrome.storage.local.set({ [STORAGE_KEY]: data });

  // 关闭已保存的标签页
  const tabIdsToClose = tabs.map(tab => tab.id).filter(id => id);
  if (tabIdsToClose.length > 0) {
    await chrome.tabs.remove(tabIdsToClose);
  }
}

// 更新分组名称
async function updateGroupName(groupId, newName) {
  const data = await getStorageData();
  const group = data.groups.find(g => g.id === groupId);
  if (group && !group.locked) {
    group.name = newName;
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  } else if (group && group.locked) {
    throw new Error('无法修改已锁定的分组');
  } else {
    throw new Error('分组不存在');
  }
}

// 切换分组锁定状态
async function toggleGroupLock(groupId) {
  const data = await getStorageData();
  const group = data.groups.find(g => g.id === groupId);
  if (group) {
    group.locked = !group.locked;
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  } else {
    throw new Error('分组不存在');
  }
}

// 删除分组
async function deleteGroup(groupId) {
  const data = await getStorageData();
  const groupIndex = data.groups.findIndex(g => g.id === groupId);
  if (groupIndex !== -1) {
    const group = data.groups[groupIndex];
    if (group.locked) {
      throw new Error('无法删除已锁定的分组');
    }
    data.groups.splice(groupIndex, 1);
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  } else {
    throw new Error('分组不存在');
  }
}

// 获取统计信息
async function getStatistics() {
  const data = await getStorageData();
  return {
    groupCount: data.groups.length,
    tabCount: data.groups.reduce((total, group) => total + group.tabs.length, 0),
    lockedGroups: data.groups.filter(g => g.locked).length
  };
}

// 导出数据
async function exportData(format) {
  const data = await getStorageData();
  let content, filename, mimeType;

  if (format === 'json') {
    content = JSON.stringify(data, null, 2);
    filename = `tab-sorter-backup-${new Date().toISOString().split('T')[0]}.json`;
    mimeType = 'application/json';
  } else if (format === 'csv') {
    const csvRows = ['分组名称,标签标题,URL,创建时间,是否锁定'];
    data.groups.forEach(group => {
      group.tabs.forEach(tab => {
        csvRows.push(`"${group.name}","${tab.title}","${tab.url}","${group.createdAt}","${group.locked ? '是' : '否'}"`);
      });
    });
    content = csvRows.join('\n');
    filename = `tab-sorter-backup-${new Date().toISOString().split('T')[0]}.csv`;
    mimeType = 'text/csv';
  }

  // 创建下载
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({
    url: url,
    filename: filename
  });
}

// 导入数据
async function importData(importedData) {
  // 验证数据格式
  if (!importedData.groups || !Array.isArray(importedData.groups)) {
    throw new Error('无效的数据格式');
  }

  const currentData = await getStorageData();

  // 合并数据，避免ID冲突
  const maxId = Math.max(0, ...currentData.groups.map(g => g.id));
  importedData.groups.forEach((group, index) => {
    group.id = maxId + index + 1;
    group.createdAt = group.createdAt || new Date().toISOString();
    group.locked = group.locked || false;
  });

  currentData.groups.push(...importedData.groups);
  await chrome.storage.local.set({ [STORAGE_KEY]: currentData });
}

// 清空所有数据
async function clearAllData() {
  await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_DATA });
}

// 导出函数供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    aggregateCurrentWindowTabs,
    getStorageData,
    restoreTabs,
    createGroup,
    updateGroupName,
    toggleGroupLock,
    deleteGroup,
    getStatistics,
    exportData,
    importData,
    clearAllData
  };
}