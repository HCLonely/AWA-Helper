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

首次运行前，将示例配置复制为 `config.yml`，再按需修改：

```bash
cp config.example.yml config.yml
```

Windows 用户也可以在文件管理器中复制并重命名该文件。

### 从源码运行

源码运行需要 Node.js 22.13 或更高版本（也支持 Node.js 24 及以上版本）：

```bash
git clone https://github.com/HCLonely/AWA-Helper.git
cd AWA-Helper
npm ci
npm run build:pre
node output/index.js --init
node output/index.js --manager
```

## 启动 Manager

Manager 是推荐的常驻运行方式，它提供统一 WebUI 并负责所有任务的调度：

```bash
node index.js --manager
```

不带参数运行时同样会启动 Manager：

```bash
node index.js
```

默认 WebUI 地址为 `http://127.0.0.1:2345`。如果修改了 `webUI.port`，请使用对应端口访问。

## 同步 Cookie

1. 启动 Manager，并确认 WebUI 可以访问。
2. 在浏览器中安装 Tampermonkey Beta。
3. 安装项目提供的 [AWA-Manager 用户脚本](https://github.com/HCLonely/AWA-Helper/raw/main/TM_UserScript/AWA-Manager.user.js)。
4. 打开 AWA Control Center，在用户脚本设置中填写 Manager 地址和密钥。
5. 刷新 AWA 页面，用户脚本会将 Cookie 同步到 Manager。

Manager 首次启动时，如果 `manager.secret` 为空，会自动生成密钥并写入配置文件；手动设置为少于 16 个字符时会显示安全警告，但不会阻止启动。

## 下一步

- 查看[运行方式](/guide/running)了解单次任务和 Docker 部署。
- 查看[配置文件](/reference/configuration)启用任务、代理和消息推送。
