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

## Windows 与 Linux

发行版包含对应平台的启动脚本。常驻运行请选择 Manager 脚本；只想执行一次每日任务时选择 DailyQuest 脚本。Linux 首次运行前需要添加执行权限：

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
