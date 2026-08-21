# 运行方式

## 命令行参数

| 命令 | 作用 |
| --- | --- |
| `node index.js` | 启动常驻 Manager |
| `node index.js --manager` | 启动常驻 Manager |
| `node index.js --daily` | 通过 Manager 执行一次 DailyQuest |
| `node index.js --healthcheck` | 检查统一 WebUI 服务状态 |
| `node index.js --init` | 创建运行所需文件后退出 |
| `node index.js --update` | 检查更新后退出 |
| `node index.js --version` | 显示版本号 |

`--helper` 是 `--daily` 的兼容别名，不建议在新脚本中继续使用。

## Windows

Windows 发行包提供三个互不替代的入口：

| 入口 | 行为 |
| --- | --- |
| `AWA-Manager.exe` | 隐藏启动常驻 Manager，并在系统托盘中提供状态和任务控制 |
| `AWA-Manager.bat` | 保留控制台窗口运行常驻 Manager |
| `AWA-DailyQuest.bat` | 保留控制台窗口执行一次 DailyQuest |

使用 `AWA-Manager.exe` 时：

- 鼠标悬停托盘图标会显示 Helper、Achievement 和 Artifact 的实时状态；
- 双击托盘图标会打开 WebUI；
- 右键菜单可以查看运行状态、打开日志目录，以及根据当前状态启动或停止 Helper/Achievement；
- 右键菜单会显示开机自启是否启用，点击该项可为当前 Windows 用户切换开机自启，无需管理员权限；
- “退出AWA-Manager”会安全停止任务、调度器和 WebUI 后再退出。

## Linux

Linux 发行版包含对应的启动脚本。常驻运行请选择 Manager 脚本；只想执行一次每日任务时选择 DailyQuest 脚本。首次运行前需要添加执行权限：

```bash
chmod +x AWA-Manager.sh AWA-DailyQuest.sh
./AWA-Manager.sh
```

## Docker

下面的示例启动常驻 Manager，并将配置、日志和运行数据保存到宿主机：

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

容器默认执行 `node index.js`，即启动 Manager。容器健康检查会通过 `--healthcheck` 探测 WebUI。

::: tip 外部访问
如果需要从其他设备访问 WebUI，请将 `webUI.local` 设置为 `false`，并通过防火墙或反向代理限制访问范围。不要把未加保护的管理端口直接暴露到公网。
:::

## 停止服务

前台运行时按 `Ctrl+C`。Docker 部署可以运行：

```bash
docker stop awa-helper
```
