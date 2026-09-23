# 配置文件

AWA-Helper 使用 YAML 配置。在程序运行目录中复制示例：

```bash
cp config/config.example.yml config/config.yml
```

YAML 对缩进敏感，请使用空格，不要使用 Tab。完整且持续更新的字段列表以 [`config.example.yml`](https://github.com/HCLonely/AWA-Helper/blob/main/config.example.yml) 为准。

## 配置路径与校验

程序先将工作目录切换到入口文件所在目录，再按以下顺序查找配置，使用第一个存在的文件：

1. `config.yml`
2. `config/config.yml`
3. 如果运行目录名以 `dist` 或 `output` 结尾，再查找上一级的 `config.yml` 和 `config/config.yml`。

源码构建推荐使用 `output/config/config.yml`。已有根目录配置的用户应注意优先级，避免修改了未加载的文件。启动与 WebUI 保存都会校验 YAML 和字段；WebUI 校验失败时不会覆盖原文件。设置保存和手动编辑的生效方式见 [WebUI 与日志](/guide/webui)。

## 基础设置

```yaml
language: zh
webUI:
  enable: true
  port: 2345
  local: true
timeout: 86400
logsExpire: 30
logsMaxMB: 512
debug:
  http: false
TLSRejectUnauthorized: true
autoUpdate: false
```

| 字段 | 说明 |
| --- | --- |
| `language` | 界面和日志语言，支持 `zh` 与 `en` |
| `webUI.enable` | 是否启用 WebUI |
| `webUI.port` | WebUI 监听端口 |
| `webUI.local` | 非容器环境中，`true` 仅监听 `127.0.0.1`；官方容器始终监听 `0.0.0.0` |
| `timeout` | 单次 DailyQuest 超时秒数，`0` 表示不限制；超时停止该次任务，常驻 Manager 继续运行 |
| `logsExpire` | 日志保留天数，`0` 表示不限制 |
| `logsMaxMB` | 日志总容量预算，默认 `512` MiB；`0` 关闭容量限制，当天及正在写入的日志不会删除 |
| `debug.http` | 默认 `false`；开启后记录 HTTP 地址、状态码和耗时，不记录请求头、请求体和 URL 查询参数 |
| `TLSRejectUnauthorized` | 是否校验 TLS 证书 |
| `autoUpdate` | 启动时下载、校验新版，并在进程退出后安装，默认关闭 |

`logsExpire` 和 `logsMaxMB` 独立生效；仅将其中一项设为 `0` 不会关闭另一项。日志清理在启动时及之后每小时执行，先处理较早的日志。因为保留当天及正在写入的文件，总容量可能暂时超过预算。

启用 HTTPS 时，`webUI.ssl.key` 和 `webUI.ssl.cert` 必须同时填写；证书路径相对于实际加载的 `config.yml` 所在目录。`UA` 可设置请求使用的浏览器 User-Agent。

## Manager 调度

```yaml
manager:
  secret: ''
  # timezone: Asia/Shanghai
  historyLimit: 200
  dailyQuest:
    cron: '3 30 14,21 * * *'
  achievement:
    enable: false
    cron: '0 14 * * *'
  artifacts:
    - cron: '7 29 9 * * 1'
      ids: [636, 17056, 30235]
```

- `secret` 是 Manager API 密钥；留空时首次启动会自动生成。少于 16 个字符时程序会记录安全警告，但不会拒绝启动。
- `dailyQuest.cron` 支持五段（分、时、日、月、周）或六段（开头增加秒）的 Cron 表达式；空字符串关闭 DailyQuest 定时计划（需同时移除旧 `managerServer` 中的 `cron` / `corn`，避免回退到旧计划）。使用 `manager.timezone` 指定的 IANA 时区；留空或省略时使用系统时区。
- `achievement.enable` 控制定时成就任务。
- `artifacts` 可配置多组遗物 ID 与切换时间；每组 `ids` 必须恰好包含三个互不相同的正整数。两次更换应至少间隔 24 小时。

示例 `3 30 14,21 * * *` 表示每天 `14:30:03` 和 `21:30:03` 执行；`0 14 * * *` 表示每天 `14:00:00`。计划触发会先停止同名任务再启动新任务，请根据实际运行时长设置间隔和 `timeout`，避免任务未完成就被下一次计划重启。

新增字段的默认值与存储行为见 [运行历史与诊断](/guide/webui#运行历史与诊断)。

## AWA 任务

```yaml
awaCookie: ''
awaHost: 'www.alienwarearena.com'
awaQuests:
  - getStarted
  - dailyQuest
  # - battlePass
  - timeOnSite
  # - watchTwitch
  # - steamQuest
joinSteamCommunityEvent: true
```

从 `awaQuests` 中删除或注释不需要的任务。添加 `battlePass` 可自动领取当前 Battle Pass 中可领取的奖励；该功能默认关闭。`awaCookie` 可以手动填写，也可以通过浏览器用户脚本同步。

`awaHost` 只填写主机名（可带端口），不要添加 `https://` 或路径。旧版任务使用 `dailyQuestOld`，由 `awaDailyQuestType` 选择 `click`、`visitLink`、`openLink`、`changeBorder`、`changeAvatar`、`viewNews`、`sharePost`、`replyPost`；该列表不控制新版 `dailyQuest`。

## Twitch 与 Steam

```yaml
twitchCookie: ''
steamUse: 'ASF'
asfProtocol: 'http'
asfHost: '127.0.0.1'
asfPort: 1242
asfPassword: ''
asfBotname: ''
```

启用 `watchTwitch` 时，`twitchCookie` 必须包含非空的 `unique_id` 和 `auth-token`。启用 `steamQuest` 时，必须配置 `steamUse: ASF`、有效的 ASF Host、端口和 Botname，并确保 ASF IPC 可从 AWA-Helper 所在环境访问。

## 代理

```yaml
proxy:
  enable:
    - github
    - twitch
    - awa
  protocol: 'http'
  host: '127.0.0.1'
  port: 1080
  username: ''
  password: ''
```

`enable` 可按服务选择 `github`、`twitch`、`awa`、`asf` 或 `pusher`。AWA 上的 Steam 任务接口使用 `awa`，ASF IPC 使用 `asf`。旧配置中的 `steam` 暂时兼容但已弃用。协议支持 `http`、`https`、`socks4` 和 `socks5`。

无需代理时设置 `proxy.enable: []`。发行示例启用了本机 `1080` 端口代理，应按实际环境修改。

## 消息推送

```yaml
pusher:
  enable: false
  platform: GoCqhttp
  key:
    token: '******'
    baseUrl: 'http://127.0.0.1:5700'
    user_id: '******'
```

不同平台所需字段不同，具体参数请参考 [all-pusher-api](https://github.com/HCLonely/all-pusher-api)。不要把包含 Cookie、密钥或推送令牌的 `config.yml` 提交到版本库。

启用时必须提供非空的 `platform` 和非空对象 `key`；可通过对象 `pusher.options` 传入平台附加选项。DailyQuest 结果按每日任务、在线任务、Steam、社区活动、日历奖励和 Battle Pass 分组，展示 ARP、领取进度及失败奖励；推送使用纯文本格式。

### Steam 社区活动游戏信息

在主界面的 **DailyQuest 控制** 区域内填写游戏 ID（必填）和游戏名称（可选），点击“保存游戏信息”。数据独立保存在当前 `config.yml` 同目录的 `community-event.json`，不写入 YAML 配置。保存手动数据时，服务器自动记录 `updateTime`。

“远程来源”内置 `github`、`https://gh-proxy.org/`、`https://cdn.gh-proxy.org/`、`https://axisnow.gh-proxy.org/`，默认 GitHub。GitHub 地址为 `https://github.com/HCLonely/AWA-Helper/raw/refs/heads/main/community-event.json`，代理地址为代理前缀直接拼接该地址。点击“从远程同步”会校验并直接保存 `{gameName, gameId, updateTime}`，保留远程更新时间；失败时保留已有数据。

`updateTime` 使用 ISO 8601 日期时间（建议带时区），按运行机器本地年份和月份判断有效性，去年的同月数据也无效。启用 `joinSteamCommunityEvent` 且活动开放、个人时长未完成时，任务才读取独立文件；信息缺失或过期时从所选来源获取并保存。远程数据仍过期则跳过活动并提示重新填写。关闭开关或活动结束时不请求远程数据。
