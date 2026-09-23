# [AWA-Helper](https://github.com/HCLonely/AWA-Helper)

Automatically does AWA quests.<br>This document comes from machine translation

[简体中文](/README.md) • [English](/README_en.md)

> **Please help us improve the translation [here](https://gitlocalize.com/repo/8263)** .

See the full [Getting Started](https://github.com/HCLonely/AWA-Helper/blob/main/docs/en/guide/getting-started.md), [Running AWA-Helper](https://github.com/HCLonely/AWA-Helper/blob/main/docs/en/guide/running.md), and [Configuration](https://github.com/HCLonely/AWA-Helper/blob/main/docs/en/reference/configuration.md) guides.

## Instructions

### Instructions before use

0. **!!!Running this program at the same time as COD may result in a COD account ban. Please close this program when playing COD !!!**
1. Before using it, please make sure that your AWA account has a Steam account linked and that the Steam profile settings have been set to public;
2. Before using, please make sure that your AWA account has been linked to your Twitch account and that your Twitch account has authorized the AWA extension ( [how to link?](https://keylol.com/t782079-1-1) )
3. [Not recommended] If you want to use more than one account, copy the program to another folder to run multiple accounts.

### AWA-Manager

Manager is the central runtime and scheduler for DailyQuest, Achievement, and Artifact, with one unified WebUI port. Its main functions include:

- Cookie synchronization;
- Configuration file parameter settings;
- View DailyQuest running status;
- Control starting/terminating DailyQuest
- ...

> It is recommended that users who do not shut down or mount to the server for a long time use this AWA-Manager.

### Access the WebUI

After starting Manager, open `http://127.0.0.1:2345` (or your configured port). On the `/login` page, enter `manager.secret` from the active `config.yml`. If empty, Manager generates and saves a secret on first startup. “Remember secret” stores it persistently in this browser; otherwise it lasts only for the current tab session. Sign in again after changing the secret. Signing out does not stop background tasks.

Persistent Manager waits for Cron schedules after startup. Start Helper from the home page to run immediately. Do not start a separate one-off run in the same directory while Manager is running.

### Cookie synchronization

1. Configure `manager` and `webUI` in the configuration file, then run Manager;
2. Install [the Tampermonkey BETA](https://www.tampermonkey.net/index.php) extension in the browser ( **note that it is the red BETA version, the regular version cannot obtain cookies!!!** );
3. Install [AWA-Manager](https://github.com/HCLonely/AWA-Helper/raw/main/TM_UserScript/AWA-Manager.user.js) user script;
4. Open the [https://www.alienwarearena.com/control-center](https://www.alienwarearena.com/control-center) page and enter the Manager address and the secret above in `ManagerServer` settings;
5. Cookies are synchronized every time you open a browser page.

### Run through compiled executable file

> If your computer runs all day without shutting down or runs on a server, it is recommended to use AWA-Manager.
>
> [Video tutorial](https://github.com/HCLonely/AWA-Helper/issues/37)

#### Windows

##### Install and run

1. Download [AWA-Helper-Win.tar.gz](https://github.com/HCLonely/AWA-Helper/releases/latest) and unzip it;
2. Edit the configuration file and [view the instructions](#config-file-configuration)
3. Choose how to run:
    - Run DailyQuest once: double-click `AWA-DailyQuest.bat`;
    - Run AWA-Manager: Double-click `AWA-Manager.bat` to run AWA-Manager;
    - Run AWA-Manager in the system tray: double-click `AWA-Manager.exe`. Hover over the icon for task status, double-click it to open the WebUI, or use its context menu to inspect status, start or stop Helper/Achievement, toggle startup at sign-in for the current user, and exit Manager.

> Alternatively, download only [AWA-Manager.exe](https://github.com/HCLonely/AWA-Helper/releases/latest/download/AWA-Manager.exe) into a writable directory and run it. Manager downloads and verifies the required files, repairs missing files from the installed release, and creates default configuration on first installation. Configure your cookies and personal settings in the WebUI afterward. Bootstrap installation requires a release containing an `installation.json` manifest.

##### Update

- Update checks notify you about new releases; enable `autoUpdate` to verify and install automatically;
- Tray updates: select “检查更新” (Check for updates). Manager reports when already current, or downloads, verifies, gracefully stops Helper, updates both executables and restarts. Existing tasks continue during download. Installation failures restore old program files; user configuration, cookies, logs and runtime data are preserved.

The native tray updater uses Windows system proxy settings, not the YAML `proxy` configuration. If installation or repair fails, retry from the tray menu and check `logs/Updater.log`. Interrupted installations are recovered on the next tray launch.

#### Linux

> PS1: MacOS compatibility has not been tested, and it is not recommended to use MacOS devices to run this program!
>
> PS2: Since you are using Linux equipment, the following are instructions based on a certain basic knowledge of Linux usage!

##### Install and run

1. Download [AWA-Helper-Linux-x64.tar.gz](https://github.com/HCLonely/AWA-Helper/releases/latest) and unzip it;

    ```bash
    curl -O -L https://github.com/HCLonely/AWA-Helper/releases/latest/download/AWA-Helper-Linux-x64.tar.gz # CPU 架构可选 x64、armv7、armv8
    tar -xzvf AWA-Helper-Linux-x64.tar.gz
    mv output AWA-Helper
    cd AWA-Helper
    chmod +x AWA-DailyQuest.sh
    chmod +x AWA-Manager.sh
    chmod +x update.sh
    ```

2. Edit the configuration file and [view the instructions](#config-file-configuration)

    ```bash
    cp config/config.example.yml config/config.yml
    ```

3. Run (choose one of the following two):

    - Run DailyQuest once: `./AWA-DailyQuest.sh`;
    - Run AWA-Manager: `./AWA-Manager.sh` .

#### Update

- Update checks notify you about new releases; enable `autoUpdate` to verify and install GitHub Releases automatically;
- Manual update: `./update.sh` .

### Run via NodeJS

> The file size downloaded when updating with this method is small, but NodeJS needs to be installed locally.

#### Install and run

1. (Only required for first time installation) Install [NodeJs](https://nodejs.org/en/download/package-manager) `^22.20.0 || ^24.12.0 || >=26.0.0`;

2. Download [index.js](https://github.com/HCLonely/AWA-Helper/releases/latest) ;

    ```bash
    mkdir AWA-Helper
    cd AWA-Helper
    curl -O -L https://github.com/HCLonely/AWA-Helper/releases/latest/download/index.js # download the latest release
    ```

3. (Only required for first time installation) Initialization

    ```bash
    node index.js --init
    ```

4. Edit the configuration file and [view the instructions](#config-file-configuration)

    ```bash
    cp config/config.example.yml config/config.yml
    ```

5. Run (choose one of the following two):

    - Run DailyQuest once: `node index.js --daily`;
    - Run persistent Manager: `node index.js --manager` or `node index.js`.
    - The deprecated `--helper` flag remains an alias for `--daily`.

#### Update

- Update checks notify you about new releases; enable `autoUpdate` to verify and install GitHub Releases automatically;
- Manual update: `node index.js --update` ;

### Docker

#### Run

> Docker exposes only the unified `webUI.port`, which defaults to 2345. Inside Docker, `webUI.local` is ignored and the server listens on all interfaces so port publishing works.

First copy and edit the repository's `config.example.yml` as `/data/awa-helper/config/config.yml` on the host. Create the `logs` and `data` directories and allow the container's `node` user to read and write all three mounted directories. Startup requires an active configuration file. The port mapping below permits host access only; use `-p 2345:2345` for access from other devices.

- AWA-Manager (recommended)

```shell
docker run -d --name awa-helper -p 127.0.0.1:2345:2345 -v /data/awa-helper/config:/usr/src/app/output/config -v /data/awa-helper/logs:/usr/src/app/output/logs -v /data/awa-helper/data:/usr/src/app/output/data hclonely/awa-helper:latest
```

- One-shot DailyQuest: specify the complete `node index.js --daily` command after the image name.

```shell
docker run -d --name awa-helper -p 127.0.0.1:2345:2345 -v /data/awa-helper/config:/usr/src/app/output/config -v /data/awa-helper/logs:/usr/src/app/output/logs -v /data/awa-helper/data:/usr/src/app/output/data hclonely/awa-helper:latest node index.js --daily
```

> ps: There are three mount points in the container:
> `/usr/src/app/output/config`: corresponding to the local paths `/data/awa-helper/config`
> `/usr/src/app/output/logs`: corresponding to the local paths `/data/awa-helper/logs`
> `/usr/src/app/output/data`: corresponding to the local paths `/data/awa-helper/data`

For Docker updates, keep `autoUpdate: false`, pull the new image, and recreate the container with the same mounted directories.

## Achievement

> Achievement is scheduled by AWA-Manager and cannot run independently of Manager.

### Usage method

1. Open `AWA-Manager` management background;
2. Click the `Start AWA-Achievement` button.

## config (File configuration)

> On first use, if no active configuration exists, copy `config/config.example.yml` to `config/config.yml` and edit it.

Use [config.example.yml](https://github.com/HCLonely/AWA-Helper/blob/main/config.example.yml) as the complete field reference. Edit an existing configuration without copying it again; the Windows native installer may already have created it. The runtime directory's `config.yml` takes precedence over `config/config.yml`, so check which file is active.

The example enables a proxy at `127.0.0.1:1080`; set `proxy.enable: []` if you do not use it. Twitch and Steam tasks are disabled by default; configure their credentials before enabling them.

### Global configuration (required)

#### Global configuration parameters description

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
autoUpdate: false # Check for and install updates that pass SHA-256 verification
```

### AWA-Manager configuration

#### AWA-Manager configuration parameter description

```yml
manager:
  # timezone: Asia/Shanghai  # Empty or omitted: use the system timezone
  historyLimit: 200         # 10–1000; restart required
  secret: '' # generated automatically on first startup when empty
  dailyQuest:
    cron: '3 30 14,21 * * *'
  achievement:
    enable: false
    cron: '0 14 * * *'
  artifacts:
    - cron: '7 29 9 * * 1'
      ids: [636, 17056, 30235]
```

### AWA configuration (Required)

#### AWA parameter description

```yml
awaCookie: '' # 外星人论坛Cookie
awaHost: 'www.alienwarearena.com' # 外星人论坛Host, 常用的有`www.alienwarearena.com`和`na.alienwarearena.com`, 默认的没问题就不要改
awaQuests:
  - getStarted # 自动做左下角的GET STARTED任务，不需要做此任务删除或注释掉此行
  - dailyQuest # 自动做每日任务，不需要做此任务删除或注释掉此行
  # - battlePass # Automatically claim available Battle Pass rewards (disabled by default)
  # - dailyQuestOld # Legacy daily quests (disabled by default)
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

#### AWA parameter configuration methods

##### Automatic update

See [Cookie synchronization](#cookie-synchronization) .

##### Get it yourself

- Open the [https://www.alienwarearena.com/account/personalization](https://www.alienwarearena.com/account/personalization) page, open browser console, find the Network tab, filter`personalization`, copy the part after`cookie:`in the Request Header, and paste it into the`awaCookie`part of the configuration file; ![awaCookie](https://github.com/HCLonely/AWA-Helper/raw/main/static/SaMhNF92RY.png)

### Twitch configuration (optional)

> Required to do Twitch quests, if you don't want to do this task, you can leave it blank. Before doing Twitch tasks automatically, you need to grant access to the AWA ARP widget on Twitch first. You only need to do this once.

#### Twitch parameter description

```yml
twitchCookie: '' # Twitch Cookie, it must include `unique_id` and `auth-token`
```

#### How to get Twitch parameters

1. Open [https://www.twitch.tv/](https://www.twitch.tv/) page, open browser console and enter the following to obtain:

```javascript
document.cookie.split(';').filter((e) => ['unique_id','auth-token'].includes(e.split('=')[0].trim())).join(';');
```

### Steam Quest Configuration

> The way to hang up the duration of Steam games only supports [ASF](https://github.com/JustArchiNET/ArchiSteamFarm) .
>
> Optional Steam Game quest is supported, and you need to Sync the game (`Sync Game`) once on the game selection page.

```yml
steamUse: 'ASF' # 挂时长方式
```

### ASF configuration (optional)

> Using [ASF](https://github.com/JustArchiNET/ArchiSteamFarm) to idle Steam games requires extensive configuration on ASF apart from AWA Helper. If you don’t want to do this part, you can leave it blank. Requires 'steamUse' for 'ASF'.

#### ASF parameters description

```yml
asfProtocol: 'http' # ASF使用的协议，一般都是`http`
asfHost: '127.0.0.1' # ASF使用的Host，本地运行一般是`127.0.0.1`
asfPort: 1242 # ASF使用的端口，默认是`1242`
asfPassword: '' # ASF IPCPassword
asfBotname: '' # 要挂游戏的ASF Bot名称
```

### Proxy configuration (optional)

> proxy parameter description

#### proxy parameter description

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

### Push configuration (optional)

#### Description of push configuration parameters

```yml
pusher:
  enable: false # Whether to enable push，Here is an example of GoCqhttp
  platform: GoCqhttp # Push platform, please check the specific support https://github.com/HCLonely/all-pusher-api#已支持平台
  key: # Configuration parameters，The following parameters are not fixed，Please refer to https://github.com/HCLonely/all-pusher-api#参数
    token: '******'
    baseUrl: 'http://127.0.0.1:5700'
    user_id: '******'
```

## Steam Community Event Game Information

In the home page's **DailyQuest control** section, enter a game ID (required) and game name (optional), or select a source and synchronize remotely. Information is stored in `community-event.json` beside the active `config.yml`; include it in backups and migrations.

Information is valid for the runtime machine's local year and month. With `joinSteamCommunityEvent` enabled, an open event, and unfinished personal playtime, missing or expired information is fetched from the selected source. If valid information remains unavailable, the event is skipped with a prompt to supply it.

## Run history and diagnostics

Open the dedicated **Run history & diagnostics** page (`/operations`) from the Manager home page to see recent runs, subtask results, consecutive failures and the next five scheduled times. Click “Refresh history and schedules” to update it. History uses the browser timezone; each schedule uses its configured timezone.

- Run history is stored in `data/manager/history.json`, retaining 200 runs by default. Unfinished runs become interrupted at the next startup. Corrupt history is preserved and storage errors are shown on the operations page.
- “Check connections” checks AWA session/page structure, Twitch extension authorization and ASF IPC status without performing tasks. Results distinguish expired sessions, missing extensions, rate limits, changed pages and connection failures, with suggested actions. Identical configurations share a 30-second result cache.
- “Export redacted diagnostics” downloads JSON containing the version, runtime environment, latest 50 runs, last diagnostic results and the tail of today's four log scopes (up to 64 KiB each). Export does not run new probes or include full configuration or raw pages.
- Cron preview does not save configuration. Five fields omit seconds; six include them. Both date and weekday must match when both are restricted. Check the preview for timezone and daylight-saving effects.

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
- [yaml-lint](https://github.com/rasshofer/yaml-lint)
- [eslint](https://github.com/eslint/eslint)
- [node-fs-extra](https://github.com/jprichardson/node-fs-extra)
- [highlight.js](https://github.com/highlightjs/highlight.js)
- [marked](https://github.com/markedjs/marked)
- [rollup](https://github.com/rollup/rollup)
- [TypeScript](https://github.com/Microsoft/TypeScript)
- [Terser](https://github.com/terser/terser)
