// Tab Sorter Pro - Tab List JavaScript
// 标签页列表管理的核心逻辑

// 全局状态
let currentData = { groups: [] };
let currentView = 'grid'; // 'grid' 或 'list'
let currentSort = 'newest';
let searchQuery = '';
let selectedGroup = null;

// DOM 元素
let elements = {};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
  await loadData();
  updateUI();
  
  // 检查URL哈希，如果有特定分组ID则打开详情
  checkUrlHash();
});

// 初始化DOM元素引用
function initializeElements() {
  elements = {
    // 搜索和控制
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    gridViewBtn: document.getElementById('gridViewBtn'),
    listViewBtn: document.getElementById('listViewBtn'),
    
    // 统计信息
    totalGroups: document.getElementById('totalGroups'),
    totalTabs: document.getElementById('totalTabs'),
    lastActivity: document.getElementById('lastActivity'),
    
    // 分组容器
    groupsContainer: document.getElementById('groupsContainer'),
    groupsList: document.getElementById('groupsList'),
    loadingState: document.getElementById('loadingState'),
    emptyState: document.getElementById('emptyState'),
    
    // 按钮
    newGroupBtn: document.getElementById('newGroupBtn'),
    emptyNewGroupBtn: document.getElementById('emptyNewGroupBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    
    // 新建分组模态框
    newGroupModal: document.getElementById('newGroupModal'),
    groupName: document.getElementById('groupName'),
    currentTabsList: document.getElementById('currentTabsList'),
    cancelNewGroup: document.getElementById('cancelNewGroup'),
    confirmNewGroup: document.getElementById('confirmNewGroup'),
    
    // 分组详情模态框
    groupDetailModal: document.getElementById('groupDetailModal'),
    groupDetailTitle: document.getElementById('groupDetailTitle'),
    groupDetailContent: document.getElementById('groupDetailContent'),
    closeGroupDetail: document.getElementById('closeGroupDetail'),
    editGroupBtn: document.getElementById('editGroupBtn'),
    deleteGroupBtn: document.getElementById('deleteGroupBtn'),
    restoreAllTabsBtn: document.getElementById('restoreAllTabsBtn'),
    
    // 通知
    notification: document.getElementById('notification'),
    notificationIcon: document.getElementById('notificationIcon'),
    notificationMessage: document.getElementById('notificationMessage'),
    closeNotification: document.getElementById('closeNotification')
  };
}

// 设置事件监听器
function setupEventListeners() {
  // 搜索
  elements.searchInput.addEventListener('input', handleSearch);
  
  // 排序
  elements.sortSelect.addEventListener('change', handleSort);
  
  // 视图切换
  elements.gridViewBtn.addEventListener('click', () => switchView('grid'));
  elements.listViewBtn.addEventListener('click', () => switchView('list'));
  
  // 新建分组
  elements.newGroupBtn.addEventListener('click', openNewGroupModal);
  elements.emptyNewGroupBtn.addEventListener('click', openNewGroupModal);
  elements.cancelNewGroup.addEventListener('click', closeNewGroupModal);
  elements.confirmNewGroup.addEventListener('click', createNewGroup);
  
  // 分组详情
  elements.closeGroupDetail.addEventListener('click', closeGroupDetailModal);
  elements.editGroupBtn.addEventListener('click', editGroup);
  elements.deleteGroupBtn.addEventListener('click', deleteGroup);
  elements.restoreAllTabsBtn.addEventListener('click', restoreAllTabs);
  
  // 设置
  elements.settingsBtn.addEventListener('click', openSettings);
  
  // 通知
  elements.closeNotification.addEventListener('click', hideNotification);
  
  // 模态框外部点击关闭
  elements.newGroupModal.addEventListener('click', (e) => {
    if (e.target === elements.newGroupModal) {
      closeNewGroupModal();
    }
  });
  
  elements.groupDetailModal.addEventListener('click', (e) => {
    if (e.target === elements.groupDetailModal) {
      closeGroupDetailModal();
    }
  });
  
  // 键盘快捷键
  document.addEventListener('keydown', handleKeyboard);
}

// 加载数据
async function loadData() {
  try {
    showLoading(true);
    
    const response = await chrome.runtime.sendMessage({ action: 'getData' });
    
    if (response.success) {
      currentData = response.data;
    } else {
      console.error('Failed to load data:', response.error);
      showNotification('加载数据失败', 'error');
    }
  } catch (error) {
    console.error('Error loading data:', error);
    showNotification('加载数据时发生错误', 'error');
  } finally {
    showLoading(false);
  }
}

// 更新UI
function updateUI() {
  updateStats();
  updateGroupsList();
}

// 更新统计信息
function updateStats() {
  const totalGroups = currentData.groups.length;
  const totalTabs = currentData.groups.reduce((sum, group) => sum + group.tabs.length, 0);
  
  elements.totalGroups.textContent = totalGroups;
  elements.totalTabs.textContent = totalTabs;
  
  // 最近活动
  if (totalGroups > 0) {
    const latestGroup = currentData.groups[0];
    const lastActivity = new Date(latestGroup.createdAt).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });
    elements.lastActivity.textContent = lastActivity;
  } else {
    elements.lastActivity.textContent = '--';
  }
}

