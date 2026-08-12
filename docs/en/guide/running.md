# Running AWA-Helper

## Command-Line Options

| Command | Description |
| --- | --- |
| `node index.js` | Start the long-running Manager |
| `node index.js --manager` | Start the long-running Manager |
| `node index.js --daily` | Run DailyQuest once through Manager |
| `node index.js --healthcheck` | Check the unified WebUI service |
| `node index.js --init` | Create required runtime files, then exit |
| `node index.js --update` | Check for updates, then exit |
| `node index.js --version` | Display the version number |

`--helper` remains an alias for `--daily` for compatibility, but it is not recommended for new scripts.

## Windows and Linux

Release archives include startup scripts for their respective platforms. Choose the Manager script for continuous operation, or the DailyQuest script to run daily tasks once. On Linux, make the scripts executable before the first run:

```bash
chmod +x AWA-Manager.sh AWA-DailyQuest.sh
./AWA-Manager.sh
```

## Docker

The following example starts Manager and persists configuration, logs, and runtime data on the host:

```bash
docker run -d \
  --name awa-helper \
  --restart unless-stopped \
  -p 2345:2345 \
  -v /data/awa-helper/config:/usr/src/app/output/config \
  -v /data/awa-helper/logs:/usr/src/app/output/logs \
  -v /data/awa-helper/data:/usr/src/app/output/data \
  hclonely/awa-helper:latest
```

The container runs `node index.js` by default, which starts Manager. Its health check uses `--healthcheck` to probe the WebUI.

::: tip Access from other devices
To access the WebUI from another device, set `webUI.local` to `false` and restrict access with a firewall or reverse proxy. Never expose an unprotected management port directly to the internet.
:::

## Stop the Service

Press `Ctrl+C` when running in the foreground. For Docker, run:

```bash
docker stop awa-helper
```
