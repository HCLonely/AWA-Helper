# Running AWA-Helper

## Command-Line Options

| Command | Description |
| --- | --- |
| `node index.js` | Start the long-running Manager |
| `node index.js --manager` | Start the long-running Manager |
| `node index.js --daily` | Run DailyQuest once through Manager |
| `node index.js --healthcheck` | Check the unified WebUI service |
| `node index.js --init` | Create required runtime files, then exit |
| `node index.js --update` | Download and verify an update; install after exit without automatically restarting |
| `node index.js --version` | Display the version number |
| `node index.js --help` | Display command help |
| `node index.js --manager --no-update` | Skip automatic updates for this launch |

`--helper` remains an alias for `--daily` for compatibility, but it is not recommended for new scripts.

`--daily` exits after completion with code `0` on success or `1` on failure. It shares the runtime directory's process lock with persistent Manager. If Manager is already running, start Helper through the WebUI, or stop Manager before launching a one-off run. `--manager` and `--daily` cannot be combined.

## Windows

The Windows archive provides three independent entry points:

| Entry point | Behavior |
| --- | --- |
| `AWA-Manager.exe` | Start the long-running Manager without a console and expose status and task controls in the system tray |
| `AWA-Manager.bat` | Keep the console visible while running the long-running Manager |
| `AWA-DailyQuest.bat` | Keep the console visible while running DailyQuest once |

### AWA-Manager.exe Tray Application

`AWA-Manager.exe` is the Windows background launcher. Double-clicking it starts `AWA-Helper.exe` from the same directory in persistent Manager mode and adds an icon to the taskbar notification area, without showing a console window. Keep the complete release directory, ensure both `.exe` files remain together, and prepare the configuration first.

A system notification confirms startup. If the icon is hidden, expand the taskbar's hidden icons. Hover over it to see Helper, Achievement, and Artifact states: idle, running, stopping, completed, failed, or cancelled. Double-click it to open the management page in your default browser.

The tray menu currently uses Chinese labels:

| Menu label | Action |
| --- | --- |
| 打开管理页面 | Open this Manager's local WebUI address using the configured port and HTTP/HTTPS protocol |
| 查看运行状态 | Show a system notification with Manager and all three job states |
| 打开日志目录 | Open the program directory's `logs/` folder in File Explorer |
| 检查更新 | Check for a stable release, download and verify it, then install and restart the tray and Manager |
| 重试安装 / 修复 | Shown only for an incomplete installation; retry installing or repairing program files |
| 开机自启（已启用／未启用） | Toggle automatic tray startup when the current Windows user signs in |
| 启动Helper／停止Helper | Start a DailyQuest run or stop the active run |
| 启动Achievement／停止Achievement | Start or stop achievement tasks |
| 退出AWA-Manager | Ask Manager to stop jobs, the scheduler, and the WebUI; remove the tray icon after the process exits |

Task controls are disabled while Manager is starting, stopped, or exiting. A task's control is also disabled while it is stopping. Artifact has status display only in the tray; configure artifact switching through its schedule settings.

::: tip Background operation and WebUI
Tray startup still follows Cron schedules. Choose “启动Helper” to run DailyQuest immediately. Stopping Helper leaves Manager and its schedules running, so the next scheduled trigger can start it again. Closing the browser does not stop background tasks either.

With `webUI.enable: false`, the tray can still show status, control tasks, and exit the program, but cannot open a management page. When the WebUI is enabled, its management actions still require `manager.secret`; tray controls do not require entering that secret.
:::

### Startup at Sign-In and Exit

Automatic startup applies to the current user's sign-in and does not require administrator privileges. Enabling it writes an `AWA-Manager` entry under `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`, pointing to the current tray executable's full path. Disabling it removes the entry. If you move the installation, enable startup again from the new location to update the stored path.

