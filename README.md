# [AWA-Helper](https://github.com/HCLonely/AWA-Helper)

外星人论坛自动做任务。

[简体中文](/README.md) •
[English](/README_en.md)

> **请到[这里](https://gitlocalize.com/repo/8263)帮助我们改进翻译**.

完整说明见 [快速开始](https://github.com/HCLonely/AWA-Helper/blob/main/docs/guide/getting-started.md)、[运行方式](https://github.com/HCLonely/AWA-Helper/blob/main/docs/guide/running.md)和[配置参考](https://github.com/HCLonely/AWA-Helper/blob/main/docs/reference/configuration.md)。

## 使用说明

### 用前说明

0. **!!!后台挂机可能导致COD封号，游玩COD时请关闭本程序！！！**
1. 使用前请确保 AWA 帐号已关联 Steam 帐号且 Steam 帐号信息已设置为公开
2. 使用前请确保 AWA 帐号已关联 Twitch 帐号且 Twitch 帐号已给 AWA 扩展授权([如何关联？](https://keylol.com/t782079-1-1))
3. \[**不建议**\]如需多开，请将本程序复制到不同文件夹运行

### AWA-Manager

Manager 是程序唯一的运行与调度中心，使用同一个 WebUI 端口管理 DailyQuest、Achievement 和 Artifact，主要功能包括：

- Cookie 同步；
- 配置文件参数设置；
- DailyQuest 运行状态查看；
- 控制启动/终止 DailyQuest
- ...

> 建议长期不关机或挂载到服务器的用户使用此 AWA-Manager.

### 访问 WebUI

启动 Manager 后打开 `http://127.0.0.1:2345`（或配置的端口），在 `/login` 登录页填写实际加载的 `config.yml` 中的 `manager.secret`。密钥为空时首次启动自动生成并写入配置。勾选“记住密钥”会在浏览器中持久保存，否则只保留在当前标签页会话中；密钥变更后需重新登录。“退出登录”不会停止后台任务。

常驻 Manager 启动后等待 Cron 计划；需要立即执行时在首页启动 Helper。已有 Manager 运行时，不要在同一目录另开单次任务。

### Cookie 同步

1. 在配置文件中配置[manager](#awa-manager-配置参数说明)和[webUI](#全局配置参数说明)，并运行 Manager；
2. 在浏览器中安装[Tampermonkey BETA](https://www.tampermonkey.net/index.php)扩展（**注意是红色的 BETA 版本，普通版无法获取 Cookie！！！**）；
3. 安装[AWA-Manager](https://github.com/HCLonely/AWA-Helper/raw/main/TM_UserScript/AWA-Manager.user.js)用户脚本；
4. 打开<https://www.alienwarearena.com/control-center>页面，在 `ManagerServer` 设置中填写 Manager 地址和上述密钥；
5. 每次你打开浏览器页面时都会同步一次 Cookie.

### 通过编译好的可执行文件运行

> 如果你的电脑全天运行不关机或在服务器上运行建议使用 AWA-Manager.
>
> [视频教程](https://github.com/HCLonely/AWA-Helper/issues/37)

#### Windows

##### 安装运行

1. 下载[AWA-Helper-Win.tar.gz](https://github.com/HCLonely/AWA-Helper/releases/latest)并解压；
2. 编辑配置文件,[查看说明](#config-文件配置)
3. 选择运行方式：
    - 单次运行 DailyQuest：双击`AWA-DailyQuest.bat`；
    - 运行 AWA-Manager: 双击`AWA-Manager.bat`运行 AWA-Manager;
    - 托盘运行 AWA-Manager：双击`AWA-Manager.exe`。悬停图标可查看任务状态，双击可打开管理页面；右键菜单可以查看状态、启动或停止 Helper/Achievement、切换当前用户的开机自启，以及退出 Manager。

> 也可以只下载 [AWA-Manager.exe](https://github.com/HCLonely/AWA-Helper/releases/latest/download/AWA-Manager.exe)，放入可写目录后运行。它会自动下载、校验并安装所需文件；缺少程序文件时优先修复已安装版本。首次安装会创建默认配置，仍需在管理页面填写 Cookie 等个人设置。自动安装需要 Release 提供 `installation.json` 文件清单。

##### 更新

- 更新检查：程序会提示新版本；启用 `autoUpdate` 后会校验并自动安装；
- 托盘更新：右键选择“检查更新”。无更新时显示当前版本；有更新时自动下载，正常停止 Helper 后同时更新 Manager 和 Helper，再重新启动。下载期间现有任务继续运行，安装失败会恢复旧程序；配置、Cookie、日志和运行数据保留。

托盘的原生更新器使用 Windows 系统代理设置，不读取 YAML 的 `proxy`。安装或修复失败时可从托盘菜单重试，并查看 `logs/Updater.log`；中断的安装在下次启动托盘时尝试恢复。

#### Linux

> PS1: MacOS 的兼容性未测试，不建议使用 MacOS 设备运行此程序！
>
> PS2: 既然你使用 Linux 设备，以下为基于有一定 Linux 使用基础的说明！

##### 安装运行

1. 下载[AWA-Helper-Linux-x64.tar.gz](https://github.com/HCLonely/AWA-Helper/releases/latest)并解压；

    ```bash
    curl -O -L https://github.com/HCLonely/AWA-Helper/releases/latest/download/AWA-Helper-Linux-x64.tar.gz # CPU 架构可选 x64、armv7、armv8
    tar -xzvf AWA-Helper-Linux-x64.tar.gz
    mv output AWA-Helper
    cd AWA-Helper
    chmod +x AWA-DailyQuest.sh
    chmod +x AWA-Manager.sh
    chmod +x update.sh
    ```

2. 编辑配置文件,[查看说明](#config-文件配置)

    ```bash
    cp config/config.example.yml config/config.yml
    ```

3. 运行(以下两种二选一)：
    - 单次运行 DailyQuest：`./AWA-DailyQuest.sh`；
    - 运行 AWA-Manager: `./AWA-Manager.sh`.

#### 更新

- 更新检查：程序会提示新版本；启用 `autoUpdate` 后会校验并自动安装 GitHub Release；
- 手动更新: `./update.sh`.

### 通过 NodeJS 运行

> 这种方法更新时下载的文件体积小，但需要在本地安装 NodeJS.

#### 安装运行

1. (仅首次安装需要)安装[NodeJs](https://nodejs.org/en/download/package-manager) `^22.20.0 || ^24.12.0 || >=26.0.0`;
2. 下载[index.js](https://github.com/HCLonely/AWA-Helper/releases/latest)；

    ```bash
    mkdir AWA-Helper
    cd AWA-Helper
    curl -O -L https://github.com/HCLonely/AWA-Helper/releases/latest/download/index.js # 下载最新发行版
    ```

3. (仅首次安装需要)初始化

    ```bash
    node index.js --init
    ```

4. 编辑配置文件,[查看说明](#config-文件配置)

    ```bash
    cp config/config.example.yml config/config.yml
    ```

5. 运行(以下两种二选一)：
    - 单次运行 DailyQuest：`node index.js --daily`；
    - 常驻运行 Manager：`node index.js --manager` 或 `node index.js`。
    - 旧参数 `--helper` 暂时兼容，行为等同于 `--daily`。

#### 更新

- 更新检查：程序会提示新版本；启用 `autoUpdate` 后会校验并自动安装 GitHub Release；
- 手动更新：`node index.js --update`；

### 使用 Docker

#### 运行

> Docker 只暴露统一的 `webUI.port`，默认端口为 2345。容器内会忽略 `webUI.local` 并监听所有网络接口，以便端口映射生效。

先从仓库 `config.example.yml` 复制并修改宿主机上的 `/data/awa-helper/config/config.yml`，创建 `logs` 和 `data` 目录，确保三个挂载目录允许容器的 `node` 用户读写。缺少正式配置时无法启动。以下端口映射仅允许宿主机访问；需要其他设备访问时改为 `-p 2345:2345`。

- AWA-Manager(建议)

```shell
docker run -d --name awa-helper -p 127.0.0.1:2345:2345 -v /data/awa-helper/config:/usr/src/app/output/config -v /data/awa-helper/logs:/usr/src/app/output/logs -v /data/awa-helper/data:/usr/src/app/output/data hclonely/awa-helper:latest
```

- 单次 DailyQuest 需在镜像名后指定完整命令 `node index.js --daily`；默认无参数启动常驻 Manager。

```shell
docker run -d --name awa-helper -p 127.0.0.1:2345:2345 -v /data/awa-helper/config:/usr/src/app/output/config -v /data/awa-helper/logs:/usr/src/app/output/logs -v /data/awa-helper/data:/usr/src/app/output/data hclonely/awa-helper:latest node index.js --daily
```

> ps:容器内有三个挂载点：
> `/usr/src/app/output/config`: 对应于本地路径`/data/awa-helper/config`，存放配置文件
> `/usr/src/app/output/logs`: 对应于本地路径`/data/awa-helper/logs`，存放日志文件
> `/usr/src/app/output/data`: 对应于本地路径`/data/awa-helper/data`，存放数据文件

Docker 更新请保持 `autoUpdate: false`，拉取新镜像并使用原挂载目录重建容器。

## 成就助手

> Achievement 由 AWA-Manager 统一调度，不能脱离 Manager 单独运行！

### 使用方法

1. 打开`AWA-Manager`管理后台;
2. 点击“启动 AWA-Achievement”按钮。

## config 文件配置

> 首次使用且尚无正式配置时，将 `config/config.example.yml` 复制为 `config/config.yml` 后修改。

完整字段以 [config.example.yml](https://github.com/HCLonely/AWA-Helper/blob/main/config.example.yml) 为准。已有正式配置时直接编辑，无需再次复制；Windows 原生安装器可能已创建该文件。程序优先读取运行目录的 `config.yml`，其次为 `config/config.yml`，请确认修改的是实际加载的文件。

示例默认启用 `127.0.0.1:1080` 代理；没有该代理时请设置 `proxy.enable: []`。Twitch 和 Steam 任务默认关闭，填写所需凭据后再启用。

### 全局配置(必需)

#### 全局配置参数说明

```yml
language: zh # 程序显示语言，目前支持中文 (zh) 和 English (en)
webUI:
  enable: true # 是否启用WebUI
  port: 2345 # WebUI端口
  local: true # true 仅监听 127.0.0.1；false 监听所有接口，官方容器始终监听所有接口
  # ssl: # 启用 HTTPS 时同时填写 key 和 cert，路径相对于配置文件所在目录
  #   key: xxx.yyy-key.pem
  #   cert: xxx.yyy.pem
timeout: 86400 # 单次 DailyQuest 超时秒数，0 为不限制；超时停止任务，常驻 Manager 继续运行
logsExpire: 30 # 日志保留天数，0 为不限制
logsMaxMB: 512 # 日志容量预算（MiB），0 关闭容量限制；当天及正在写入的文件受保护
debug:
  http: false # HTTP 调试日志，过滤请求头、请求体和 URL 查询参数
TLSRejectUnauthorized: true # 是否启用TLSSocket库校验，默认开启。如果使用代理出现网络问题，可尝试更改此项！
UA: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36 Edg/117.0.2045.47' # 浏览器UA
autoUpdate: false # 检查并自动安装通过 SHA-256 校验的更新
```

### AWA-Manager 配置

#### AWA-Manager 配置参数说明

```yml
manager:
  # timezone: Asia/Shanghai  # 留空或省略时使用系统时区
  historyLimit: 200         # 10–1000，重启生效
  secret: '' # 为空时首次启动自动生成
  dailyQuest:
    cron: '3 30 14,21 * * *' # 定时运行DailyQuest
#        ┬ ┬─ ──┬── ┬ ┬ ┬
#        │ │    │   │ │ |
#        │ │    │   │ │ └─────────────── 一周的第几天 (0 - 7) (0或7是周日) ┐
#        │ │    │   │ └───────────────── 月份　　　　 (1 - 12)　 　　　             ├─ 日期
#        │ │    │   └─────────────────── 每月的第几天 (1 - 31)　　　　           ┘
#        │ │    └───────────────────── 小时 (0 - 23) ┐
#        │ └────────────────────────── 分钟 (0 - 59) ├─ 时间
#        └───────────────────────── ───秒　 (0 - 59) ┘
# 示例中的表达式代表每天的14:30:03和21:30:03运行DailyQuest
# !! 注意每次运行的时间间隔要大于前面设置的timeout
  achievement:
    enable: false
    cron: '0 14 * * *'
  artifacts: # 定时更换遗物
    - cron: '7 29 9 * * 1'
      ids: [636, 17056, 30235]
# !! 注意每次更换遗物的时间间隔要大于24小时
```

### AWA 配置(必需)

#### AWA 参数说明

```yml
awaCookie: '' # 外星人论坛Cookie
awaHost: 'www.alienwarearena.com' # 外星人论坛Host, 常用的有`www.alienwarearena.com`和`na.alienwarearena.com`, 默认的没问题就不要改
awaQuests:
  - getStarted # 自动做左下角的GET STARTED任务，不需要做此任务删除或注释掉此行
  - dailyQuest # 自动做每日任务，不需要做此任务删除或注释掉此行
  # - battlePass # 自动领取 Battle Pass 中可领取的奖励（默认关闭）
  # - dailyQuestOld # 自动做每日任务(旧版)，不需要做此任务删除或注释掉此行（默认关闭，一般不会再有此类任务）
  - timeOnSite # 自动做AWA在线任务，不需要做此任务删除或注释掉此行
  # - watchTwitch # 启用前配置 twitchCookie，必须包含 unique_id 和 auth-token
  # - steamQuest # 启用前配置可访问的 ASF Host、端口和 Botname
awaDailyQuestType: # 仅控制 dailyQuestOld；删除不需要的类型，[] 表示不执行这些操作
  - click # 浏览页面任务，务标题为任务链接，需点击任务才能完成
  - visitLink # 浏览页面任务，任务标题为任务链接，浏览页面才能完成
  - openLink # 浏览页面任务，任务标题无链接，尝试浏览 排行榜，奖励，商店页面
  - changeBorder # 更换Border
  - changeAvatar # 更换Avatar
  - viewNews # 浏览新闻
  - sharePost # 分享帖子
  # - replyPost # 回复帖子
joinSteamCommunityEvent: true # 自动加入Steam社区活动
```

#### AWA 参数获取方式

##### 自动更新

参考[Cookie 同步](#cookie-同步)。

##### 手动获取

- 打开[https://www.alienwarearena.com/account/personalization](https://www.alienwarearena.com/account/personalization)页面，打开控制台，找到网络一栏，筛选`personalization`, 复制请求头中`cookie:`后面的部分，粘贴到配置文件中的`awaCookie`部分；
    ![awaCookie](https://github.com/HCLonely/AWA-Helper/raw/main/static/SaMhNF92RY.png)

### Twitch 配置(可选)

> 做 Twitch 在线任务需要，不想做这个任务可以不填。自动做 Twitch 任务前需要先在 Twitch 给外星人扩展授权，只需授权一次即可。

#### Twitch 参数说明

```yml
twitchCookie: '' # Twitch Cookie, 须包括`unique_id` 和 `auth-token`
```

#### Twitch 参数获取方式

1. 打开[https://www.twitch.tv/](https://www.twitch.tv/)页面，打开控制台输入以下内容获取：

```javascript
document.cookie.split(';').filter((e) => ['unique_id','auth-token'].includes(e.split('=')[0].trim())).join(';');
```

### Steam 任务配置

> 挂 Steam 游戏时长的方式, 仅支持[ASF](https://github.com/JustArchiNET/ArchiSteamFarm).
>
> 已支持自选 Steam 游戏任务，需在游戏选择页面同步游戏(`Sync Game`)一次。

```yml
steamUse: 'ASF' # 挂时长方式
```

### ASF 配置(可选)

> 使用[ASF](https://github.com/JustArchiNET/ArchiSteamFarm)挂 Steam 游戏时长任务需要，不想做这个任务可以不填。需要`steamUse`为`ASF`.

#### ASF 参数说明

```yml
asfProtocol: 'http' # ASF使用的协议，一般都是`http`
asfHost: '127.0.0.1' # ASF使用的Host，本地运行一般是`127.0.0.1`
asfPort: 1242 # ASF使用的端口，默认是`1242`
asfPassword: '' # ASF IPCPassword
asfBotname: '' # 要挂游戏的ASF Bot名称
```

### proxy 配置(可选)

> 代理设置，一般 Twitch 任务需要。

#### proxy 参数说明

```yml
proxy:
  enable:
    - github # 在检测更新时使用代理，不使用删掉此行
    - twitch # 在访问Twitch站点时使用代理，不使用删掉此行
    - awa # 在访问外星人论坛站点时使用代理，不使用删掉此行
    - asf # 在访问ASF时使用代理，不使用删掉此行
    - pusher # 在推送时使用代理，不使用删掉此行
  protocol: 'http' # 支持 http、https、socks4、socks5
  host: '127.0.0.1' # 代理host
  port: 1080 # 代理端口
  username: '' # 代理用户名，没有可留空
  password: '' # 代理密码，没有可留空
```

### 推送配置(可选)

#### 推送配置参数说明

```yml
pusher:
  enable: false # 是否启用推送，这里以GoCqhttp为例
  platform: GoCqhttp # 推送平台，具体支持情况请查看 https://github.com/HCLonely/all-pusher-api#已支持平台
  key: # 配置参数，以下参数不是固定的，请参考 https://github.com/HCLonely/all-pusher-api#参数
    token: '******'
    baseUrl: 'http://127.0.0.1:5700'
    user_id: '******'
```

## Steam 社区活动游戏信息

在首页 **DailyQuest 控制** 区域填写游戏 ID（必填）和游戏名称（可选），或选择来源后点击“从远程同步”。信息保存在实际 `config.yml` 同目录的 `community-event.json`，备份或迁移时需一并保留。

信息按运行机器的本地年份和月份判断有效性。启用 `joinSteamCommunityEvent` 且活动开放、个人时长未完成时，缺失或过期信息会自动从所选来源获取；仍无有效信息则跳过活动并提示补充。

## 运行历史与诊断

从 Manager 首页进入独立的“运行记录与诊断”页面（`/operations`），可查看最近运行、子任务结果、连续失败次数和未来五次计划时间。点击“刷新记录与计划”更新显示；记录时间使用浏览器本地时区，计划时间使用该计划的时区。

- 历史保存在运行目录的 `data/manager/history.json`，默认保留最近 200 条。异常退出留下的运行记录在下次启动时标为中断；历史文件损坏时保留原件并在运行记录页面显示存储错误。
- “检查连接”仅检查平台连接及授权，不执行任务：AWA 会话与控制中心结构、Twitch 扩展授权、ASF IPC 状态。结果区分 Cookie 失效、扩展缺失、限流、页面变化和连接失败，并提供下一步。相同配置的诊断结果缓存 30 秒。
- “导出脱敏诊断”下载 JSON，包含版本、运行环境、最近 50 次运行、上次诊断结果和当天四类日志的末尾片段（每类最多 64 KiB）。导出不主动重新检查连接，也不包含完整配置或原始页面。
- Cron 预览不会修改配置。五段表达式省略秒，六段包含秒；日期和星期同时指定时需同时匹配。跨时区及夏令时请以预览显示的实际时间为准。

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
- [yaml-lint](https://github.com/rasshofer/yaml-lint)
- [eslint](https://github.com/eslint/eslint)
- [node-fs-extra](https://github.com/jprichardson/node-fs-extra)
- [highlight.js](https://github.com/highlightjs/highlight.js)
- [marked](https://github.com/markedjs/marked)
- [rollup](https://github.com/rollup/rollup)
- [TypeScript](https://github.com/Microsoft/TypeScript)
- [Terser](https://github.com/terser/terser)
