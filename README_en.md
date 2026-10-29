# [AWA-Helper](https://github.com/HCLonely/AWA-Helper)

Automatically does AWA quests.<br>This document comes from machine translation

[简体中文](/README.md) • [English](/README_en.md)

> **Please help us improve the translation [here](https://gitlocalize.com/repo/8263)** .

## Quick Start

The installer downloads and verifies the latest stable release and guides you through configuration. No separate Node.js or Python installation is required.

**Windows 10/11 (x64):** Download [install.ps1](https://raw.githubusercontent.com/HCLonely/AWA-Helper/main/install.ps1) and [install.cmd](https://raw.githubusercontent.com/HCLonely/AWA-Helper/main/install.cmd) into the same folder, then double-click `install.cmd`.

**Linux:** Download [install.sh](https://raw.githubusercontent.com/HCLonely/AWA-Helper/main/install.sh), open a terminal in the download folder, and run:

```sh
sh install.sh
```

Follow the prompts for your AWA cookie, WebUI port, and management secret. You can sync the cookie later; leaving the secret empty generates one automatically. Choose to start the persistent Manager, open `http://127.0.0.1:2345` (or your configured port), sign in with `manager.secret` from your configuration file, and start Helper from the home page.

For account linking, cookies, other installation options, and detailed configuration, see [Getting Started](https://awa-helper-five.vercel.app/en/guide/getting-started). For updates, background services, and Docker, see [Running AWA-Helper](https://awa-helper-five.vercel.app/en/guide/running).

For source development, builds, and checks, see the [development guide](Development.md).

## Example running

![Example](https://github.com/HCLonely/AWA-Helper/raw/main/static/NORmcaCfEA.png)

## TODO

## Thanks to the following open source projects

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
