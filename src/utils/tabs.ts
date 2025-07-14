/**
 * 标签页管理相关工具函数
 * 提供标签页操作的通用功能
 */

import type { TabData, TabGroup, ChromeTab } from '../types/background.js'
import { generateFavIconUrl, shouldExcludeUrl } from './storage.js'

/**
 * 标签页管理器
 * 封装所有与标签页操作相关的功能
 */
export class TabManager {
  /**
   * 获取当前窗口的所有标签页
   * @returns 标签页列表
   */
  static async getCurrentWindowTabs(): Promise<ChromeTab[]> {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true })
      return tabs as ChromeTab[]
    } catch (error) {
      console.error('Failed to get current window tabs:', error)
      return []
    }
  }

  /**
   * 获取所有窗口的标签页
   * @returns 标签页列表
   */
  static async getAllTabs(): Promise<ChromeTab[]> {
    try {
      const tabs = await chrome.tabs.query({})
      return tabs as ChromeTab[]
    } catch (error) {
      console.error('Failed to get all tabs:', error)
      return []
    }
  }

  /**
   * 过滤可保存的标签页
   * @param tabs 原始标签页列表
   * @param excludeList 排除列表
   * @param includePinned 是否包含固定标签页
   * @returns 过滤后的标签页列表
   */
  static filterSaveableTabs(tabs: ChromeTab[], excludeList: string[], includePinned = false): ChromeTab[] {
    return tabs.filter((tab: ChromeTab): boolean => {
      // 排除固定的标签页（除非明确包含）
      if (!includePinned && tab.pinned) {
        return false
      }

      // 排除当前插件的页面
      if (tab.url.includes('chrome-extension://')) {
        return false
      }

      // 排除设置中的域名
      if (shouldExcludeUrl(tab.url, excludeList)) {
        return false
      }

      // 排除无效URL
      if (!tab.url || tab.url === 'about:blank') {
        return false
      }

      return true
    })
  }

  /**
   * 将Chrome标签页转换为TabData格式
   * @param tab Chrome标签页对象
   * @returns TabData对象
   */
  static chromeTabToTabData(tab: ChromeTab): TabData {
    return {
      id: tab.id,
      title: tab.title || '未命名标签页',
      url: tab.url,
      favIconUrl: tab.favIconUrl || generateFavIconUrl(tab.url)
    }
  }

  /**
   * 批量转换Chrome标签页为TabData格式
   * @param tabs Chrome标签页列表
   * @returns TabData列表
   */
  static chromeTabsToTabData(tabs: ChromeTab[]): TabData[] {
    return tabs.map((tab) => this.chromeTabToTabData(tab))
  }

  /**
   * 恢复标签页
   * @param tabs 要恢复的标签页列表
   * @param openInNewWindow 是否在新窗口中打开
   * @returns 创建的标签页ID列表
   */
  static async restoreTabs(tabs: TabData[], openInNewWindow = false): Promise<number[]> {
    try {
      const createdTabIds: number[] = []

      if (openInNewWindow && tabs.length > 0) {
        // 在新窗口中打开所有标签页
        const window = await chrome.windows.create({
          url: tabs[0].url,
          focused: true
        })

        // 检查窗口是否创建成功
        if (!window?.id) {
          throw new Error('Failed to create new window')
        }

        if (window.tabs && window.tabs[0]?.id) {
          createdTabIds.push(window.tabs[0].id)
        }

        // 在同一窗口中打开其余标签页
        for (let i = 1; i < tabs.length; i++) {
          const tab = await chrome.tabs.create({
            url: tabs[i].url,
            windowId: window.id,
            active: false
          })
          if (tab.id) {
            createdTabIds.push(tab.id)
          }
        }
      } else {
        // 在当前窗口中打开标签页
        for (const tabData of tabs) {
          const tab = await chrome.tabs.create({
            url: tabData.url,
            active: false
          })
          if (tab.id) {
            createdTabIds.push(tab.id)
          }
        }
      }

      console.log(`Restored ${tabs.length} tabs`)
      return createdTabIds
    } catch (error) {
      console.error('Error restoring tabs:', error)
      throw error
    }
  }

  /**
   * 关闭标签页
   * @param tabIds 要关闭的标签页ID列表
   */
  static async closeTabs(tabIds: number[]): Promise<void> {
    try {
      const validTabIds = tabIds.filter((id) => typeof id === 'number' && id > 0)
      if (validTabIds.length > 0) {
        await chrome.tabs.remove(validTabIds)
        console.log(`Closed ${validTabIds.length} tabs`)
      }
    } catch (error) {
      console.error('Error closing tabs:', error)
      throw error
    }
  }

  /**
   * 获取标签页的详细信息
   * @param tabId 标签页ID
   * @returns 标签页信息
   */
  static async getTabInfo(tabId: number): Promise<ChromeTab | null> {
    try {
      const tab = await chrome.tabs.get(tabId)
      return tab as ChromeTab
    } catch (error) {
      console.error(`Failed to get tab info for ID ${tabId}:`, error)
      return null
    }
  }

  /**
   * 激活指定标签页
   * @param tabId 标签页ID
   */
  static async activateTab(tabId: number): Promise<void> {
    try {
      const tab = await chrome.tabs.get(tabId)
      if (!tab) {
        throw new Error(`Tab ${tabId} not found`)
      }

      await chrome.tabs.update(tabId, { active: true })

      // 如果标签页在其他窗口，则聚焦到该窗口
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true })
      }
    } catch (error) {
      console.error(`Failed to activate tab ${tabId}:`, error)
      throw error
    }
  }

  /**
   * 重新加载标签页
   * @param tabId 标签页ID
   */
  static async reloadTab(tabId: number): Promise<void> {
    try {
      await chrome.tabs.reload(tabId)
    } catch (error) {
      console.error(`Failed to reload tab ${tabId}:`, error)
      throw error
    }
  }

  /**
   * 复制标签页
   * @param tabId 要复制的标签页ID
   * @returns 新标签页ID
   */
  static async duplicateTab(tabId: number): Promise<number | null> {
    try {
      const tab = await chrome.tabs.duplicate(tabId)
      return tab?.id || null
    } catch (error) {
      console.error(`Failed to duplicate tab ${tabId}:`, error)
      return null
    }
  }

  /**
   * 检查标签页是否存在
   * @param tabId 标签页ID
   * @returns 是否存在
   */
  static async tabExists(tabId: number): Promise<boolean> {
    try {
      await chrome.tabs.get(tabId)
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取标签页的截图
   * @param tabId 标签页ID
   * @returns 截图数据URL
   */
  static async captureTab(tabId: number): Promise<string | null> {
    try {
      // 首先激活标签页
      await this.activateTab(tabId)

      // 等待一小段时间确保页面渲染完成
      await new Promise((resolve) => setTimeout(resolve, 500))

      // 捕获截图
      const dataUrl = await chrome.tabs.captureVisibleTab()
      return dataUrl
    } catch (error) {
      console.error(`Failed to capture tab ${tabId}:`, error)
      return null
    }
  }
}

/**
 * 分组管理相关工具函数
 */
export class GroupManager {
  /**
   * 验证分组数据的完整性
   * @param group 分组对象
   * @returns 是否有效
   */
  static validateGroup(group: Partial<TabGroup>): boolean {
    return !!(group.id && group.name && group.tabs && Array.isArray(group.tabs))
  }

  /**
   * 清理分组中的无效标签页
   * @param group 分组对象
   * @returns 清理后的分组
   */
  static cleanGroup(group: TabGroup): TabGroup {
    const validTabs = group.tabs.filter((tab) => tab.url && tab.title && tab.url !== 'about:blank')

    return {
      ...group,
      tabs: validTabs
    }
  }

  /**
   * 合并重复的标签页
   * @param tabs 标签页列表
   * @returns 去重后的标签页列表
   */
  static deduplicateTabs(tabs: TabData[]): TabData[] {
    const seen = new Set<string>()
    return tabs.filter((tab) => {
      if (seen.has(tab.url)) {
        return false
      }
      seen.add(tab.url)
      return true
    })
  }

  /**
   * 按域名对标签页进行分组
   * @param tabs 标签页列表
   * @returns 按域名分组的标签页
   */
  static groupTabsByDomain(tabs: TabData[]): Record<string, TabData[]> {
    const groups: Record<string, TabData[]> = {}

    tabs.forEach((tab) => {
      try {
        const domain = new URL(tab.url).hostname
        if (!groups[domain]) {
          groups[domain] = []
        }
        groups[domain].push(tab)
      } catch {
        // 无效URL，归类到"其他"
        if (!groups['其他']) {
          groups['其他'] = []
        }
        groups['其他'].push(tab)
      }
    })

    return groups
  }

  /**
   * 计算分组的统计信息
   * @param group 分组对象
   * @returns 统计信息
   */
  static getGroupStats(group: TabGroup) {
    const domains = new Set<string>()
    let totalSize = 0

    group.tabs.forEach((tab) => {
      try {
        domains.add(new URL(tab.url).hostname)
        totalSize += (tab.title.length + tab.url.length) * 2 // 粗略估算
      } catch {
        // 忽略无效URL
      }
    })

    return {
      tabCount: group.tabs.length,
      domainCount: domains.size,
      estimatedSize: totalSize,
      createdAt: group.createdAt,
      isLocked: group.locked || false
    }
  }
}
