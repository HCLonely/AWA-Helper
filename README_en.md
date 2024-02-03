# AWA-Helper

Automatically does AWA quests.

[简体中文](/README.md) • [English](/README_en.md)

> **Please help us improve the translation [here](https://gitlocalize.com/repo/8263)** .

## Instructions

### Instructions before use

1. Before using it, please make sure that your AWA account has a Steam account linked and that the Steam profile settings have been set to public;
2. Before using it, please make sure that your AWA account has a Twitch account linked and that the Twitch account has been granted access to the AWA ARP widget;
3. [Not recommended] If you want to use more than one account, copy the program to another folder to run multiple accounts.

### Run from the source

> This method automatically installs the latest beta version!

#### Install and run

1. Prerequisites: Install [Git](https://git-scm.com/downloads) and [NodeJs](https://nodejs.org/zh-cn/download/) &gt;= v16.0.0
2. Clone this repository`git clone https://github.com/HCLonely/AWA-Helper.git`
3. Install dependencies`npm install`
4. Build`npm run build`
5. Edit configuration file [view instructions](#config-file-configuration)
6. Run`npm start`/double click`AWA-Helper.bat`

> **Note: Steps 1-5 are only required for the first installation, only step 6 is required for each run after that!**

#### Update via Git

1. Pull update`git pull`
2. Install dependencies`npm install`
3. Build`npm run build`
4. Run`npm start`/double click`AWA-Helper.bat`

> **Note: Steps 1-3 are only required for the first run after each update, only step 4 is required for each run after that!**

### Download the compressed program and run

#### Automatically install dependencies (Recommended)

> **The `config.example.yml` file needs to be renamed to `config.yml`!!!**

1. [Click here](https://github.com/HCLonely/AWA-Helper/releases/latest) to download the compressed program in zip
2. Extract
3. Edit configuration file,[View instructions](#config-file-configuration)
4. First run:
    - Windows: Double click`运行-auto.bat`/`Run-auto.bat`to run (Missing dependencies are automatically installed)
    - Linux: `sudo ./run_auto_linux.sh`
5. Non first run:
    - Windows: Double click`运行.bat`/`Run.bat`to run.
    - Linux: `node index.js`

#### Install dependencies on your own[recommended]

1. Install [NodeJs](https://nodejs.org/zh-cn/download/) &gt;= v16.0.0
2. [Click here](https://github.com/HCLonely/AWA-Helper/releases/latest) to download the compressed program in zip
3. Extract
4. Install dependencies `npm install --save`
5. Edit configuration file [view instructions](#config-file-configuration)
6. Windows: Double click`运行.bat`/`Run.bat`to run. Linux: `node index.js`

#### Update

1. [Click here](https://github.com/HCLonely/AWA-Helper/releases/latest) to download the compressed program in zip
2. Extract and overwrite it
3. Install dependencies`npm install --save`
4. Windows: Double click`运行.bat`/`Run.bat`to run. Linux: `node index.js`

### Docker

#### Install

- Small size, does not support automatic login

```shell
docker pull hclonely/awa-helper
```

- or support automatic login:

```shell
docker pull hclonely/awa-helper-chromium
```

#### Run

```shell
docker run -d --name awa-helper -p 3456:3456 -v /data/awa-helper/config:/usr/src/app/dist/config -v /data/awa-helper/logs:/usr/src/app/dist/logs hclonely/awa-helper
```

> ps1: There are two mount points in the container: `/usr/src/app/dist/config` and `/usr/src/app/dist/logs` , corresponding to the local path `/data/awa-helper/config` and `/data/awa-helper/logs` (can be customized and modified), the former stores configuration files, and the latter stores log files.
>
> ps2: The above command will only run AWA-Helper once, it is recommended to restart the container regularly in conjunction with the scheduled task!

#### 定时任务

## config (File configuration)

> **Copy the `config.example.yml` file and rename it `config.yml`!!**
>
> Or use it the [parameter generator](https://configer.hclonely.com/?fileLink=https%3A%2F%2Fraw.githubusercontent.com%2FHCLonely%2FAWA-Helper%2Fmain%2Fconfiger%2Fconfiger.template.yml.js) configuration file generator

### Global configuration (required)

#### Global configuration parameters description

```yml
language: zh # Program display language, currently supports Chinese (zh) and English (en)
webUI:
  enable: true # Whether to enable WebUI
  port: 3456 # WebUI port
  ssl: # WebUI enables SSL
    key: xxx.yyy-key.pem # SSL certificate key file name, put this file in the same directory as the config.yml configuration file!
    cert: xxx.yyy.pem # SSL certificate file name, put this file in the same directory as the config.yml configuration file!
timeout: 0 # Timeout setting, unit: second, 0 means unlimited. If the program is still running after running for more than this time, the program will be terminated.
logsExpire: 30 # Log retention time, unit: day, default is 30 days, 0 means unlimited.
TLSRejectUnauthorized: true # Whether to enable TLSSocket library verification, enabled by default. If you have network problems using a proxy, try changing this!
```

### AWA configuration (Required)

#### AWA parameter description

```yml
awaCookie: '' # Alien Forum Cookie, can only have `REMEMBERME`, without `REMEMBERME`, it must have `PHPSESSID` and `sc`, but it will cause an error in obtaining the number of consecutive check-in days, and will not affect other functions.
awaHost: 'www.alienwarearena.com' # Alien forum Host, commonly used ones are `www.alienwarearena.com` and `na.alienwarearena.com`. If there is no problem with the default, do not change it.
# awaBoosterNotice: true # Deprecated! When the Alien Forum has more than one task, it will ask whether to turn on the booster. The booster needs to be turned on by yourself! ! !
awaQuests:
- promotionalCalendar # Automatically receive promotional rewards (log in on the 7th). The Docker version requires the chromium version (hclonely/awa-helper-chromium). There is no need to delete or comment out this line for this task. Note: There is only the incomplete reminder function, which cannot be implemented due to human-machine verification!
- dailyQuest # Automatically do daily tasks, no need to do this task. Delete or comment out this line.
- timeOnSite # Automatically do AWA online tasks, no need to do this task. Delete or comment out this line.
- watchTwitch # Automatically perform online tasks in the Twitch live broadcast room. You do not need to do this task. Delete or comment out this line.
- steamQuest # Automatically do the Steam game duration task, you don’t need to do this task. Delete or comment out this line.
awaDailyQuestType: # Daily task type, no need to comment it out, all comments = enable all, if you do not need to do daily tasks, please comment above `dailyQuest`
- click # Browse the page task, the task title is the task link, you need to click the task to complete it
- visitLink # Browse the page task, the task title is task link, and it can only be completed by browsing the page.
- openLink # Browse page tasks, task title has no link, try to browse rankings, rewards, store page
- changeBorder # Change Border
- changeBadge # Change Badge
- changeAvatar # Change Avatar
- viewNews # Browse news
- sharePost # Share post
- replyPost # Reply to post
awaDailyQuestNumber1: true # When there are multiple daily tasks, whether to only do the first one
awaSafeReply: false # If you have replied to a post today, the reply to the post operation will be skipped. The default is not skipped (false)
# boosterRule: # Deprecated! Comment out all the rules for using ARP Booster to disable them.
# - 2x24h>0 # This rule means that when the number of 2x 24hr ARP Booster is greater than 0, use 2x 24hr ARP Booster
# - 2x48h>5 # This rule means that when the number of 2x 48hr ARP Booster is greater than 5, 2x 48hr ARP Booster will be used. This rule will only take effect when none of the above rules match.
# boosterCorn: '* * 8 * * 7' # Deprecated! Time to use ARP Booster (local time)
# # ┬ ┬ ┬ ┬ ┬ ┬
# # │ │ │ │ │ |
# # │ │ │ │ │ └──────────────── Day of the week (0 - 7, 1L - 7L) (0 or 7 is Sunday) ┐
# # │ │ │ │ └───────────────── Month (1 - 12) ├─ Date
# # │ │ │ └─────────────────── Day of the month (1 - 31, L) ┘
# # │ │ └──────────────────── Hours (0 - 23) ┐
# # │ └────────────────────── Minutes (0 - 59) ├─ Time
# # └───────────────────────── Seconds (0 - 59) ┘
# # Time rule description: enabled when the current date and the date matched by boosterCorn are on the same day and the current time is greater than the time matched by boosterCorn
# # The expression in the example represents the use of boosterRule rules for matching when running the program after 8 o'clock every Saturday.
autoLogin: # Automatically log in and update Cookies configuration
enable: true # Whether to enable
username: '' #AWA username
password: '' # AWA password
autoUpdateDailyQuestDb: false # Automatically update the daily task database
joinSteamCommunityEvent: false # Automatically join Steam community events
```

#### AWA parameter configuration methods

##### Automatic update

1. Enable and configure`autoLogin`；
2. `awaCookie`fill in`AWACOOKIEAUTOUPDATE`.

##### Get it yourself

1. Open the [https://www.alienwarearena.com/account/personalization](https://www.alienwarearena.com/account/personalization) page, open browser console, find the Network tab, filter`personalization`, copy the part after`cookie:`in the Request Header, and paste it into the`awaCookie`part of the configuration file; ![awaCookie](https://github.com/HCLonely/AWA-Helper/raw/main/static/SaMhNF92RY.png)

2. [Optional &amp; Recommended] Open browser console and enter the following, and replace `YOURCOOKIE` with the copied `cookie`. After pressing Enter, all the unnecessary parts will be removed.

    ```javascript
    console.log(`YOURCOOKIE`.split(';').map((e) => ['REMEMBERME','PHPSESSID','sc'].includes(e.trim().split('=')[0]) ? e.trim() : null).filter((e) => e).join(';'));
    ```

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

> How to idle Steam games, supports [ASF](https://github.com/JustArchiNET/ArchiSteamFarm) and [SU](https://github.com/DoctorMcKay/node-steam-user).
>
> Optional Steam Game quest is supported, and you need to Sync the game (`Sync Game`) once on the game selection page.

```yml
steamUse: 'ASF' # 'ASF' or 'SU', 'SU' simulates Steam client
```

### ASF configuration (optional)

> Using [ASF](https://github.com/JustArchiNET/ArchiSteamFarm) to idle Steam games requires extensive configuration on ASF apart from AWA Helper. If you don’t want to do this part, you can leave it blank. Requires 'steamUse' for 'ASF'.

#### ASF parameters description

```yml
asfProtocol: 'http' # Protocol used by ASF, usually `http`
asfHost: '127.0.0.1' # Host used by ASF, usually `127.0.0.1` for local operation
asfPort: '1242' # Port used by ASF, default is `1242`
asfPassword: '' # ASF password
asfBotname: '' # ASF Bot name to idle game
```

### SU configuration (optional)

> Using [SU](https://github.com/DoctorMcKay/node-steam-user) to idle Steam games requires extensive configuration. If you don’t want to do this part, you can leave it blank. Requires `steamUse` for `SU`.
>
> If the Steam Guard Mobile or Steam Guard (e-mail) is enabled on Steam, please enter the two-step verification code as prompted by the console when using this method for the first time.

#### SU parameters description

```yml
steamAccountName: ''
steamPassword: ''
```

### Proxy configuration (optional)

> proxy parameter description

#### proxy parameter description

```yml
proxy:
  enable:
    - github # It uses proxy when detecting updates, delete this line if not used
    - twitch # It uses proxy when visiting Twitch website, delete this line if not used
    - awa # It uses proxy when visiting AWA forum, delete this line if not used
    - asf # It uses proxy when accessing ASF, delete this line if not used
    - steam # It uses proxy when accessing Steam, delete this line if not used
  protocol: 'http' # proxy protocol, 'http' or 'socks'
  host: '127.0.0.1' # proxy host
  port: 1080 # proxy port
  username: '' # Proxy username, if none can be left blank
  password: '' # Proxy password, if none can be left blank
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

## Function

### Daily Quests

```mermaid
flowchart TD
  A([Start]) --> B{Is the task completed}
  B --> |Yes| C([Stop])
  B --> |No| D{"Whether if it's a quest to open a page"}
  D --> |Yes| E[Perform the task]
  E --> F{Is the task completed}
  F --> |Yes| C
  F --> |No| G{"It's a quest with a task in a page (with a link)"}
  D --> |No| G
  G --> |Yes| H[Perform the task]
  H --> I{Is the task completed}
  I --> |Yes| C
  I --> |No| J{Is there/This quest exist in the database}
  J --> |Yes| K[Perform the task]
  K --> L{Is the task completed}
  L --> |Yes| C
  L & J --> |No| M["Change border/Change badge/Change avatar/Read News/Check Leaderboard/Check Rewards/Check Store page/Check Video page"]
  M --> N{Is the task completed}
  N --> |Yes| C
  N --> |No| O[Reply to post]
  O --> P{Is the task completed}
  P --> |Yes| C
  P --> |No| C
```

### AWA Online

```mermaid
flowchart TD
  A([Start]) --> B{Is the task completed}
  B --> |Yes| C([Stop])
  B --> |No| D[Send requests repeatedly]
  D -.-> E[Is the task completed] -. Finish .-> C
```

### Twitch Quest

```mermaid
flowchart TD
  A([Start]) --> B{Is the task completed}
  B --> |Yes| C([Stop])
  B --> |No| D[Get Available Live stream]
  D --> E{Is there a live stream available}
  E --> |Yes| F[Get the live stream ID]
  E --> |No| G[Wait 10 minutes]
  F --> |Fail| K{There's other live streams available}
  K --> |Yes| H[Change to another live stream]
  K --> |No| C
  H --> F
  F --> |Success| I[Get ART widget info]
  I --> |Fail| K
  I --> |Success| J[Send requests repeatedly]
  J -.-> L[Is the task completed] -. Finish .-> C
```

### Steam Quest

```mermaid
flowchart TD
  A([Start]) --> B[Get Quest info]
  B --> C[Get details of each quest]
  C --> |Not Owned| D["Try again\n(Equivalent to click in the 'Check Games' button)"]
  D --> |Not Owned| F([Skip this quest])
  C & D --> |Owned| E["Start this quest\n(Equivalent to click in the 'Start Quest' button)"]
  E --> F{Request ASF detection whether if there are games available on account from the Steam Quest}
  C --> |Started| F
  F --> |Yes| G[ASF will idle]
  F --> |No| H([Stop])
  G -.-> I[Is the task completed] -. Finish .-> H
```

## Example running

![Example](https://github.com/HCLonely/AWA-Helper/raw/main/static/NORmcaCfEA.png)

## TODO

- [x] AWA reply protection (preliminarily realized through ARP Log)

## Thanks

- [axios](https://github.com/axios/axios)
- [chalk](https://github.com/chalk/chalk)
- [cheerio](https://github.com/cheeriojs/cheerio)
- [dayjs](https://github.com/iamkun/dayjs)
- [node-tunnel](https://github.com/koichik/node-tunnel)
- [node-socks-proxy-agent](https://github.com/TooTallNate/node-socks-proxy-agent)
- [yaml](https://github.com/eemeli/yaml)
- [pkg](https://github.com/vercel/pkg)
- [node-steam-user](https://github.com/DoctorMcKay/node-steam-user)
- [TypeScript](https://github.com/Microsoft/TypeScript)
- [node-fs-extra](https://github.com/jprichardson/node-fs-extra)
- [eslint](https://github.com/eslint/eslint)
- [yaml-lint](https://github.com/rasshofer/yaml-lint)
- [express](https://github.com/expressjs/express)
- [express-ws](https://github.com/HenningM/express-ws)
- [lodash](https://github.com/lodash/lodash)
- [playwright](https://github.com/microsoft/playwright)
