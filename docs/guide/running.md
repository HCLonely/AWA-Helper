# 运行方式

## 命令行参数

| 命令 | 作用 |
| --- | --- |
| `node index.js` | 启动常驻 Manager |
| `node index.js --manager` | 启动常驻 Manager |
| `node index.js --daily` | 通过 Manager 执行一次 DailyQuest |
| `node index.js --healthcheck` | 检查统一 WebUI 服务状态 |
| `node index.js --init` | 创建运行所需文件后退出 |
| `node index.js --update` | 下载并校验新版，退出后由安装器更新文件，不自动重启 |
| `node index.js --version` | 显示版本号 |
| `node index.js --help` | 显示命令帮助 |
| `node index.js --manager --no-update` | 本次启动跳过自动更新 |

`--helper` 是 `--daily` 的兼容别名，不建议在新脚本中继续使用。

`--daily` 执行结束后退出，成功返回退出码 `0`，失败返回 `1`。它与常驻 Manager 共用运行目录中的进程锁；已有 Manager 运行时，请在 WebUI 中启动 Helper，或先停止 Manager 再运行单次任务。`--manager` 与 `--daily` 不能同时使用。

## Windows

Windows 发行包提供三个互不替代的入口：

| 入口 | 行为 |
| --- | --- |
| `AWA-Manager.exe` | 隐藏启动常驻 Manager，并在系统托盘中提供状态和任务控制 |
| `AWA-Manager.bat` | 保留控制台窗口运行常驻 Manager |
| `AWA-DailyQuest.bat` | 保留控制台窗口执行一次 DailyQuest |

### AWA-Manager.exe 托盘程序

`AWA-Manager.exe` 是 Windows 后台运行入口。双击后，它会启动同一目录下的 `AWA-Helper.exe`，以常驻 Manager 模式运行，并在任务栏通知区域显示托盘图标，不显示控制台窗口。请保留完整发行包目录，确保两个 `.exe` 位于同一目录，并先准备好配置文件。

启动成功后会出现系统通知。找不到图标时，可展开任务栏通知区域的隐藏图标。鼠标悬停会显示 Helper、Achievement 和 Artifact 状态，包括空闲、运行中、正在停止、已完成、失败和已取消。双击图标可在默认浏览器中打开管理页面。

托盘菜单目前使用中文，其操作如下：

| 菜单项 | 说明 |
| --- | --- |
| 打开管理页面 | 打开当前 Manager 的本机 WebUI 地址，使用已配置的端口和 HTTP/HTTPS 协议 |
| 查看运行状态 | 通过系统通知显示 Manager 及三个任务的当前状态 |
| 打开日志目录 | 在文件管理器中打开程序目录下的 `logs/` |
| 检查更新 | 检查正式发行版，下载并校验后安装，完成后重新启动托盘与 Manager |
| 重试安装 / 修复 | 仅在安装不完整时显示，重新尝试补齐程序文件 |
| 开机自启（已启用／未启用） | 切换当前 Windows 用户登录时是否自动启动托盘程序 |
| 启动Helper／停止Helper | 启动一次 DailyQuest，或停止正在运行的 DailyQuest |
| 启动Achievement／停止Achievement | 启动或停止成就任务 |
| 退出AWA-Manager | 请求 Manager 停止任务、调度器和 WebUI，等待进程退出后移除托盘图标 |

Manager 尚未就绪、已经停止或正在退出时，任务控制项不可用；任务正在停止时，对应按钮也会暂时禁用。Artifact 在托盘中仅显示状态，遗物切换计划请在配置中设置。

::: tip 后台运行与 WebUI
托盘启动后仍按 Cron 计划运行任务；需要立即执行每日任务时，点击“启动Helper”。停止 Helper 不会退出 Manager，也不会删除定时计划，下一次计划仍可启动任务。关闭浏览器页面也不会停止后台任务。

即使 `webUI.enable: false`，托盘仍可显示状态、控制任务和退出程序，但无法打开管理页面。WebUI 启用时，进入页面后的管理操作仍需填写 `manager.secret`；托盘菜单本身无需填写该密钥。
:::

### 开机自启与退出

“开机自启”针对当前用户登录生效，无需管理员权限。启用时会在 `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run` 中写入名为 `AWA-Manager` 的启动项，指向当前托盘程序的完整路径；关闭时删除该项。移动安装目录后，应在新位置重新启用自启，更新记录的路径。

需要停止整个后台服务时，选择“退出AWA-Manager”，等待退出完成。退出程序不会关闭已启用的开机自启；不希望下次登录自动运行时，应先关闭自启选项。

### 启动失败排查

