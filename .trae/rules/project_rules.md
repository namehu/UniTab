技术设计文档 (TDD) - Uni Tab


1. 系统架构
本插件将基于 Chrome Manifest V3 规范进行开发，以确保安全性和未来的兼容性。

核心组件:

background.js (Service Worker):
职责: 作为插件的大脑，它是一个常驻（或事件驱动）的后台脚本。
功能:
监听浏览器事件，如点击插件图标 (action.onClicked)。
执行核心的标签页获取和关闭逻辑。
处理所有与 chrome.storage 的数据交互。
管理与远程服务（如 GitHub API）的通信和同步逻辑。
处理跨组件的消息传递。

popup/ (Action Popup):
文件: popup.html,  popup目录

职责: 点击浏览器工具栏图标时出现的交互式小窗口。
功能:
提供主要的“聚合当前窗口标签”按钮。
显示最近的几个标签分组，提供快速恢复入口。
提供一个入口跳转到完整的聚合页。

tab_list/ (主聚合页):

文件: tab_list.html, tab_list目录
职责: 插件的核心界面，用于展示和管理所有保存的标签页。
功能:
从 chrome.storage 读取并渲染所有标签页分组。
实现恢复、删除、重命名、锁定等所有交互逻辑。
实现搜索功能。

options/ (选项页):

文件: options.html, options目录

职责: 提供插件的配置界面。
功能:
处理 GitHub OAuth 授权流程。
管理用户设置（如排除列表）并将其保存到 chrome.storage。
实现数据的导入和导出。

2. 技术选型
核心语言: HTML5, CSS3, JavaScript (ES6+) Typescript。
UI 框架: 引入 React 来构建动态 UI。
UI 组件库(可选/按需使用)： Antd 5.x
CSS 方案: Tailwind CSS。利用其原子化的 class 来快速构建美观、响应式的界面，无需编写大量自定义 CSS。
图标: Lucide Icons 或 Feather Icons，轻量且风格现代。
打包工具: 引入 Vite 进行模块化管理和打包。
使用 pnpm管理包

3. 数据结构
数据将以 JSON 格式存储在 chrome.storage.local 中。远程同步的也是这个 JSON 对象。

主数据结构 (data.json):

{
  "version": "1.0.0",
  "settings": {
    "sync": {
      "provider": "github",
      "gistId": "YOUR_GIST_ID",
      "lastSync": "2025-07-15T12:00:00Z"
    },
    "excludeList": [
      "chrome://",
      "localhost"
    ]
  },
  "groups": [
    {
      "id": 1678886400000, // 使用创建时的时间戳作为唯一 ID
      "name": "项目 A 技术调研",
      "createdAt": "2025-07-15T10:00:00Z",
      "pinned": true,
      "tabs": [
        {
          "title": "Manifest V3 - Chrome Developers",
          "url": "https://developer.chrome.com/docs/extensions/mv3/intro/",
          "favIconUrl": "https://www.google.com/s2/favicons?sz=64&domain_url=developer.chrome.com"
        },
        {
          "title": "Tailwind CSS - Rapidly build modern websites without ever leaving your HTML.",
          "url": "https://tailwindcss.com/",
          "favIconUrl": "https://www.google.com/s2/favicons?sz=64&domain_url=tailwindcss.com"
        }
      ]
    }
  ]
}

4. manifest.json 关键权限

5. 开发里程碑
第一阶段 (MVP 核心功能) 已完成:

搭建项目基本结构，配置 manifest.json。

完成 background.js 的核心逻辑：获取标签页、保存到 storage。
开发 tab_list.html 页面，实现标签分组的渲染、恢复和删除功能。
开发 popup.html，实现一键聚合功能。

第二阶段 (远程同步):

在 options.html 中集成 GitHub OAuth 流程，使用 chrome.identity API 获取 token。

在 background.js 中实现与 GitHub Gist API 的交互逻辑（拉取、推送数据）。

添加手动和定时自动同步功能。

第三阶段 (功能完善):

在 tab_list.html 中加入搜索功能。

完善 options.html 的所有配置项。

实现分组命名、锁定等高级管理功能。

第四阶段 (测试与发布):

进行全面的功能测试和兼容性测试。

修复 Bug，优化性能和用户体验。

准备相关素材，上架到 Chrome 应用商店。