import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'zh-CN',
  title: 'AWA-Helper',
  description: 'AWA-Helper 使用与配置说明',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '使用指南', link: '/guide/getting-started' },
      { text: '配置参考', link: '/reference/configuration' }
    ],
    sidebar: [
      {
        text: '使用指南',
        items: [
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '运行方式', link: '/guide/running' }
        ]
      },
      {
        text: '参考',
        items: [
          { text: '配置文件', link: '/reference/configuration' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/HCLonely/AWA-Helper' }
    ],
    editLink: {
      pattern: 'https://github.com/HCLonely/AWA-Helper/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },
    lastUpdated: {
      text: '最后更新'
    },
    outline: {
      label: '本页目录',
      level: [2, 3]
    },
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },
    returnToTopLabel: '返回顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式'
  }
});