- 缺少必需程序文件或安装清单检查不通过：托盘会自动尝试安装或修复，失败后可选择“重试安装 / 修复”；检查网络、目录写入权限及 `logs/Updater.log`。
- 提示无法启动 `AWA-Helper.exe`：检查它是否与 `AWA-Manager.exe` 位于同一目录。
- 提示托盘程序已经在运行：使用已有托盘图标操作，同一 Windows 会话只允许一个托盘实例。
- 已通过 `.bat` 或命令行启动 Manager：先停止已有 Manager，再启动托盘程序；托盘不会接管已有进程。
- 提示 Manager 启动或运行失败：从“打开日志目录”查看原因；必要时先退出托盘，再用 `AWA-Manager.bat` 查看控制台错误。
- 在 WebUI 中终止 AWA-Manager 后，托盘会等待 Manager 正常退出，再移除图标并退出托盘程序。
- Manager 异常退出但图标仍存在：托盘会保留停止状态以便查看日志。排除问题后，退出并重新启动 `AWA-Manager.exe`；它不会自动重启异常退出的 Manager。

## Linux

Linux 发行版包含对应的启动脚本。常驻运行请选择 Manager 脚本；只想执行一次每日任务时选择 DailyQuest 脚本。首次运行前需要添加执行权限：

```bash
chmod +x AWA-Manager.sh AWA-DailyQuest.sh
./AWA-Manager.sh
```

## 安装器注册的后台服务

Windows 和 Linux 安装向导会检查 WebUI 端口；端口被占用时会提示重新输入，直到选择可用端口。选择启动 Helper 或 Manager 后，安装器还会复查向导生成的配置；如有冲突，询问新端口并备份原配置后保存。手写 YAML 配置需自行修改端口。

安装脚本在配置完成并选择 Manager 后，才询问是否注册服务。默认不注册；不注册时 Manager 在当前终端前台运行。服务运行的是 `AWA-Helper --manager --no-update`，不运行 Windows 托盘，不自动打开浏览器。新配置默认关闭 `autoUpdate`；`--no-update` 只跳过启动更新，不会禁止手动 WebUI 更新。

### Windows 服务

用户选择 WinSW 或 NSSM 后，还需允许从官方 HTTPS 来源下载包装器，随后通过 UAC 注册服务。WinSW 固定使用 2.12.0；NSSM 使用官网为现代 Windows 推荐的 2.24-101-g897c7ad。包装器存放在安装目录 `.service/`；服务名为 `AWAHelper`，账户为 LocalSystem，设为自动启动并立即启动。不要将安装目录放在网络盘或可被其他不可信用户修改的位置。服务和托盘不能同时管理同一目录。

管理员 PowerShell 中管理服务：

```powershell
Get-Service AWAHelper
Stop-Service AWAHelper
Start-Service AWAHelper
Restart-Service AWAHelper
```

卸载服务（保留程序和配置）先停止，然后按已选包装器运行以下命令之一，路径换成实际安装目录：

```powershell
& 'D:\Apps\AWA-Helper\.service\AWAHelperService.exe' uninstall
# NSSM 用户改用：
& 'D:\Apps\AWA-Helper\.service\nssm.exe' remove AWAHelper confirm
```

已有 `AWAHelper` 服务时，安装器会核实服务包装器路径及其实际启动的 `AWA-Helper.exe` 和 Manager 参数。确认属于当前安装目录后，会复用服务并设置为开机自启、立即启动，无需重新下载或注册包装器；仍可能请求 UAC。服务指向其他目录或配置无法核实时，会提示使用原目录或手动处理原服务，不自动停止、删除或接管。

失败时查看 `logs/service-install.log`、包装器日志及程序日志。若注册成功但启动失败，先修正配置，再通过 `Start-Service AWAHelper` 重试。出现“服务已存在”不代表程序下载或配置保存失败；可先用 `Get-Service AWAHelper` 确认状态。

### Linux 服务与备用方式

安装器依次检测正在运行的 systemd、OpenRC、具有 `start-stop-daemon` 和 `update-rc.d`/`chkconfig` 的 SysV init。注册系统服务需要 root 或 sudo；程序以运行安装器的用户身份运行，因此通常应使用普通用户运行 `bash install.sh`，只在注册时使用 sudo。直接以 root 运行安装器时，服务也以 root 运行。

