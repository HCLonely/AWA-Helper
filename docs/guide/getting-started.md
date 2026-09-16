# 快速开始

## 使用前准备

开始前请确认：

1. AWA 账号已关联 Steam，且 Steam 个人资料和游戏详情已设为公开。
2. AWA 账号已关联 Twitch，并已授权 AWA Twitch 扩展。
3. 如果需要自动完成 Steam 时长任务，已安装并配置 [ArchiSteamFarm](https://github.com/JustArchiNET/ArchiSteamFarm)。

::: danger 游戏安全
后台挂游戏可能触发反作弊系统。游玩《使命召唤》等游戏时，请停止本程序及相关 ASF 任务。
:::

## 获取程序

### 使用发行版（推荐）

从 [GitHub Releases](https://github.com/HCLonely/AWA-Helper/releases/latest) 下载适合系统和 CPU 架构的压缩包，解压到独立目录。

在包含启动程序的目录中，将 `config/` 下的示例配置复制为正式配置，再按需修改：

```bash
cp config/config.example.yml config/config.yml
```

Windows 用户也可以在文件管理器中复制并重命名该文件。如果目录中尚无示例，先运行 `AWA-Helper.exe --init`（Windows）或 `node index.js --init`（Node.js 发行包）。`--init` 只创建目录、示例和启动脚本，不会创建正式的 `config.yml`。

Windows 配置完成后，双击 `AWA-Manager.exe` 即可在系统托盘中后台运行。它需要同目录的 `AWA-Helper.exe`；菜单操作、开机自启和排查方法见[托盘程序说明](/guide/running#awa-manager-exe-托盘程序)。

示例配置启用了指向 `127.0.0.1:1080` 的代理。如果没有该代理，请先将 `proxy.enable` 改为 `[]`；需要代理时填写实际地址。默认未启用 Twitch 和 Steam 时长任务，配置好对应凭据后再开启。

### 从源码运行

源码运行需要 Node.js `^22.20.0 || ^24.12.0 || >=26.0.0`，即 22.x 的 22.20.0 及以上、24.x 的 24.12.0 及以上，或 26 及以上版本；不包括 23.x 和 25.x：

```bash
git clone https://github.com/HCLonely/AWA-Helper.git
cd AWA-Helper
npm ci
npm run build:pre
node output/index.js --init
cp output/config/config.example.yml output/config/config.yml
```

编辑 `output/config/config.yml`，完成代理等基础设置后启动：

```bash
node output/index.js --manager
```

## 启动 Manager

Manager 是推荐的常驻运行方式，它提供统一 WebUI 并负责所有任务的调度。以下 Node.js 命令在包含 `index.js` 的运行目录执行；Windows 可直接使用 `AWA-Manager.exe`：

```bash
node index.js --manager
```

不带参数运行时同样会启动 Manager：

```bash
node index.js
```

默认 WebUI 地址为 `http://127.0.0.1:2345`。如果修改了 `webUI.port`，请使用对应端口访问。

常驻 Manager 启动后等待定时计划，不会立即执行 DailyQuest。需要立即执行时，可在 WebUI 中启动 Helper；单次运行方式见[运行方式](/guide/running)。

## 同步 Cookie

1. 启动 Manager，并确认 WebUI 可以访问。
2. 在浏览器中安装 Tampermonkey Beta。
3. 安装项目提供的 [AWA-Manager 用户脚本](https://github.com/HCLonely/AWA-Helper/raw/main/TM_UserScript/AWA-Manager.user.js)。
4. 打开 AWA Control Center，在用户脚本设置中填写 Manager 地址和密钥。
5. 刷新 AWA 页面，用户脚本会将 Cookie 同步到 Manager。

Manager 首次启动时，如果 `manager.secret` 为空，会自动生成密钥并写入配置文件；手动设置为少于 16 个字符时会显示安全警告，但不会阻止启动。

从实际加载的 `config.yml` 读取 `manager.secret`，在 WebUI 中填写同一密钥后即可操作任务和设置。用户脚本应更新到当前版本，以使用 `/api/cookies/awa` 同步接口。同步后的 Cookie 用于下一次任务；若任务正在运行，可先停止再启动，使其读取新配置。

## 下一步

- 查看[运行方式](/guide/running)了解单次任务和 Docker 部署。
- 查看[配置文件](/reference/configuration)启用任务、代理和消息推送。
- 查看 [WebUI 与日志](/guide/webui)了解设置保存、配置生效时机和日志预览。
