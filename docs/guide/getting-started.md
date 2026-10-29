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

### 一键安装与配置（推荐）

从仓库或 [GitHub Releases](https://github.com/HCLonely/AWA-Helper/releases/latest) 获取安装脚本，在交互终端执行。无需安装 Node.js 或 Python；Windows 需要系统 PowerShell 5.1+ 和 `tar.exe`（Windows 10/11 自带），Linux 使用 Bash 4+、curl、jq、tar/gzip、coreutils 和 glibc。Windows 支持 x64；Linux 支持 x64、armv7、arm64。

Linux 缺少 Bash、curl、jq 等工具时，自动尝试通过官方包管理器安装，可能要求 sudo 验证；可以用 `sh install.sh` 启动，Bash 准备好后自动切换。缺少 glibc 时仍会先询问；同意后通过 apt 安装 `libc6`，或通过 dnf/yum、zypper、pacman 安装 `glibc`，并再次检查是否可用。自动安装仅使用发行版官方包管理器，不添加第三方源。Alpine/musl 官方兼容层不等于真正的 glibc，这类系统无法自动安装时会提示手动准备 glibc 并退出。安装后的发行包还会执行 `--version` 兼容性检查，失败时不替换已有程序。

Windows 下载同目录的 `install.ps1` 与 `install.cmd`，双击 `install.cmd`，或执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

Linux 执行：

```bash
sh install.sh
```

默认下载并校验最新正式发行包。可用 Windows 的 `-Version v4.1.6 -InstallDir 'D:\Apps\AWA-Helper'` 或 Linux 的 `--version v4.1.6 --install-dir "$HOME/Apps/AWA-Helper"` 指定版本与路径；版本标签必须在 Releases 中存在。旧发行包没有 SHA-256 digest 或校验文件时会拒绝安装。

安装器会询问关键配置：AWA Cookie（允许稍后同步）、WebUI 端口与是否允许其他设备访问、管理密钥（留空随机生成），以及可选的 Twitch、ASF 和代理。代理、自动更新默认关闭；Manager 每天按系统时区在 14:30:03、21:30:03 调度每日任务，可修改 `manager.dailyQuest.cron`。配置以 JSON 格式保存为 `config/config.yml`，它是有效的 YAML，可直接被程序读取。密钥请从配置文件读取，安装器不会在终端回显凭据。

已有根目录 `config.yml` 优先于 `config/config.yml`，默认保留；选择向导重写时先备份。配置过程不启动 WebUI，也不打开浏览器。完成后再选择单次 Helper、常驻 Manager 或暂不启动；选择 Manager 后再选择是否注册服务，不注册时在当前终端前台运行。具体见[后台服务](/guide/running#安装器注册的后台服务)。

只配置已安装的程序，可执行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -ConfigureOnly -InstallDir 'D:\Apps\AWA-Helper'` 或 `bash install.sh --configure-only --install-dir "$HOME/AWA-Helper"`。请先停止原有进程；重新配置会替换向导未包含的自定义项，因此默认建议保留已有配置。

### 手动使用发行版

从 [GitHub Releases](https://github.com/HCLonely/AWA-Helper/releases/latest) 下载适合系统和 CPU 架构的压缩包，解压到独立目录。

在包含启动程序的目录中，将 `config/` 下的示例配置复制为正式配置，再按需修改：

```bash
cp config/config.example.yml config/config.yml
```

Windows 用户也可以在文件管理器中复制并重命名该文件。如果目录中尚无示例，先运行 `AWA-Helper.exe --init`（Windows）或 `node index.js --init`（Node.js 发行包）。`--init` 只创建目录、示例和启动脚本，不会创建正式的 `config.yml`。

Windows 配置完成后，双击 `AWA-Manager.exe` 即可在系统托盘中后台运行。它会启动同目录的 `AWA-Helper.exe`；缺少必需程序文件时会自动尝试安装或修复。菜单操作、开机自启和排查方法见[托盘程序说明](/guide/running#awa-manager-exe-托盘程序)。

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

从实际加载的 `config.yml` 读取 `manager.secret`，在 WebUI 登录页填写同一密钥并通过验证后即可操作任务和设置。用户脚本应更新到当前版本，以使用 `/api/cookies/awa` 同步接口。同步后的 Cookie 用于下一次任务；若任务正在运行，可先停止再启动，使其读取新配置。

## 下一步

- 查看[运行方式](/guide/running)了解单次任务和 Docker 部署。
- 查看[配置文件](/reference/configuration)启用任务、代理和消息推送。
- 查看 [WebUI 与日志](/guide/webui)了解设置保存、配置生效时机和日志预览。
