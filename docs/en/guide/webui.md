# WebUI and Logs

## Connect to Manager

After starting Manager, open the default address `http://127.0.0.1:2345`. If you are not signed in, you will be redirected to the dedicated login page (`/login`). Enter `manager.secret` from the active configuration; successful verification returns you to the page you requested. Remembering the secret stores it in this browser's local storage; otherwise it is saved only for the current tab session.

The management panel stays hidden while login is being verified. Sign in again if the secret becomes invalid or changes. If the connection fails, check that Manager is online and retry. “Sign out” clears the current tab's session secret and the secret saved in this browser, then returns to the login page. It does not stop Manager or background tasks.

The home page can start or stop Helper (DailyQuest) and Achievement, show status, open logs, update the program, or stop Manager. An accepted start request does not mean the job has completed; check its status and logs for the result.

## Edit Settings

1. Sign in to the WebUI, then open settings.
2. The page loads the built-in settings template and current server configuration. Select a configuration group from the group navigation.
3. Edit switches, choices, and input fields. Add or remove array and object-list entries where the template provides those controls.
4. Save the current group. The page validates inputs, then the server validates the full configuration.
5. If prompted to restart for server settings, restart Manager. Use the new address after changing the port or HTTPS settings.

Edits are not saved automatically. Saves build on the current configuration and preserve fields outside the template. Form saves reserialize the configuration, so original YAML comments and formatting are not retained. If loading fails, check the secret, connection, and error message, then use the retry button.

You can also select or drop a local **settings template**, or enter a remote template URL. These files define the editing form; an ordinary `config.yml` cannot be imported as a template.

## Manage Multiple Steam Community Events

1. Enable `joinSteamCommunityEvent`, include `steamQuest` in `awaQuests`, and configure ASF.
2. Under **DailyQuest Control → Steam CommunityEvent**, click **Add game** and enter each Steam game ID. Names are optional.
3. If a game cannot be matched automatically, supply its event path: `https://www.alienwarearena.com/steam/community-event/aniimo-community-event` uses `aniimo-community-event`, not the full URL.
4. Click **Save game data** to save all rows. Removing a row only edits the form until you save. Duplicate game IDs and nonempty event paths are rejected.
5. Alternatively, select a built-in source and click **Sync from remote**. Matching ongoing games are saved directly, preserving other valid local entries. Failed synchronization preserves existing data.

Each row shows its update timestamp and is valid only for the runtime machine's current year and month. Legacy single-game data appears as one row and is converted to a `games` array on save. See [CommunityEvent game data](/en/reference/configuration#steam-communityevent-game-data) for formats and fields. When automatic joining is disabled, manual editing and saving remain available, but remote synchronization is disabled.

All ongoing events are discovered from `LIVE` banners in AWA's `/control-center`, with separate joining and completion checks. Unfinished joined games with valid configuration are combined with ordinary Steam quests, deduplicated, and sent to ASF in one play request. Task status and notifications show each event separately; one event completing does not stop the others.

Restart the daily task after adding or changing games during a run so they are included in ASF's startup list.

## When Changes Take Effect

| Change or method | Behavior |
| --- | --- |
| Save configuration in the WebUI | Writes and reloads configuration, updating schedules and dynamic runtime settings |
| Change WebUI enablement, port, listening scope, or certificate settings | Saving reports that Manager must restart |
| Change the Manager secret | APIs use the new secret and existing WebSocket sessions disconnect; update other browsers and userscripts too |
| Change task credentials, task options, or proxies | New runs read the latest configuration; active runs retain their configuration snapshot |
| Edit the file directly | The next task run reads the file; restart Manager or save through the WebUI to reload process-level settings such as schedules and the WebUI |

The userscript can also synchronize the User-Agent when submitting AWA cookies. Both AWA and Twitch cookie endpoints reload configuration after writing. Jobs also attempt to save refreshed AWA cookies, but will not overwrite a newer cookie written separately by the user during the run.

## Read Logs

- Files live in the runtime directory's `logs/`, separated by Manager, DailyQuest, Achievement, Artifact, and date.
- Task pages show recent live logs through WebSocket connections. The live view has a display limit to bound browser resource use.
- The log preview dialog reads files in pages and opens at the latest content. Use the older-log control to page backward and the latest-log control to reload the end.
- If the file rotates, the preview reports the change and resets its position. Missing logs show an empty state. Previewing requires Manager to be online and a valid secret.
- Read earlier dates directly from `logs/`. See [Configuration](/en/reference/configuration) for retention and storage limits.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Manager is running but Helper is idle | Persistent mode waits for Cron; start Helper manually from the home page |
| Redirected to login or told the secret is invalid | Check `manager.secret` in the active configuration and sign in again with that secret |
| Cookie synchronization succeeds but the active job still reports authentication errors | Check that the userscript uses the current API; stop and restart the job to read new cookies |
| Configuration changes have no effect | Check configuration path precedence and save status; server settings require a restart |
| Logs exceed `logsMaxMB` | Today's logs and active files are protected; the budget is not a hard file-size limit |
| An online task encounters a transient network error | When the AWA online heartbeat error count reaches 6, it waits 5 minutes before retrying; retryable Twitch heartbeat errors also wait before retrying. Check the logs to see whether recovery is still in progress |

## Run history and diagnostics

Open **Run history & diagnostics** from the Manager home page (`/operations`). This dedicated dashboard loads records automatically and groups activity, schedules and connection checks into separate panels.

The operations page shows recent runs, subtask results, consecutive failures and the next five scheduled times. Click “Refresh records” to update it. History uses the browser timezone; each schedule uses its configured timezone.

```yaml
manager:
  # timezone: Asia/Shanghai  # Empty or omitted: use the system timezone
  historyLimit: 200         # 10–1000; restart required
```

- Run history is stored in `data/manager/history.json`, retaining 200 runs by default. Unfinished runs become interrupted at the next startup. Corrupt history is preserved and storage errors are shown on the dashboard.
- “Check connections” checks AWA session/page structure, Twitch extension authorization and ASF IPC status without performing tasks. Results distinguish expired sessions, missing extensions, rate limits, changed pages and connection failures, with suggested actions. Identical configurations share a 30-second result cache.
- “Export redacted diagnostics” downloads JSON containing the version, runtime environment, latest 50 runs, last diagnostic results and the tail of today's four log scopes (up to 64 KiB each). Export does not run new probes or include full configuration or raw pages.
- Cron preview does not save configuration. Five fields omit seconds; six include them. Both date and weekday must match when both are restricted. Check the preview for timezone and daylight-saving effects.
