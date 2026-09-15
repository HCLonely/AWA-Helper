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

- 提示无法启动 `AWA-Helper.exe`：检查它是否与 `AWA-Manager.exe` 位于同一目录。
- 提示托盘程序已经在运行：使用已有托盘图标操作，同一 Windows 会话只允许一个托盘实例。
- 已通过 `.bat` 或命令行启动 Manager：先停止已有 Manager，再启动托盘程序；托盘不会接管已有进程。
- 提示 Manager 启动或运行失败：从“打开日志目录”查看原因；必要时先退出托盘，再用 `AWA-Manager.bat` 查看控制台错误。
- Manager 已停止但图标仍存在：托盘会保留停止状态以便查看日志。排除问题后，退出并重新启动 `AWA-Manager.exe`；它不会自动重启异常退出的 Manager。

## Linux

Linux 发行版包含对应的启动脚本。常驻运行请选择 Manager 脚本；只想执行一次每日任务时选择 DailyQuest 脚本。首次运行前需要添加执行权限：

```bash
chmod +x AWA-Manager.sh AWA-DailyQuest.sh
./AWA-Manager.sh
```

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

Docker 部署建议保持 `autoUpdate: false`，通过拉取新镜像并用原挂载目录重建容器来更新，使运行文件与镜像版本保持一致。

## 停止服务

前台运行时按 `Ctrl+C`。Docker 部署可以运行：

```bash
docker stop awa-helper
```
