# [AWA-Helper](https://github.com/HCLonely/AWA-Helper)

外星人论坛自动做任务。

[简体中文](/README.md) •
[English](/README_en.md)

> **请到[这里](https://gitlocalize.com/repo/8263)帮助我们改进翻译**.

## 快速安装与开始

安装器会下载并校验最新正式发行包，引导完成配置。

**Windows 10/11（x64）：** 下载 [install.ps1](https://raw.githubusercontent.com/HCLonely/AWA-Helper/main/install.ps1) 和 [install.cmd](https://raw.githubusercontent.com/HCLonely/AWA-Helper/main/install.cmd)，放在同一目录，双击 `install.cmd`。

**Linux：** 下载 [install.sh](https://raw.githubusercontent.com/HCLonely/AWA-Helper/main/install.sh)，在下载目录打开终端执行：

```sh
sh install.sh
```

按向导填写 AWA Cookie、WebUI 端口和管理密钥（Cookie 可稍后同步，密钥留空自动生成），完成后选择启动常驻 Manager。打开 `http://127.0.0.1:2345`（或设置的端口），使用配置文件中的 `manager.secret` 登录，在首页启动 Helper。

账号关联、Cookie 获取、其他安装方式及详细配置请参考[在线文档：快速开始](https://awa-helper-five.vercel.app/guide/getting-started)；更新、后台服务与 Docker 请参考[运行方式](https://awa-helper-five.vercel.app/guide/running)。

源码开发、构建与检查见 [开发说明](Development.md)。

## 运行示例

![Example](https://github.com/HCLonely/AWA-Helper/raw/main/static/NORmcaCfEA.png)

## TODO

## 感谢以下开源项目

- [axios](https://github.com/axios/axios)
- [chalk](https://github.com/chalk/chalk)
- [cheerio](https://github.com/cheeriojs/cheerio)
- [cron-parser](https://github.com/harrisiirak/cron-parser)
- [dayjs](https://github.com/iamkun/dayjs)
- [express](https://github.com/expressjs/express)
- [express-ws](https://github.com/HenningM/express-ws)
- [form-data](https://github.com/form-data/form-data)
- [i18n-node](https://github.com/mashpie/i18n-node)
- [lodash](https://github.com/lodash/lodash)
- [node-cron](https://github.com/node-cron/node-cron)
- [node-tunnel](https://github.com/koichik/node-tunnel)
- [node-socks-proxy-agent](https://github.com/TooTallNate/node-socks-proxy-agent)
- [yaml](https://github.com/eemeli/yaml)
- [js-yaml](https://github.com/nodeca/js-yaml)
- [eslint](https://github.com/eslint/eslint)
- [node-fs-extra](https://github.com/jprichardson/node-fs-extra)
- [highlight.js](https://github.com/highlightjs/highlight.js)
- [marked](https://github.com/markedjs/marked)
- [rollup](https://github.com/rollup/rollup)
- [TypeScript](https://github.com/Microsoft/TypeScript)
- [Terser](https://github.com/terser/terser)
