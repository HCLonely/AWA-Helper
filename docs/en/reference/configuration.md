# Configuration

AWA-Helper uses YAML configuration. Copy the example from the program's runtime directory:

```bash
cp config/config.example.yml config/config.yml
```

YAML is indentation-sensitive. Use spaces, not tabs. For the complete and continuously updated list of fields, see [`config.example.yml`](https://github.com/HCLonely/AWA-Helper/blob/main/config.example.yml).

## Configuration Location and Validation

The program changes its working directory to the entry file's directory, then uses the first configuration found in this order:

1. `config.yml`
2. `config/config.yml`
3. If the runtime directory name ends in `dist` or `output`, the parent's `config.yml`, then the parent's `config/config.yml`.

For source builds, use `output/config/config.yml`. Check this precedence if you already have a root configuration, so you edit the active file. Startup and WebUI saves validate YAML and configuration fields; failed WebUI validation leaves the original file intact. See [WebUI and Logs](/en/guide/webui) for when saved or manually edited settings take effect.

## General Settings

```yaml
language: en
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

| Field | Description |
| --- | --- |
| `language` | Interface and log language; supports `zh` and `en` |
| `webUI.enable` | Enables the WebUI |
| `webUI.port` | WebUI listening port |
| `webUI.local` | Outside containers, `true` binds to `127.0.0.1`; the official container always binds to `0.0.0.0` |
| `timeout` | Per-run DailyQuest timeout in seconds; `0` disables the limit. A timeout stops that run while persistent Manager stays running |
| `logsExpire` | Log retention in days; `0` disables the limit |
| `logsMaxMB` | Total log storage budget, default `512` MiB; `0` disables the budget. Today's logs and files being written are retained |
| `debug.http` | Default `false`; logs HTTP addresses, status codes, and duration, excluding headers, bodies, and URL query parameters |
| `TLSRejectUnauthorized` | Enables TLS certificate verification |
| `autoUpdate` | Downloads and verifies updates at startup, then installs after process exit; disabled by default |

`logsExpire` and `logsMaxMB` work independently; setting one to `0` does not disable the other. Maintenance runs at startup and hourly, removing older logs first. Retaining today's logs and active files means storage may temporarily exceed the budget.

For HTTPS, set both `webUI.ssl.key` and `webUI.ssl.cert`; certificate paths are relative to the active `config.yml` directory. `UA` sets the browser User-Agent used for requests.

## Manager Scheduling

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

- `secret` is the Manager API secret. When left empty, it is generated on first launch. A value shorter than 16 characters produces a security warning but is still accepted.
- `dailyQuest.cron` accepts five fields (minute, hour, day, month, weekday) or six fields (with seconds first). An empty string disables scheduled DailyQuest runs; also remove any legacy `managerServer.cron` / `corn` to prevent fallback to the old schedule. Schedules use the process environment's time zone.
- `achievement.enable` controls scheduled achievement tasks.
- `artifacts` accepts multiple artifact ID and switch-time configurations. Each `ids` array must contain exactly three distinct positive integers. Allow at least 24 hours between two artifact changes.

For example, `3 30 14,21 * * *` runs every day at `14:30:03` and `21:30:03`; `0 14 * * *` means `14:00:00` daily. Each scheduled trigger stops the same job before starting a new run. Choose intervals and `timeout` based on actual runtime to avoid restarting unfinished tasks.

## AWA Tasks

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

Remove or comment out tasks in `awaQuests` that you do not need. Add `battlePass` to claim currently available Battle Pass rewards automatically; it is disabled by default. You can enter `awaCookie` manually or synchronize it using the browser userscript.

`awaHost` accepts a hostname with an optional port, without `https://` or a path. Legacy tasks use `dailyQuestOld`; `awaDailyQuestType` selects `click`, `visitLink`, `openLink`, `changeBorder`, `changeAvatar`, `viewNews`, `sharePost`, and `replyPost`. This list does not control the newer `dailyQuest` task.

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

When `watchTwitch` is enabled, `twitchCookie` must contain non-empty `unique_id` and `auth-token` fields. When `steamQuest` is enabled, configure `steamUse: ASF`, a valid ASF host, port, and bot name, and ensure that ASF IPC is reachable from the AWA-Helper environment.

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

`enable` accepts individual services: `github`, `twitch`, `awa`, `asf`, or `pusher`. Steam quest endpoints on AWA use `awa`, while ASF IPC uses `asf`. The legacy `steam` target remains temporarily compatible but is deprecated. Supported protocols are `http`, `https`, `socks4`, and `socks5`.

Set `proxy.enable: []` if no proxy is needed. The release example enables a local proxy on port `1080`; adjust it for your environment.

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

When enabled, `platform` must be non-empty and `key` must be a non-empty object. Use the optional `pusher.options` object for additional platform options. DailyQuest reports group daily quests, online tasks, Steam, community events, calendar rewards, and Battle Pass results, including ARP, claim progress, and failed rewards. Notifications use plain text.

See [Run history and diagnostics](/en/guide/webui#run-history-and-diagnostics) for timezone selection and history storage.
