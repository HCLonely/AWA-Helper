# Getting Started

## Before You Begin

Make sure that:

1. Your Alienware Arena (AWA) account is linked to Steam, and your Steam profile and game details are public.
2. Your AWA account is linked to Twitch, and you have authorized the AWA Twitch extension.
3. If you want to automate Steam playtime quests, [ArchiSteamFarm](https://github.com/JustArchiNET/ArchiSteamFarm) is installed and configured.

::: danger Game safety
Idling games in the background may trigger anti-cheat systems. Stop AWA-Helper and any related ASF tasks before playing games such as Call of Duty.
:::

## Get AWA-Helper

### Use a Release Build (Recommended)

Download the archive for your operating system and CPU architecture from [GitHub Releases](https://github.com/HCLonely/AWA-Helper/releases/latest), then extract it into a dedicated directory.

From the directory containing the program, copy the example under `config/` and edit it as needed:

```bash
cp config/config.example.yml config/config.yml
```

On Windows, you can also copy and rename the file in File Explorer. If the example is missing, run `AWA-Helper.exe --init` (Windows) or `node index.js --init` (Node.js archive) first. `--init` creates directories, the example, and launch scripts, but does not create `config.yml`.

After configuring Windows, double-click `AWA-Manager.exe` to run in the system tray. It requires `AWA-Helper.exe` in the same directory. See the [tray application guide](/en/guide/running#awa-manager-exe-tray-application) for menu actions, startup at sign-in, and troubleshooting.

The example enables a proxy at `127.0.0.1:1080`. Set `proxy.enable` to `[]` if you do not use that proxy, or enter your actual proxy address. Twitch and Steam playtime tasks are disabled by default; configure their credentials before enabling them.

### Run from Source

Running from source requires Node.js `^22.13.0 || >=24.0.0`: version 22.13.0 or later within 22.x, or version 24 and above. Node.js 23.x is excluded.

```bash
git clone https://github.com/HCLonely/AWA-Helper.git
cd AWA-Helper
npm ci
npm run build:pre
node output/index.js --init
cp output/config/config.example.yml output/config/config.yml
```

Edit `output/config/config.yml`, including proxy settings, then start Manager:

```bash
node output/index.js --manager
```

## Start Manager

Manager is the recommended long-running mode. It provides the unified WebUI and schedules all tasks. Run these Node.js commands from the directory containing `index.js`; on Windows, you can launch `AWA-Manager.exe` directly:

```bash
node index.js --manager
```

Running without an argument also starts Manager:

```bash
node index.js
```

The WebUI is available at `http://127.0.0.1:2345` by default. If you change `webUI.port`, use the configured port instead.

Persistent Manager waits for scheduled triggers; it does not run DailyQuest immediately on startup. Start Helper in the WebUI to run it immediately, or see [Running AWA-Helper](/en/guide/running) for one-off execution.

## Synchronize Cookies

1. Start Manager and confirm that you can open the WebUI.
2. Install Tampermonkey Beta in your browser.
3. Install the project's [AWA-Manager userscript](https://github.com/HCLonely/AWA-Helper/raw/main/TM_UserScript/AWA-Manager.user.js).
4. Open the AWA Control Center and enter the Manager address and secret in the userscript settings.
5. Refresh the AWA page. The userscript will synchronize your cookies with Manager.

If `manager.secret` is empty on first launch, Manager generates a secret and writes it to the configuration file. A manually configured secret shorter than 16 characters produces a security warning but does not prevent startup.

Read `manager.secret` from the active `config.yml` and enter the same secret in the WebUI to control tasks and settings. Update the userscript to the current version, which uses `/api/cookies/awa`. Synchronized cookies apply to the next task run; stop and restart an active task if it needs the new configuration immediately.

## Next Steps

- See [Running AWA-Helper](/en/guide/running) for one-off commands and Docker deployment.
- See [Configuration](/en/reference/configuration) to enable tasks, proxies, and notifications.
- See [WebUI and Logs](/en/guide/webui) for saving settings, configuration reloads, and log previews.