Choose “退出AWA-Manager” to stop the entire background service and wait for shutdown to finish. Exiting does not disable startup at sign-in; turn that option off first if you do not want the program to launch at the next sign-in.

### Startup Troubleshooting

- Required program files are missing or the installation manifest check fails: the tray attempts installation or repair automatically. If it fails, choose “重试安装 / 修复” and check network access, directory write permissions, and `logs/Updater.log`.
- Cannot start `AWA-Helper.exe`: check that it is in the same directory as `AWA-Manager.exe`.
- Tray application already running: use the existing icon; only one tray instance is allowed per Windows session.
- Manager already started through a `.bat` file or command line: stop it before launching the tray. The tray does not attach to an existing process.
- Manager startup or runtime failure: open the logs directory to inspect the cause. If necessary, exit the tray and use `AWA-Manager.bat` to see console errors.
- Stopping AWA-Manager from the WebUI also closes the tray application and removes its icon after Manager exits normally.
- Manager exited with an error but the icon remains: the tray keeps the stopped state available for inspecting logs. After fixing the issue, exit and relaunch `AWA-Manager.exe`; it does not automatically restart Manager after an unexpected exit.

## Linux

The Linux archive includes its corresponding startup scripts. Choose the Manager script for continuous operation, or the DailyQuest script to run daily tasks once. Make the scripts executable before the first run:

```bash
chmod +x AWA-Manager.sh AWA-DailyQuest.sh
./AWA-Manager.sh
```

## Installer-Managed Services

On Windows and Linux, the configuration wizard checks the WebUI port and asks for another port when it is occupied. Before launching Helper or Manager, the installer checks wizard-generated configurations again; if needed, it asks for a new port and backs up the configuration before saving. Edit handwritten YAML configurations manually.

After configuration, select Manager and optionally register it as a service. Windows asks you to choose and approve downloading WinSW 2.12.0 or NSSM 2.24-101-g897c7ad, then requests UAC elevation. Service `AWAHelper` runs as LocalSystem, starts automatically and starts immediately. It launches `AWA-Helper.exe --manager --no-update`, without the tray or browser. Keep the installation on a local disk in a trusted directory.

Use `Get-Service AWAHelper`, `Stop-Service AWAHelper`, `Start-Service AWAHelper` or `Restart-Service AWAHelper` in administrator PowerShell. If the service already exists, the installer verifies its wrapper path, actual Helper executable and Manager arguments. A matching installation reuses and starts the service with automatic startup, without downloading or registering the wrapper again; UAC may still be required. A service belonging to another directory or with unrecognized settings is left untouched. To remove the service while keeping files, stop it and run either `& 'D:\Apps\AWA-Helper\.service\AWAHelperService.exe' uninstall` or `& 'D:\Apps\AWA-Helper\.service\nssm.exe' remove AWAHelper confirm`, matching the wrapper selected. Registration errors are logged to `logs/service-install.log`.

Linux detects systemd, OpenRC, then SysV init with `start-stop-daemon` and `update-rc.d`/`chkconfig`. Registering uses root or sudo; the application runs as the installer user. Prefer running the installer as a normal user and allowing sudo only for registration. If no supported init system exists, the installer separately asks whether to run via nohup; this does not guarantee startup at boot.

| Backend | Management | Disable startup and remove |
| --- | --- | --- |
| systemd | `sudo systemctl status awa-helper` (or `start`, `stop`, `restart`) | `sudo systemctl disable --now awa-helper`, remove `/etc/systemd/system/awa-helper.service`, then `sudo systemctl daemon-reload` |
| OpenRC | `sudo rc-service awa-helper status` (or `start`, `stop`, `restart`) | Stop, `sudo rc-update del awa-helper default`, remove `/etc/init.d/awa-helper` |
| SysV | `sudo /etc/init.d/awa-helper status` (or `start`, `stop`, `restart`) | Stop, `sudo update-rc.d -f awa-helper remove` or `sudo chkconfig --del awa-helper`, remove `/etc/init.d/awa-helper` |
| nohup | Use the displayed PID: `kill -TERM PID` | No startup registration |

