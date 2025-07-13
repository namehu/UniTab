// Tab Sorter Pro - Popup JavaScript
// 处理弹窗界面的交互逻辑

document.addEventListener('DOMContentLoaded', async () => {
  // 获取DOM元素
  const aggregateBtn = document.getElementById('aggregateBtn');
  const openTabListBtn = document.getElementById('openTabList');
  const openOptionsBtn = document.getElementById('openOptions');
  const recentGroupsContainer = document.getElementById('recentGroups');
  const noGroupsMessage = document.getElementById('noGroups');
  const loadingOverlay = document.getElementById('loading');
  
  // 加载最近的分组
  await loadRecentGroups();
  
  // 聚合当前窗口标签页
  aggregateBtn.addEventListener('click', async () => {
    try {
      showLoading(true);
      
      // 发送消息给background script
      const response = await chrome.runtime.sendMessage({ action: 'aggregateTabs' });
      
      if (response.success) {
        showMessage('标签页已成功聚合！', 'success');
        // 延迟关闭弹窗，让用户看到成功消息
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        showMessage('聚合失败：' + response.error, 'error');
      }
    } catch (error) {
      console.error('Error aggregating tabs:', error);
      showMessage('聚合失败，请重试', 'error');
    } finally {
      showLoading(false);
    }
  });
  
  // 打开标签页列表
  openTabListBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('tab_list/tab_list.html') });
    window.close();
  });
  
  // 打开选项页面
  openOptionsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
    window.close();
  });
});

// 加载最近的分组
async function loadRecentGroups() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getData' });
    
    if (response.success && response.data.groups.length > 0) {
      const recentGroups = response.data.groups.slice(0, 3); // 只显示最近3个
      renderRecentGroups(recentGroups);
    } else {
      showNoGroups();
    }
  } catch (error) {
    console.error('Error loading recent groups:', error);
    showNoGroups();
  }
}

// 渲染最近的分组
function renderRecentGroups(groups) {
  const container = document.getElementById('recentGroups');
  const noGroupsMessage = document.getElementById('noGroups');
  
  container.innerHTML = '';
  noGroupsMessage.classList.add('hidden');
  
  groups.forEach(group => {
    const groupElement = createGroupElement(group);
    container.appendChild(groupElement);
  });
}

// 创建分组元素
function createGroupElement(group) {
  const div = document.createElement('div');
  div.className = 'group-item bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md cursor-pointer fade-in';
  
  const createdDate = new Date(group.createdAt).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  div.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-medium text-gray-800 truncate">${escapeHtml(group.name)}</h3>
        <p class="text-xs text-gray-500 mt-1">
          ${group.tabs.length} 个标签页 • ${createdDate}
        </p>
      </div>
      <div class="ml-2 flex space-x-1">
        <button class="restore-group text-blue-600 hover:text-blue-800 p-1" title="恢复所有标签页">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  // 点击分组名称打开详情页
  div.addEventListener('click', (e) => {
    if (!e.target.closest('.restore-group')) {
      chrome.tabs.create({ url: chrome.runtime.getURL(`tab_list/tab_list.html#group-${group.id}`) });
      window.close();
    }
  });
  
  // 恢复分组
  const restoreBtn = div.querySelector('.restore-group');
  restoreBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await restoreGroup(group);
  });
  
  return div;
}

// 恢复分组
async function restoreGroup(group) {
  try {
    showLoading(true);
    
    const response = await chrome.runtime.sendMessage({
      action: 'restoreTabs',
      tabs: group.tabs
    });
    
    if (response.success) {
      showMessage(`已恢复 ${group.tabs.length} 个标签页`, 'success');
      setTimeout(() => {
        window.close();
      }, 1000);
    } else {
      showMessage('恢复失败：' + response.error, 'error');
    }
  } catch (error) {
    console.error('Error restoring group:', error);
    showMessage('恢复失败，请重试', 'error');
  } finally {
    showLoading(false);
  }
}

// 显示无分组消息
function showNoGroups() {
  const container = document.getElementById('recentGroups');
  const noGroupsMessage = document.getElementById('noGroups');
  
  container.innerHTML = '';
  noGroupsMessage.classList.remove('hidden');
}

// 显示加载状态
function showLoading(show) {
  const loadingOverlay = document.getElementById('loading');
  if (show) {
    loadingOverlay.classList.remove('hidden');
  } else {
    loadingOverlay.classList.add('hidden');
  }
}

// 显示消息
function showMessage(message, type = 'info') {
  // 移除现有消息
  const existingMessage = document.querySelector('.success-message, .error-message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  const messageDiv = document.createElement('div');
  messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
  messageDiv.textContent = message;
  
  const container = document.querySelector('.p-4');
  container.insertBefore(messageDiv, container.firstChild);
  
  // 3秒后自动移除消息
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 3000);
}

// HTML转义函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 获取当前标签页数量
async function getCurrentTabCount() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const nonPinnedTabs = tabs.filter(tab => !tab.pinned && !tab.url.includes('chrome-extension://'));
    return nonPinnedTabs.length;
  } catch (error) {
    console.error('Error getting tab count:', error);
    return 0;
  }
}

// 更新聚合按钮文本
async function updateAggregateButton() {
  const tabCount = await getCurrentTabCount();
  const aggregateBtn = document.getElementById('aggregateBtn');
  const buttonText = aggregateBtn.querySelector('span');
  
  if (tabCount > 0) {
    buttonText.textContent = `聚合当前窗口标签 (${tabCount})`;
    aggregateBtn.disabled = false;
  } else {
    buttonText.textContent = '无标签页可聚合';
    aggregateBtn.disabled = true;
    aggregateBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }
}

// 页面加载完成后更新按钮
document.addEventListener('DOMContentLoaded', () => {
  updateAggregateButton();
});