import { defineConfig } from 'vitepress';

const socialLinks = [
  { icon: 'github' as const, link: 'https://github.com/HCLonely/AWA-Helper' }
];

export default defineConfig({
  title: 'AWA-Helper',
  head: [
    ['link', { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
  ],
  cleanUrls: true,
  lastUpdated: true,
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      description: 'AWA-Helper 使用与配置说明',
      link: '/'
    },
    en: {
      label: 'English',
      lang: 'en-US',
      description: 'Usage and configuration guide for AWA-Helper',
      link: '/en/'
    }
  },
  themeConfig: {
    locales: {
      root: {
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
              { text: '运行方式', link: '/guide/running' },
              { text: 'WebUI 与日志', link: '/guide/webui' }
            ]
          },
          {
            text: '参考',
            items: [
              { text: '配置文件', link: '/reference/configuration' }
            ]
          }
        ],
        socialLinks,
        editLink: {
          pattern: 'https://github.com/HCLonely/AWA-Helper/edit/main/docs/:path',
          text: '在 GitHub 上编辑此页'
        },
        lastUpdated: { text: '最后更新' },
        outline: { label: '本页目录', level: [2, 3] },
        docFooter: { prev: '上一页', next: '下一页' },
        returnToTopLabel: '返回顶部',
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        langMenuLabel: '切换语言'
      },
      en: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Guide', link: '/en/guide/getting-started' },
          { text: 'Configuration', link: '/en/reference/configuration' }
        ],
        sidebar: [
          {
            text: 'Guide',
            items: [
              { text: 'Getting Started', link: '/en/guide/getting-started' },
              { text: 'Running AWA-Helper', link: '/en/guide/running' },
              { text: 'WebUI and Logs', link: '/en/guide/webui' }
            ]
          },
          {
            text: 'Reference',
            items: [
              { text: 'Configuration', link: '/en/reference/configuration' }
            ]
          }
        ],
        socialLinks,
        editLink: {
          pattern: 'https://github.com/HCLonely/AWA-Helper/edit/main/docs/:path',
          text: 'Edit this page on GitHub'
        },
        lastUpdated: { text: 'Last updated' },
        outline: { label: 'On this page', level: [2, 3] },
        docFooter: { prev: 'Previous page', next: 'Next page' },
        returnToTopLabel: 'Return to top',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Appearance',
        lightModeSwitchTitle: 'Switch to light theme',
        darkModeSwitchTitle: 'Switch to dark theme',
        langMenuLabel: 'Change language'
      }
    }
  }
});