// 更新分组列表
function updateGroupsList() {
  const filteredGroups = getFilteredGroups();
  
  if (filteredGroups.length === 0) {
    showEmptyState();
  } else {
    showGroupsList(filteredGroups);
  }
}

// 获取过滤后的分组
function getFilteredGroups() {
  let groups = [...currentData.groups];
  
  // 搜索过滤
  if (searchQuery) {
    groups = groups.filter(group => {
      const nameMatch = group.name.toLowerCase().includes(searchQuery.toLowerCase());
      const tabMatch = group.tabs.some(tab => 
        tab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tab.url.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return nameMatch || tabMatch;
    });
  }
  
  // 排序
  groups.sort((a, b) => {
    switch (currentSort) {
      case 'newest':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'oldest':
        return new Date(a.createdAt) - new Date(b.createdAt);
      case 'name':
        return a.name.localeCompare(b.name);
      case 'tabs':
        return b.tabs.length - a.tabs.length;
      default:
        return 0;
    }
  });
  
  return groups;
}

// 显示空状态
function showEmptyState() {
  elements.groupsList.classList.add('hidden');
  elements.emptyState.classList.remove('hidden');
}

// 显示分组列表
function showGroupsList(groups) {
  elements.emptyState.classList.add('hidden');
  elements.groupsList.classList.remove('hidden');
  
  // 设置视图类名
  elements.groupsList.className = currentView === 'grid' ? 'grid-view' : 'list-view';
  
  // 渲染分组
  elements.groupsList.innerHTML = groups.map(group => createGroupCard(group)).join('');
  
  // 添加事件监听器
  addGroupEventListeners();
}

// 创建分组卡片
function createGroupCard(group) {
  const createdDate = new Date(group.createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const previewTabs = group.tabs.slice(0, 3);
  const remainingCount = Math.max(0, group.tabs.length - 3);
  
  return `
    <div class="group-card bg-white rounded-lg shadow-sm border border-gray-200 p-6 fade-in" data-group-id="${group.id}">
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold text-gray-900 truncate mb-1">${escapeHtml(group.name)}</h3>
          <p class="text-sm text-gray-500">
            ${group.tabs.length} 个标签页 • ${createdDate}
          </p>
        </div>
        
        <div class="group-actions flex items-center space-x-2 ml-4">
          <button class="restore-group-btn text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50" title="恢复所有标签页">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </button>
          
          <button class="delete-group-btn text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50" title="删除分组">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="space-y-2 mb-4">
        ${previewTabs.map(tab => `
          <div class="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer tab-preview" data-url="${escapeHtml(tab.url)}">
            <img src="${getFaviconUrl(tab.url)}" alt="" class="favicon" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
            <div class="favicon error" style="display: none;">🌐</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">${highlightSearch(escapeHtml(tab.title))}</p>
              <p class="text-xs text-gray-500 truncate">${highlightSearch(escapeHtml(tab.url))}</p>
            </div>
          </div>
        `).join('')}
        
        ${remainingCount > 0 ? `
          <div class="text-center py-2">
            <span class="text-sm text-gray-500">还有 ${remainingCount} 个标签页...</span>
          </div>
        ` : ''}
      </div>
      
      <div class="flex items-center justify-between">
        <div class="tab-counter">
          ${group.tabs.length}
        </div>
        
        <button class="view-details-btn text-blue-600 hover:text-blue-800 text-sm font-medium">
          查看详情 →
        </button>
      </div>
    </div>
  `;
}

// 添加分组事件监听器
function addGroupEventListeners() {
  // 查看详情
  document.querySelectorAll('.view-details-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const groupId = e.target.closest('.group-card').dataset.groupId;
      openGroupDetail(groupId);
    });
  });
  
  // 恢复分组
  document.querySelectorAll('.restore-group-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const groupId = e.target.closest('.group-card').dataset.groupId;
      restoreGroup(groupId);
    });
  });
  
  // 删除分组
  document.querySelectorAll('.delete-group-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const groupId = e.target.closest('.group-card').dataset.groupId;
      confirmDeleteGroup(groupId);
    });
  });
  
  // 标签页预览点击
  document.querySelectorAll('.tab-preview').forEach(preview => {
    preview.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = preview.dataset.url;
      chrome.tabs.create({ url });
    });
  });
  
  // 分组卡片点击
  document.querySelectorAll('.group-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.group-actions, .tab-preview, .view-details-btn')) {
        const groupId = card.dataset.groupId;
        openGroupDetail(groupId);
      }
    });
  });
}

