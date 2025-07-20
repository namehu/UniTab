import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Header, Toolbar, GroupList, GroupDetailModal, NewGroupModal, SyncSettings } from './components'
import type { Tab, Group, Stats, SortType, ViewType } from './types'

const App: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewType>('list')
  const [sort, setSort] = useState<SortType>('newest')
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState<Stats>({ groupCount: 0, tabCount: 0 })
  const [isGroupDetailModalOpen, setGroupDetailModalOpen] = useState(false)
  const [isNewGroupModalOpen, setNewGroupModalOpen] = useState(false)
  const [isSyncSettingsOpen, setIsSyncSettingsOpen] = useState(false)

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await chrome.runtime.sendMessage({ action: 'getData' })
      if (response.success) {
        setGroups(response.data.groups)
        setStats({
          groupCount: response.data.groups.length,
          tabCount: response.data.groups.reduce((acc: number, g: any) => acc + g.tabs.length, 0)
        })
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredAndSortedGroups = useMemo(() => {
    return groups
      .filter((group) => {
        const lowerCaseQuery = searchQuery.toLowerCase()
        const nameMatch = group.name.toLowerCase().includes(lowerCaseQuery)
        const tabMatch = group.tabs.some(
          (tab) => tab.title.toLowerCase().includes(lowerCaseQuery) || tab.url.toLowerCase().includes(lowerCaseQuery)
        )
        return nameMatch || tabMatch
      })
      .sort((a, b) => {
        switch (sort) {
          case 'oldest':
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          case 'name':
            return a.name.localeCompare(b.name)
          case 'tabs':
            return b.tabs.length - a.tabs.length
          case 'newest':
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
      })
  }, [groups, searchQuery, sort])

  const openGroupDetail = (group: Group) => {
    setSelectedGroup(group)
    setGroupDetailModalOpen(true)
  }

  const handleGroupUpdate = useCallback(async () => {
    await loadData()
    // 更新selectedGroup以反映最新状态
    if (selectedGroup) {
      const response = await chrome.runtime.sendMessage({ action: 'getData' })
      if (response.success) {
        const updatedGroup = response.data.groups.find((g: Group) => g.id === selectedGroup.id)
        if (updatedGroup) {
          setSelectedGroup(updatedGroup)
        }
      }
    }
  }, [loadData, selectedGroup])

  const handleNewGroup = async (name: string, tabs: Tab[]) => {
    await chrome.runtime.sendMessage({ action: 'createGroup', name, tabs })
    setNewGroupModalOpen(false)
    loadData()
  }

  const openSettings = () => chrome.runtime.openOptionsPage()

  const handleOpenSyncSettings = () => {
    setIsSyncSettingsOpen(true)
  }

  const handleCloseSyncSettings = () => {
    setIsSyncSettingsOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        onSearch={setSearchQuery} 
        onNewGroup={() => setNewGroupModalOpen(true)} 
        onOpenSettings={openSettings}
        onOpenSyncSettings={handleOpenSyncSettings}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Toolbar stats={stats} sort={sort} onSortChange={setSort} view={view} onViewChange={setView} />
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        ) : (
          <GroupList groups={filteredAndSortedGroups} view={view} onGroupClick={openGroupDetail} />
        )}
      </main>
      {isGroupDetailModalOpen && selectedGroup && (
        <GroupDetailModal group={selectedGroup} onClose={() => setGroupDetailModalOpen(false)} onUpdate={handleGroupUpdate} />
      )}
      {isNewGroupModalOpen && <NewGroupModal onClose={() => setNewGroupModalOpen(false)} onSave={handleNewGroup} />}
      <SyncSettings
        isOpen={isSyncSettingsOpen}
        onClose={handleCloseSyncSettings}
      />

    </div>
  )
}

export default App
