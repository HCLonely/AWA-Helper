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

Before the first run, copy the example configuration to `config.yml` and edit it as needed:

```bash
cp config.example.yml config.yml
```

On Windows, you can also copy and rename the file in File Explorer.

### Run from Source

Running from source requires Node.js 22.13 or later. Node.js 24 and later are also supported.

```bash
git clone https://github.com/HCLonely/AWA-Helper.git
cd AWA-Helper
npm ci
npm run build:pre
node output/index.js --init
node output/index.js --manager
```

## Start Manager

Manager is the recommended long-running mode. It provides the unified WebUI and schedules all tasks:

```bash
node index.js --manager
```

Running without an argument also starts Manager:

```bash
node index.js
```

The WebUI is available at `http://127.0.0.1:2345` by default. If you change `webUI.port`, use the configured port instead.

## Synchronize Cookies

1. Start Manager and confirm that you can open the WebUI.
2. Install Tampermonkey Beta in your browser.
3. Install the project's [AWA-Manager userscript](https://github.com/HCLonely/AWA-Helper/raw/main/TM_UserScript/AWA-Manager.user.js).
4. Open the AWA Control Center and enter the Manager address and secret in the userscript settings.
5. Refresh the AWA page. The userscript will synchronize your cookies with Manager.

If `manager.secret` is empty on first launch, Manager generates a secret and writes it to the configuration file. A manually configured secret shorter than 16 characters produces a security warning but does not prevent startup.

## Next Steps

- See [Running AWA-Helper](/en/guide/running) for one-off commands and Docker deployment.
- See [Configuration](/en/reference/configuration) to enable tasks, proxies, and notifications.
