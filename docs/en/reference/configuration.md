# Configuration

AWA-Helper uses YAML configuration. Start by copying `config.example.yml` from the repository:

```bash
cp config.example.yml config.yml
```

YAML is indentation-sensitive. Use spaces, not tabs. For the complete and continuously updated list of fields, see [`config.example.yml`](https://github.com/HCLonely/AWA-Helper/blob/main/config.example.yml).

## General Settings

```yaml
language: en
webUI:
  enable: true
  port: 2345
  local: true
timeout: 86400
logsExpire: 30
TLSRejectUnauthorized: true
```

| Field | Description |
| --- | --- |
| `language` | Interface and log language; supports `zh` and `en` |
| `webUI.enable` | Enables the WebUI |
| `webUI.port` | WebUI listening port |
| `webUI.local` | Allows only local connections when `true` |
| `timeout` | Per-task timeout in seconds; `0` disables the limit |
| `logsExpire` | Log retention in days; `0` disables the limit |
| `TLSRejectUnauthorized` | Enables TLS certificate verification |

## Manager Scheduling

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

- `secret` is the Manager API secret. When left empty, it is generated on first launch. A value shorter than 16 characters produces a security warning but is still accepted.
- `dailyQuest.cron` uses a Cron expression that includes the seconds field.
- `achievement.enable` controls scheduled achievement tasks.
- `artifacts` accepts multiple artifact ID and switch-time configurations. Allow at least 24 hours between two artifact changes.

For example, `3 30 14,21 * * *` runs every day at `14:30:03` and `21:30:03`. The interval between runs should be greater than the global `timeout` value.

## AWA Tasks

```yaml
awaCookie: ''
awaHost: 'www.alienwarearena.com'
awaQuests:
  - getStarted
  - dailyQuest
  - timeOnSite
  - watchTwitch
  - steamQuest
joinSteamCommunityEvent: true
```

Remove or comment out tasks in `awaQuests` that you do not need. You can enter `awaCookie` manually or synchronize it using the browser userscript.

## Twitch and Steam

```yaml
twitchCookie: ''
steamUse: 'ASF'
asfProtocol: 'http'
asfHost: '127.0.0.1'
asfPort: 1242
asfPassword: ''
asfBotname: ''
```

`twitchCookie` must contain `unique_id` and `auth-token`. Steam tasks currently use ASF. Make sure that ASF IPC is accessible from the environment where AWA-Helper runs.

## Proxy

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

`enable` accepts individual services: `github`, `twitch`, `awa`, `asf`, `steam`, or `pusher`. Supported protocols are `http`, `https`, `socks4`, and `socks5`.

## Notifications

```yaml
pusher:
  enable: false
  platform: GoCqhttp
  key:
    token: '******'
    baseUrl: 'http://127.0.0.1:5700'
    user_id: '******'
```

Required fields vary by platform. See [all-pusher-api](https://github.com/HCLonely/all-pusher-api) for details. Never commit a `config.yml` containing cookies, secrets, or notification tokens to version control.
