# AWA-Helper

Automatically does AWA quests.

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
  B --> |No| D[Send request repeatedly]
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
  F --> |失败| K{There's other live streams available}
  K --> |Yes| H[Change to another live stream]
  K --> |No| C
  H --> F
  F --> |成功| I[Get ART widget info]
  I --> |失败| K
  I --> |成功| J[Send request repeatedly]
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

## Instructions

### Instructions before use

1. Before using it, please make sure that your AWA account has a Steam account linked and that the Steam profile settings have been set to public;
2. Before using it, please make sure that your AWA account has a Twitch account linked and that the Twitch account has been granted access to the AWA ARP widget;
3. [Not recommended] If you want to use more than one account, copy the program to another folder to run multiple accounts.

### Run from the source

> This method automatically installs the latest beta version!

#### Install and run

1. Prerequisites: Install [Git](https://git-scm.com/downloads) and [NodeJs](https://nodejs.org/zh-cn/download/) >= v16.0.0
2. Clone this repository`git clone https://github.com/HCLonely/AWA-Helper.git`
3. Install dependencies`npm install`
4. Build`npm run build`
5. Edit configuration file [view instructions](#config-file-configuration)
6. Run`npm start`/double click`AWA-Helper.bat`

> Note: Steps 1-5 are only required for the first installation, only step 6 is required for each run after that!

#### Update via Git

1. Pull update`git pull`
2. Install dependencies`npm install`
3. Build`npm run build`
4. Run`npm start`/double click`AWA-Helper.bat`

> Note: Steps 1-3 are only required for the first run after each update, only step 4 is required for each run after that!

### Download the compressed program and run

#### Automatically install dependencies (Recommended)

> **This method requires Powershell!**

1. [Click here](https://github.com/HCLonely/AWA-Helper/releases/latest) to download the compressed program in zip
2. Extract
3. Edit configuration file,[View instructions](#config-file-configuration)
4. Double click`运行-auto.bat`to run(Missing dependencies are automatically installed)

#### Install dependencies on your own

1. Install [NodeJs](https://nodejs.org/zh-cn/download/) >= v16.0.0
2. [Click here](https://github.com/HCLonely/AWA-Helper/releases/latest) to download the compressed program in zip
3. Extract
4. Install dependencies`npm install --save`
5. Edit configuration file [view instructions](#config-file-configuration)
6. Double click`运行.bat`to run

#### Update

1. [Click here](https://github.com/HCLonely/AWA-Helper/releases/latest) to download the compressed program in zip
2. Extract and overwrite it
3. Double click`运行.bat`to run

## config (File configuration)

> **The`config.example.yml`file needs to be renamed to`config.yml`!!!**

### AWA configuration (required)

#### AWA parameters description

```yml
language: 'zh' # Program display language, currently supports Chinese (zh) and English (en)
webUI:
  enable: true # Whether to enable WebUI
  port: 3456 # WebUI port
timeout: 0 # timeout setting，Unit: seconds, 0 means without limit. If the program is still running after this time, close the program.
```

### AWA configuration (Required)

#### AWA Parameter Description

```yml
awaCookie: '' # AWA Cookie, it supports having only `REMEMBERME`, if there is no `REMEMBERME`, then you must have `PHPSESSID` and `sc`, but it will cause an error to get the number of consecutive login days, however it does not affect other functionalities
awaHost: 'www.alienwarearena.com' # AWA Host, commonly used are `www.alienwarearena.com` and `na.alienwarearena.com`, the default doesn't have any problem, there's no need to change it
awaBoosterNotice: true # When there are more than 1 quest on AWA, you will be asked whether or not to activate booster. You need to activate booster manually!!!
awaQuests:
  - dailyQuest # Automatically does daily quests, it is not required to do this quest, delete or comment out this line
  - timeOnSite # Automatically does AWA Online quests, it is not required to do this quest, delete or comment out this line
  - watchTwitch # Automatically does Twitch Quests, it is not required to do this quest, delete or comment out this line
  - steamQuest # Automatically does Steam Quests, it is not required to do this quest, delete or comment out this line
awaDailyQuestType: # Daily quest type, you don't need to delete or comment it out, if you don't need to do daily quests, then delete or comment out the 'dailyQuest' line above
  - click # Visiting the quest page, the quest title is the quest link that you need to click to complete the quest
  - visitLink # Visiting the quest page, the quest title is the quest link that can only be completed by browsing a page
  - openLink # Visiting the quest page, quest title has no link, it will try visiting leaderboards, rewards, marketplace...
  - changeBorder # Change Border
  - changeBadge # Change Badge
  - changeAvatar # Change Avatar
  - viewPost # view posts
  - viewNews # view news
  - sharePost # share post
  - replyPost # Reply to a post
```

#### How to get AWA parameters

1. Open the [https://www.alienwarearena.com/account/personalization](https://www.alienwarearena.com/account/personalization) page, open browser console, find the Network tab, filter`personalization`, copy the part after`cookie:`in the Request Header, and paste it into the`awaCookie`part of the configuration file;
    ![awaCookie](https://github.com/HCLonely/AWA-Helper/raw/main/static/SaMhNF92RY.png)
2. [Optional & Recommended] Open browser console and enter the following, and replace `YOURCOOKIE` with the copied `cookie`. After pressing Enter, all the unnecessary parts will be removed.

    ```javascript
    console.log(`YOURCOOKIE`.split(';').map((e) => ['REMEMBERME','PHPSESSID','sc'].includes(e.trim().split('=')[0]) ? e.trim() : null).filter((e) => e).join(';'));
    ```

[Optional] If you are using Firefox, you can skip the 2nd step.

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
> **`SU`is currently supported only if is running from source code!!!**

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

## About Daily Quests

- If there are multiple daily quests, by default only the first quest will be completed!

## Example running

![Example](https://github.com/HCLonely/AWA-Helper/raw/main/static/NORmcaCfEA.png)

## TODO

- [ ] Protection to replies on posts (requires AWA to [implement replies history feature](https://www.alienwarearena.com/ucf/show/2163377))

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
