# WebUI and Logs

## Connect to Manager

After starting Manager, open `http://127.0.0.1:2345` by default and save the active configuration's `manager.secret` on the home page. Remembering the secret stores it in this browser's local storage; otherwise it is saved only for the current session.

The home page can start or stop Helper (DailyQuest) and Achievement, show status, open logs, update the program, or stop Manager. An accepted start request does not mean the job has completed; check its status and logs for the result.

## Edit Settings

1. Save the Manager secret on the home page, then open settings.
2. The page loads the built-in settings template and current server configuration. Select a configuration group from the top menu.
3. Edit switches, choices, and input fields. Add or remove array and object-list entries where the template provides those controls.
4. Save the current group. The page validates inputs, then the server validates the full configuration.
5. If prompted to restart for server settings, restart Manager. Use the new address after changing the port or HTTPS settings.

Edits are not saved automatically. Saves build on the current configuration and preserve fields outside the template. Form saves reserialize the configuration, so original YAML comments and formatting are not retained. If loading fails, check the secret, connection, and error message, then use the retry button.

You can also select or drop a local **settings template**, or enter a remote template URL. These files define the editing form; an ordinary `config.yml` cannot be imported as a template.

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
| Settings or logs report unauthorized access | Check `manager.secret` in the active configuration and save it again |
| Cookie synchronization succeeds but the active job still reports authentication errors | Check that the userscript uses the current API; stop and restart the job to read new cookies |
| Configuration changes have no effect | Check configuration path precedence and save status; server settings require a restart |
| Logs exceed `logsMaxMB` | Today's logs and active files are protected; the budget is not a hard file-size limit |
| An online task encounters a transient network error | When the AWA online heartbeat error count reaches 6, it waits 5 minutes before retrying; retryable Twitch heartbeat errors also wait before retrying. Check the logs to see whether recovery is still in progress |
