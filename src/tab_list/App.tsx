import React, { useState, useEffect, useMemo, useCallback } from "react";

// Type definitions
interface Tab {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
}

interface Group {
  id: string;
  name: string;
  tabs: Tab[];
  createdAt: string;
  locked?: boolean;
}

const App: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("grid"); // 'grid' or 'list'
  const [sort, setSort] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ groupCount: 0, tabCount: 0 });
  const [isGroupDetailModalOpen, setGroupDetailModalOpen] = useState(false);
  const [isNewGroupModalOpen, setNewGroupModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await chrome.runtime.sendMessage({ action: "getData" });
      if (response.success) {
        setGroups(response.data.groups);
        setStats({
          groupCount: response.data.groups.length,
          tabCount: response.data.groups.reduce(
            (acc: number, g: any) => acc + g.tabs.length,
            0
          ),
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredAndSortedGroups = useMemo(() => {
    return groups
      .filter((group) => {
        const lowerCaseQuery = searchQuery.toLowerCase();
        const nameMatch = group.name.toLowerCase().includes(lowerCaseQuery);
        const tabMatch = group.tabs.some(
          (tab) =>
            tab.title.toLowerCase().includes(lowerCaseQuery) ||
            tab.url.toLowerCase().includes(lowerCaseQuery)
        );
        return nameMatch || tabMatch;
      })
      .sort((a, b) => {
        switch (sort) {
          case "oldest":
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          case "name":
            return a.name.localeCompare(b.name);
          case "tabs":
            return b.tabs.length - a.tabs.length;
          case "newest":
          default:
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
        }
      });
  }, [groups, searchQuery, sort]);

  const openGroupDetail = (group: Group) => {
    setSelectedGroup(group);
    setGroupDetailModalOpen(true);
  };

  const handleNewGroup = async (name: string, tabs: Tab[]) => {
    await chrome.runtime.sendMessage({ action: "createGroup", name, tabs });
    setNewGroupModalOpen(false);
    loadData();
  };

  const openSettings = () => chrome.runtime.openOptionsPage();

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <Header
        onSearch={setSearchQuery}
        onNewGroup={() => setNewGroupModalOpen(true)}
        onOpenSettings={openSettings}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Toolbar
          stats={stats}
          sort={sort}
          onSortChange={setSort}
          view={view}
          onViewChange={setView}
        />
        {loading ? (
          <div className="text-center py-10">Loading...</div>
        ) : (
          <GroupList
            groups={filteredAndSortedGroups}
            view={view}
            onGroupClick={openGroupDetail}
          />
        )}
      </main>
      {isGroupDetailModalOpen && selectedGroup && (
        <GroupDetailModal
          group={selectedGroup}
          onClose={() => setGroupDetailModalOpen(false)}
          onUpdate={loadData}
        />
      )}
      {isNewGroupModalOpen && (
        <NewGroupModal
          onClose={() => setNewGroupModalOpen(false)}
          onSave={handleNewGroup}
        />
      )}
    </div>
  );
};

// Components
const Header: React.FC<{
  onSearch: (q: string) => void;
  onNewGroup: () => void;
  onOpenSettings: () => void;
}> = ({ onSearch, onNewGroup, onOpenSettings }) => (
  <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        <div className="flex items-center space-x-4">
          <img src="../icons/icon48.svg" alt="Uni Tab" className="w-8 h-8" />
          <h1 className="text-xl font-semibold text-gray-900">标签页管理</h1>
        </div>
        <div className="flex items-center space-x-4">
          <input
            type="text"
            placeholder="搜索..."
            onChange={(e) => onSearch(e.target.value)}
            className="input-field w-64"
          />
          <button onClick={onNewGroup} className="btn btn-primary">
            新建分组
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </header>
);

const Toolbar: React.FC<{
  stats: any;
  sort: string;
  onSortChange: (s: string) => void;
  view: string;
  onViewChange: (v: string) => void;
}> = ({ stats, sort, onSortChange, view, onViewChange }) => (
  <div className="flex items-center justify-between mb-6">
    <div className="text-sm text-gray-600">
      共 {stats.groupCount} 个分组, {stats.tabCount} 个标签页
    </div>
    <div className="flex items-center space-x-4">
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
        className="input-field"
      >
        <option value="newest">最新优先</option>
        <option value="oldest">最旧优先</option>
        <option value="name">名称排序</option>
        <option value="tabs">标签数排序</option>
      </select>
      <div className="flex items-center space-x-1 p-1 bg-gray-200 rounded-lg">
        <button
          onClick={() => onViewChange("grid")}
          className={`p-1 rounded-md ${
            view === "grid" ? "bg-white shadow-sm" : ""
          }`}
        >
          Grid
        </button>
        <button
          onClick={() => onViewChange("list")}
          className={`p-1 rounded-md ${
            view === "list" ? "bg-white shadow-sm" : ""
          }`}
        >
          List
        </button>
      </div>
    </div>
  </div>
);

const GroupList: React.FC<{
  groups: Group[];
  view: string;
  onGroupClick: (g: Group) => void;
}> = ({ groups, view, onGroupClick }) => (
  <div
    className={`grid gap-4 ${
      view === "grid"
        ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        : "grid-cols-1"
    }`}
  >
    {groups.map((group) => (
      <div
        key={group.id}
        onClick={() => onGroupClick(group)}
        className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow relative"
      >
        {group.locked && (
          <div className="absolute top-2 right-2 text-yellow-500">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
        <h3 className="font-semibold text-gray-800 truncate pr-6">
          {group.name}
        </h3>
        <p className="text-sm text-gray-500">{group.tabs.length} 个标签页</p>
        <p className="text-xs text-gray-400 mt-2">
          {new Date(group.createdAt).toLocaleString()}
        </p>
        {group.locked && (
          <span className="inline-block mt-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
            已锁定
          </span>
        )}
      </div>
    ))}
  </div>
);

const GroupDetailModal: React.FC<{
  group: Group;
  onClose: () => void;
  onUpdate: () => void;
}> = ({ group, onClose, onUpdate }) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [groupName, setGroupName] = useState(group.name);

  const handleNameSave = async () => {
    if (group.locked) {
      alert("无法修改已锁定的分组名称");
      setIsEditingName(false);
      return;
    }
    try {
      await chrome.runtime.sendMessage({
        action: "updateGroupName",
        groupId: group.id,
        newName: groupName,
      });
      setIsEditingName(false);
      onUpdate();
    } catch (error) {
      alert("修改失败: " + error.message);
    }
  };

  const handleToggleLock = async () => {
    try {
      await chrome.runtime.sendMessage({
        action: "toggleGroupLock",
        groupId: group.id,
      });
      onUpdate();
    } catch (error) {
      alert("操作失败: " + error.message);
    }
  };

  const handleDeleteGroup = async () => {
    if (group.locked) {
      alert("无法删除已锁定的分组");
      return;
    }
    if (confirm("确定要删除这个分组吗？此操作不可恢复。")) {
      try {
        await chrome.runtime.sendMessage({
          action: "deleteGroup",
          groupId: group.id,
        });
        onClose();
        onUpdate();
      } catch (error) {
        alert("删除失败: " + error.message);
      }
    }
  };

  const handleRestoreGroup = async () => {
    await chrome.runtime.sendMessage({
      action: "restoreTabs",
      tabs: group.tabs,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center space-x-3">
            {isEditingName ? (
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onBlur={handleNameSave}
                onKeyPress={(e) => e.key === "Enter" && handleNameSave()}
                autoFocus
                className="input-field"
                disabled={group.locked}
              />
            ) : (
              <h2
                onDoubleClick={() => !group.locked && setIsEditingName(true)}
                className={`text-lg font-semibold ${
                  !group.locked ? "cursor-pointer hover:text-blue-600" : ""
                }`}
                title={!group.locked ? "双击编辑名称" : "已锁定，无法编辑"}
              >
                {group.name}
              </h2>
            )}
            {group.locked && (
              <span className="inline-flex items-center px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                <svg
                  className="w-3 h-3 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
                已锁定
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          {group.tabs.map((tab) => (
            <div
              key={tab.id}
              className="flex items-center p-2 hover:bg-gray-100 rounded-md"
            >
              <img
                src={tab.favIconUrl || "../icons/icon16.svg"}
                className="w-4 h-4 mr-3"
              />
              <a
                href={tab.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 truncate"
              >
                {tab.title}
              </a>
            </div>
          ))}
        </div>
        <div className="p-4 border-t flex justify-between">
          <div className="flex space-x-2">
            <button
              onClick={handleToggleLock}
              className={`btn ${
                group.locked ? "btn-secondary" : "btn-warning"
              }`}
              title={group.locked ? "解锁分组" : "锁定分组"}
            >
              {group.locked ? (
                <>
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                  </svg>
                  解锁
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  锁定
                </>
              )}
            </button>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleDeleteGroup}
              className="btn btn-danger"
              disabled={group.locked}
              title={group.locked ? "无法删除已锁定的分组" : "删除分组"}
            >
              删除
            </button>
            <button onClick={handleRestoreGroup} className="btn btn-primary">
              恢复标签页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const NewGroupModal: React.FC<{
  onClose: () => void;
  onSave: (name: string, tabs: Tab[]) => void;
}> = ({ onClose, onSave }) => {
  const [name, setName] = useState("");
  const [tabs, setTabs] = useState<Tab[]>([]);

  useEffect(() => {
    chrome.tabs.query(
      { currentWindow: true },
      (currentTabs: chrome.tabs.Tab[]) => {
        const formattedTabs = currentTabs.map((t: chrome.tabs.Tab) => ({
          id: t.id!,
          url: t.url!,
          title: t.title!,
          favIconUrl: t.favIconUrl,
        }));
        setTabs(formattedTabs);
      }
    );
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Create New Group</h2>
        </div>
        <div className="p-4">
          <input
            type="text"
            placeholder="Group Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field w-full mb-4"
          />
          <div className="max-h-64 overflow-y-auto border rounded-md p-2">
            {tabs.map((tab) => (
              <div key={tab.id} className="flex items-center p-1">
                <img
                  src={tab.favIconUrl || "../icons/icon16.svg"}
                  className="w-4 h-4 mr-2"
                />
                <span className="truncate">{tab.title}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t flex justify-end space-x-2">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => onSave(name, tabs)}
            className="btn btn-primary"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