| 检测结果 | 管理命令 | 取消开机自启与卸载 |
| --- | --- | --- |
| systemd | `sudo systemctl status/start/stop/restart awa-helper`（将斜线选项替换为其中一个动作） | `sudo systemctl disable --now awa-helper`，删除 `/etc/systemd/system/awa-helper.service` 后运行 `sudo systemctl daemon-reload` |
| OpenRC | `sudo rc-service awa-helper status/start/stop/restart`（选择一个动作） | 先停止，运行 `sudo rc-update del awa-helper default`，再删除 `/etc/init.d/awa-helper` |
| SysV init | `sudo /etc/init.d/awa-helper status/start/stop/restart`（选择一个动作） | 先停止，运行 `sudo update-rc.d -f awa-helper remove` 或 `sudo chkconfig --del awa-helper`，再删除 `/etc/init.d/awa-helper` |
| 无可用 init | 单独询问是否 `nohup` 后台运行；输出 PID，使用 `kill -TERM PID` 停止 | 不注册开机自启 |

systemd 日志可用 `journalctl -u awa-helper` 查看；OpenRC 和 nohup 的控制台日志位于 `logs/service.log`，OpenRC 错误日志位于 `logs/service-error.log`；SysV 运行日志由程序自身写入 `logs/`。配置阶段完全离线于应用账号，不会执行任务；服务启动后按计划调度，需要立即执行时再使用 WebUI。

### 更新与重装

先停止原有服务或进程，重新运行安装器即可下载并校验指定正式版，默认保留配置、Cookie、日志及运行数据。更新现有服务时，在配置保留后选择“暂不启动”，再用上述服务命令启动原服务，无需再次注册。同名服务文件已存在时安装器会拒绝覆盖，避免接管其他安装。

## Docker

先在宿主机准备 `/data/awa-helper/config/config.yml`（从仓库 `config.example.yml` 复制并修改），创建 `logs` 和 `data` 目录，并确保三个挂载目录可由容器中的 `node` 用户读写。正式配置缺失时 Manager 无法启动。

下面的示例启动常驻 Manager，并将配置、日志和运行数据保存到宿主机：

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

容器默认执行 `node index.js`，即启动 Manager。镜像通过独立的 `node healthcheck.js` 探测 WebUI，间隔 30 秒、超时 5 秒，启动宽限期 10 秒，连续失败 3 次标为不健康。`node index.js --healthcheck` 仍可手动使用。

::: tip 外部访问
非容器运行时，`webUI.local: true` 仅监听 `127.0.0.1`，其他设备访问需设为 `false`。官方 Docker 镜像始终在容器内监听 `0.0.0.0`，宿主机访问范围由端口映射控制。上面的映射仅允许宿主机访问；需要其他设备访问时改为 `-p 2345:2345`，并通过防火墙或反向代理限制访问范围。不要把未加保护的管理端口直接暴露到公网。
:::

## 更新程序

`autoUpdate: true` 会在启动时检查更新，下载并校验发行包，在当前进程退出后安装；常驻模式会安排重启。WebUI 也提供更新入口。`--no-update` 只跳过启动时的自动更新。

### Windows 托盘安装与更新

托盘运行时，使用菜单“检查更新”；也可运行 `AWA-Manager.exe --check-update`，已有托盘实例会接收检查请求。托盘启动的 Manager 会将 WebUI 更新及启动自动更新请求交给原生更新器处理。托盘运行期间，独立 Helper 更新器会拒绝并行更新，并提示改用托盘菜单。

启动时发现 `AWA-Helper.exe` 缺失，或 `installation.json` 中的必需文件缺失、大小不符，会自动进入安装或修复流程。能够识别已安装版本时优先修复该版本，否则获取最新正式版。旧目录没有清单但存在 Helper 时仍可启动；原生安装或修复所下载的发行包必须包含 `installation.json`，不支持旧版无清单的包。

更新器从 GitHub 下载，失败时依次尝试内置的 `gh-proxy.org`、`cdn.gh-proxy.org` 和 `axisnow.gh-proxy.org` 来源。该流程使用 Windows 系统代理设置，不读取 YAML 中的 `proxy`。下载后校验包大小、SHA-256 和程序文件清单，等待 Manager 与托盘退出后替换程序文件，再启动并检查新版是否就绪。

安装会备份被替换的程序文件；失败时尝试回滚，中断的安装在下次启动托盘时恢复。已有配置、Cookie、日志及运行数据会保留。如果安装时既没有根目录 `config.yml`，也没有 `config/config.yml`，原生安装器会从示例创建后者；这与只生成示例的 `--init` 不同，首次安装后仍需检查代理并填写账号配置。安装与恢复日志位于 `logs/Updater.log`。

### Docker 更新

Docker 部署建议保持 `autoUpdate: false`，通过拉取新镜像并用原挂载目录重建容器来更新，使运行文件与镜像版本保持一致。

## 停止服务

前台运行时按 `Ctrl+C`。Docker 部署可以运行：

```bash
docker stop awa-helper
```
