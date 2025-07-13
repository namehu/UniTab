// Tab Sorter Pro - Background Service Worker
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
  console.log('Tab Sorter Pro installed');
  
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
    await chrome.tabs.create({ url: chrome.runtime.getURL('tab_list/tab_list.html') });
    
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
  }
});

// 恢复标签页
async function restoreTabs(tabs) {
  for (const tab of tabs) {
    await chrome.tabs.create({ url: tab.url, active: false });
  }
}

// 导出函数供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    aggregateCurrentWindowTabs,
    getStorageData,
    restoreTabs
  };
}