# 配置文件

AWA-Helper 使用 YAML 配置。先复制仓库中的 `config.example.yml`：

```bash
cp config.example.yml config.yml
```

YAML 对缩进敏感，请使用空格，不要使用 Tab。完整且持续更新的字段列表以 [`config.example.yml`](https://github.com/HCLonely/AWA-Helper/blob/main/config.example.yml) 为准。

## 基础设置

```yaml
language: zh
webUI:
  enable: true
  port: 2345
  local: true
timeout: 86400
logsExpire: 30
TLSRejectUnauthorized: true
```

| 字段 | 说明 |
| --- | --- |
| `language` | 界面和日志语言，支持 `zh` 与 `en` |
| `webUI.enable` | 是否启用 WebUI |
| `webUI.port` | WebUI 监听端口 |
| `webUI.local` | `true` 时仅允许本机访问 |
| `timeout` | 单次任务超时秒数，`0` 表示不限制 |
| `logsExpire` | 日志保留天数，`0` 表示不限制 |
| `TLSRejectUnauthorized` | 是否校验 TLS 证书 |

## Manager 调度

```yaml
manager:
  secret: ''
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
- `dailyQuest.cron` 使用包含秒字段的 Cron 表达式。
- `achievement.enable` 控制定时成就任务。
- `artifacts` 可配置多组遗物 ID 与切换时间；两次更换应至少间隔 24 小时。

示例 `3 30 14,21 * * *` 表示每天 `14:30:03` 和 `21:30:03` 执行。任务间隔应大于全局 `timeout`。

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