Inspect systemd logs with `journalctl -u awa-helper`; OpenRC/nohup console output is in `logs/service.log`. Stop the service before rerunning the installer for updates, preserve existing configuration, choose no startup, and start the existing service afterwards. Existing service names are never overwritten. New configurations disable automatic updates; `--no-update` only skips startup updates. Without service registration, Manager runs in the current terminal until stopped.

## Docker

Prepare `/data/awa-helper/config/config.yml` on the host by copying and editing the repository's `config.example.yml`. Create the `logs` and `data` directories and ensure all three mounted directories are readable and writable by the container's `node` user. Manager cannot start without the actual configuration file.

The following example starts Manager and persists configuration, logs, and runtime data on the host:

```bash
docker run -d \
  --name awa-helper \
  --restart unless-stopped \
  -p 127.0.0.1:2345:2345 \
  -v /data/awa-helper/config:/usr/src/app/output/config \
  -v /data/awa-helper/logs:/usr/src/app/output/logs \
  -v /data/awa-helper/data:/usr/src/app/output/data \
  hclonely/awa-helper:latest
```

The container runs `node index.js` by default, which starts Manager. The image probes the WebUI with the standalone `node healthcheck.js` every 30 seconds, with a 5-second timeout, a 10-second startup grace period, and 3 retries. `node index.js --healthcheck` remains available for manual checks.

::: tip Access from other devices
Outside containers, `webUI.local: true` binds only to `127.0.0.1`; set it to `false` for access from other devices. The official Docker image always binds to `0.0.0.0` inside the container, so the published port determines host-side exposure. The example allows only host access; use `-p 2345:2345` for other devices and restrict access with a firewall or reverse proxy. Never expose an unprotected management port directly to the internet.
:::

## Updates

With `autoUpdate: true`, startup checks download and verify a release, then install it after the current process exits. Persistent mode schedules a restart. The WebUI also provides an update action. `--no-update` skips only automatic startup updates.

### Windows Tray Installation and Updates

While the tray is running, choose “检查更新” (Check for updates). You can also run `AWA-Manager.exe --check-update`; an existing tray instance receives the request. A Manager launched by the tray delegates WebUI and automatic startup updates to the native updater. The standalone Helper updater refuses concurrent updates while the tray is running and directs you to its menu.

If `AWA-Helper.exe` is missing, or a required file in `installation.json` is missing or has the wrong size, startup automatically begins installation or repair. Repair targets the installed version when it can be identified, or the latest stable release otherwise. Older directories with Helper but no manifest can still start. Packages downloaded for native installation or repair must contain `installation.json`; older packages without it are unsupported.

The updater downloads from GitHub, falling back in order to the built-in `gh-proxy.org`, `cdn.gh-proxy.org`, and `axisnow.gh-proxy.org` sources. It uses Windows system proxy settings rather than the YAML `proxy` configuration. It verifies the archive size, SHA-256, and program file manifest, waits for Manager and the tray to exit, replaces program files, then starts the new version and checks that it is ready.

Installation backs up replaced program files and attempts rollback on failure. Interrupted installations are recovered on the next tray launch. Existing configuration, cookies, logs, and runtime data are preserved. If neither root-level `config.yml` nor `config/config.yml` exists, the native installer creates the latter from the example. Unlike `--init`, which only generates the example, this creates an active configuration; check proxy settings and enter account credentials after first installation. Installation and recovery logs are in `logs/Updater.log`.

### Docker Updates

For Docker, keep `autoUpdate: false` and update by pulling the new image and recreating the container with the same mounted directories, so runtime files stay consistent with the image version.

## Stop the Service

Press `Ctrl+C` when running in the foreground. For Docker, run:

```bash
docker stop awa-helper
```
