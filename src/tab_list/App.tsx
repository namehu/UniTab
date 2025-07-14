import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Header, Toolbar, GroupList, GroupDetailModal, NewGroupModal, SyncSettings } from './components'
import type { Tab, Group, Stats, SortType, ViewType } from './types'
import { syncManager } from '../utils/sync/SyncManager'

const App: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewType>('grid')
  const [sort, setSort] = useState<SortType>('newest')
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState<Stats>({ groupCount: 0, tabCount: 0 })
  const [isGroupDetailModalOpen, setGroupDetailModalOpen] = useState(false)
  const [isNewGroupModalOpen, setNewGroupModalOpen] = useState(false)
  const [isSyncSettingsOpen, setSyncSettingsOpen] = useState(false)
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
    
    // 监听同步状态变化，同步成功后刷新数据
    const handleSyncStatusChange = (status: string) => {
      if (status === 'success') {
        console.log('Sync completed, refreshing data...')
        loadData()
      }
    }
    
    syncManager.onStatusChange(handleSyncStatusChange)
    
    // 清理监听器
    return () => {
      syncManager.offStatusChange(handleSyncStatusChange)
    }
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

  const handleNewGroup = async (name: string, tabs: Tab[]) => {
    await chrome.runtime.sendMessage({ action: 'createGroup', name, tabs })
    setNewGroupModalOpen(false)
    loadData()
  }

  const openSettings = () => chrome.runtime.openOptionsPage()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        onSearch={setSearchQuery} 
        onNewGroup={() => setNewGroupModalOpen(true)} 
        onOpenSettings={openSettings}
        onOpenSyncSettings={() => setSyncSettingsOpen(true)}
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
        <GroupDetailModal group={selectedGroup} onClose={() => setGroupDetailModalOpen(false)} onUpdate={loadData} />
      )}
      {isNewGroupModalOpen && <NewGroupModal onClose={() => setNewGroupModalOpen(false)} onSave={handleNewGroup} />}
      {isSyncSettingsOpen && <SyncSettings isOpen={isSyncSettingsOpen} onClose={() => setSyncSettingsOpen(false)} />}
    </div>
  )
}

export default App