// 处理搜索
function handleSearch(e) {
  searchQuery = e.target.value;
  updateGroupsList();
}

// 处理排序
function handleSort(e) {
  currentSort = e.target.value;
  updateGroupsList();
}

// 切换视图
function switchView(view) {
  currentView = view;
  
  // 更新按钮状态
  if (view === 'grid') {
    elements.gridViewBtn.classList.add('bg-blue-600', 'text-white');
    elements.gridViewBtn.classList.remove('bg-white', 'text-gray-700');
    elements.listViewBtn.classList.remove('bg-blue-600', 'text-white');
    elements.listViewBtn.classList.add('bg-white', 'text-gray-700');
  } else {
    elements.listViewBtn.classList.add('bg-blue-600', 'text-white');
    elements.listViewBtn.classList.remove('bg-white', 'text-gray-700');
    elements.gridViewBtn.classList.remove('bg-blue-600', 'text-white');
    elements.gridViewBtn.classList.add('bg-white', 'text-gray-700');
  }
  
  updateGroupsList();
}

// 打开新建分组模态框
async function openNewGroupModal() {
  try {
    // 获取当前窗口的标签页
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const validTabs = tabs.filter(tab => 
      !tab.pinned && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://')
    );
    
    // 渲染标签页列表
    elements.currentTabsList.innerHTML = validTabs.map(tab => `
      <div class="flex items-center space-x-3 p-3 border-b border-gray-100 last:border-b-0">
        <input type="checkbox" class="tab-checkbox" data-tab-id="${tab.id}" checked>
        <img src="${getFaviconUrl(tab.url)}" alt="" class="favicon" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
        <div class="favicon error" style="display: none;">🌐</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">${escapeHtml(tab.title)}</p>
          <p class="text-xs text-gray-500 truncate">${escapeHtml(tab.url)}</p>
        </div>
      </div>
    `).join('');
    
    // 生成默认分组名称
    const now = new Date();
    const defaultName = `分组 ${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    elements.groupName.value = defaultName;
    
    // 显示模态框
    elements.newGroupModal.classList.remove('hidden');
    elements.groupName.focus();
    elements.groupName.select();
    
  } catch (error) {
    console.error('Error opening new group modal:', error);
    showNotification('获取标签页列表失败', 'error');
  }
}

// 关闭新建分组模态框
function closeNewGroupModal() {
  elements.newGroupModal.classList.add('hidden');
  elements.groupName.value = '';
  elements.currentTabsList.innerHTML = '';
}

// 创建新分组
async function createNewGroup() {
  const name = elements.groupName.value.trim();
  if (!name) {
    showNotification('请输入分组名称', 'warning');
    return;
  }
  
  // 获取选中的标签页
  const selectedCheckboxes = elements.currentTabsList.querySelectorAll('.tab-checkbox:checked');
  if (selectedCheckboxes.length === 0) {
    showNotification('请至少选择一个标签页', 'warning');
    return;
  }
  
  try {
    const selectedTabIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.tabId));
    
    // 获取标签页详细信息
    const tabs = await Promise.all(
      selectedTabIds.map(id => chrome.tabs.get(id))
    );
    
    const tabData = tabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl
    }));
    
    // 创建分组
    const response = await chrome.runtime.sendMessage({
      action: 'saveData',
      data: {
        groups: [{
          id: Date.now().toString(),
          name: name,
          tabs: tabData,
          createdAt: new Date().toISOString()
        }, ...currentData.groups]
      }
    });
    
    if (response.success) {
      // 关闭选中的标签页
      await chrome.tabs.remove(selectedTabIds);
      
      // 更新本地数据
      await loadData();
      updateUI();
      
      closeNewGroupModal();
      showNotification(`成功创建分组 "${name}"`, 'success');
    } else {
      showNotification('创建分组失败', 'error');
    }
    
  } catch (error) {
    console.error('Error creating new group:', error);
    showNotification('创建分组时发生错误', 'error');
  }
}

// 打开分组详情
function openGroupDetail(groupId) {
  const group = currentData.groups.find(g => g.id === groupId);
  if (!group) return;
  
  selectedGroup = group;
  
  elements.groupDetailTitle.textContent = group.name;
  
  const createdDate = new Date(group.createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  elements.groupDetailContent.innerHTML = `
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <h4 class="text-lg font-medium text-gray-900">分组信息</h4>
        <span class="tab-counter">${group.tabs.length} 个标签页</span>
      </div>
      <p class="text-sm text-gray-500">创建时间：${createdDate}</p>
    </div>
    
    <div>
      <h4 class="text-lg font-medium text-gray-900 mb-4">标签页列表</h4>
      <div class="space-y-2 max-h-96 overflow-y-auto">
        ${group.tabs.map((tab, index) => `
          <div class="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer tab-item" data-url="${escapeHtml(tab.url)}">
            <span class="text-sm text-gray-400 w-6">${index + 1}</span>
            <img src="${getFaviconUrl(tab.url)}" alt="" class="favicon" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
            <div class="favicon error" style="display: none;">🌐</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">${escapeHtml(tab.title)}</p>
              <p class="text-xs text-gray-500 truncate">${escapeHtml(tab.url)}</p>
            </div>
            <button class="restore-single-tab text-blue-600 hover:text-blue-800 p-1" title="恢复此标签页">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  // 添加标签页点击事件
  elements.groupDetailContent.querySelectorAll('.tab-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.restore-single-tab')) {
        const url = item.dataset.url;
        chrome.tabs.create({ url });
      }
    });
  });
  
  // 添加单个标签页恢复事件
  elements.groupDetailContent.querySelectorAll('.restore-single-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = e.target.closest('.tab-item').dataset.url;
      chrome.tabs.create({ url });
      showNotification('标签页已恢复', 'success');
    });
  });
  
  elements.groupDetailModal.classList.remove('hidden');
}

// 关闭分组详情模态框
function closeGroupDetailModal() {
  elements.groupDetailModal.classList.add('hidden');
  selectedGroup = null;
}

// 恢复分组
async function restoreGroup(groupId) {
  const group = currentData.groups.find(g => g.id === groupId);
  if (!group) return;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'restoreTabs',
      tabs: group.tabs
    });
    
    if (response.success) {
      showNotification(`已恢复 ${group.tabs.length} 个标签页`, 'success');
    } else {
      showNotification('恢复标签页失败', 'error');
    }
  } catch (error) {
    console.error('Error restoring group:', error);
    showNotification('恢复标签页时发生错误', 'error');
  }
}

// 确认删除分组
function confirmDeleteGroup(groupId) {
  const group = currentData.groups.find(g => g.id === groupId);
  if (!group) return;
  
  if (confirm(`确定要删除分组 "${group.name}" 吗？此操作无法撤销。`)) {
    deleteGroupById(groupId);
  }
}

// 删除分组
async function deleteGroupById(groupId) {
  try {
    const updatedGroups = currentData.groups.filter(g => g.id !== groupId);
    
    const response = await chrome.runtime.sendMessage({
      action: 'saveData',
      data: { groups: updatedGroups }
    });
    
    if (response.success) {
      currentData.groups = updatedGroups;
      updateUI();
      showNotification('分组已删除', 'success');
    } else {
      showNotification('删除分组失败', 'error');
    }
  } catch (error) {
    console.error('Error deleting group:', error);
    showNotification('删除分组时发生错误', 'error');
  }
}

// 编辑分组
function editGroup() {
  if (!selectedGroup) return;
  
  const newName = prompt('请输入新的分组名称:', selectedGroup.name);
  if (newName && newName.trim() && newName.trim() !== selectedGroup.name) {
    updateGroupName(selectedGroup.id, newName.trim());
  }
}

// 更新分组名称
async function updateGroupName(groupId, newName) {
  try {
    const updatedGroups = currentData.groups.map(group => 
      group.id === groupId ? { ...group, name: newName } : group
    );
    
    const response = await chrome.runtime.sendMessage({
      action: 'saveData',
      data: { groups: updatedGroups }
    });
    
    if (response.success) {
      currentData.groups = updatedGroups;
      selectedGroup.name = newName;
      elements.groupDetailTitle.textContent = newName;
      updateUI();
      showNotification('分组名称已更新', 'success');
    } else {
      showNotification('更新分组名称失败', 'error');
    }
  } catch (error) {
    console.error('Error updating group name:', error);
    showNotification('更新分组名称时发生错误', 'error');
  }
}

// 删除当前分组
function deleteGroup() {
  if (!selectedGroup) return;
  
  if (confirm(`确定要删除分组 "${selectedGroup.name}" 吗？此操作无法撤销。`)) {
    deleteGroupById(selectedGroup.id);
    closeGroupDetailModal();
  }
}

// 恢复所有标签页
function restoreAllTabs() {
  if (!selectedGroup) return;
  
  restoreGroup(selectedGroup.id);
}

// 打开设置
function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
}

// 显示加载状态
function showLoading(show) {
  if (show) {
    elements.loadingState.classList.remove('hidden');
    elements.groupsList.classList.add('hidden');
    elements.emptyState.classList.add('hidden');
  } else {
    elements.loadingState.classList.add('hidden');
  }
}

// 显示通知
function showNotification(message, type = 'info') {
  const icons = {
    success: '<svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
    error: '<svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
    warning: '<svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg>',
    info: '<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
  };
  
  elements.notificationIcon.innerHTML = icons[type] || icons.info;
  elements.notificationMessage.textContent = message;
  elements.notification.className = `notification ${type} fixed top-4 right-4 z-50`;
  elements.notification.classList.remove('hidden');
  
  // 自动隐藏
  setTimeout(() => {
    hideNotification();
  }, 5000);
}

// 隐藏通知
function hideNotification() {
  elements.notification.classList.add('hidden');
}

// 键盘快捷键处理
function handleKeyboard(e) {
  // Ctrl/Cmd + N: 新建分组
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    openNewGroupModal();
  }
  
  // Escape: 关闭模态框
  if (e.key === 'Escape') {
    if (!elements.newGroupModal.classList.contains('hidden')) {
      closeNewGroupModal();
    }
    if (!elements.groupDetailModal.classList.contains('hidden')) {
      closeGroupDetailModal();
    }
  }
  
  // Ctrl/Cmd + F: 聚焦搜索框
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    elements.searchInput.focus();
  }
}

// 检查URL哈希
function checkUrlHash() {
  const hash = window.location.hash;
  if (hash.startsWith('#group-')) {
    const groupId = hash.substring(7);
    setTimeout(() => {
      openGroupDetail(groupId);
    }, 500);
  }
}

// 工具函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
  } catch {
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
  }
}

function highlightSearch(text) {
  if (!searchQuery) return text;
  
  const regex = new RegExp(`(${escapeRegex(searchQuery)})`, 'gi');
  return text.replace(regex, '<span class="search-highlight">$1</span>');
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}