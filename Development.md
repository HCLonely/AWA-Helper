# 开发说明

## 环境与配置

在项目根目录操作，使用 `package.json` 支持的 Node.js（`^22.20.0 || ^24.12.0 || >=26.0.0`）和 npm，通过 `npm ci` 安装锁定依赖。

运行配置参考 [README](README.md) 和 `config.example.yml`。实际运行需要按所用功能填写 AWA Cookie、Manager 密钥等配置；离线类型检查不需要这些凭据。不要提交个人配置、Cookie 或包含凭据的网页样本。

### 文档站点

文档源文件位于 `docs/`，在项目根目录运行 `npm run docs:dev` 启动本地预览，运行 `npm run docs:build` 检查并构建站点，再运行 `npm run docs:preview` 预览构建结果。

## 构建与运行

- `npm run typecheck`：只检查 TypeScript 类型，不生成文件。
- `npm run build:pre`：构建 WebUI、编译程序并整理运行资源到 `output/`。构建准备脚本会清空 `dist/` 和 `output/`，构建前备份其中的个人配置与数据。
- `npm start`：在 `output/` 中启动 Manager；先完成构建并按用户说明准备运行配置。

Windows 可执行文件打包使用 `npm run pack:win`；需要打包工具和对应平台环境，详见该脚本引用的 `scripts/` 文件。

根目录 `install.ps1`（Windows PowerShell 5.1+，`install.cmd` 为双击入口）和 `install.sh`（Bash 4+）为独立安装器，不需要从源码构建。Linux 实现不依赖 Python 或 Node.js，通过 `/dev/tty` 交互，以 curl 下载、jq 处理 JSON、tar/gzip 解包、coreutils 校验与管理文件。缺少真实 glibc 时先询问，使用 apt 的 `libc6` 或 dnf/yum、zypper、pacman 的 `glibc` 安装并复查；其他工具缺失时自动尝试安装，无需额外确认；可通过 `sh install.sh` 启动 POSIX 引导段，缺少 Bash 时先自动准备 Bash 4+ 再重新执行。仅使用发行版官方包管理器，不添加第三方源，不将 Alpine 的 gcompat/libc6-compat 当作 glibc。配置向导生成 JSON 形式的合法 YAML，凭据经标准输入转义，不进入外部进程命令行；已有配置仅在用户明确选择后备份并重写。安装器通过 GitHub API 的 SHA-256 digest 或同一 Release 的 `.sha256` 验证发行包，缺少校验信息时退出；不修改模板 `config.example.yml` 的代理默认值，只在向导新配置中默认关闭代理。

Windows 安装脚本作为 Release 独立附件发布，不加入 Windows 压缩包，以兼容旧版托盘更新器的程序文件白名单。`scripts/pre-linux.js` 将 `install.sh` 复制到 Linux 发行包；Release 工作流还发布独立安装脚本及各 Linux 发行包的 SHA-256 校验文件。变更安装器后需在 Windows 检查 PowerShell AST 解析，在 Linux 检查 `bash -n install.sh`、ShellCheck 和帮助命令，并使用模拟发行包覆盖错误校验和、路径穿越/符号链接、已有配置保留、配置凭据转义、缺少 Bash/curl/jq 的自动安装、glibc 缺失的拒绝/同意/安装后复查及各 init 分支。发行包解压后先执行 `--version` 检查系统运行库兼容性，失败时不替换已安装文件。Shell 变量紧接中文或 Unicode 标点时统一使用 `${name}` 明确变量边界，避免 ISO-8859-1 等非 UTF-8 locale 将 UTF-8 首字节误识别为变量名字符。实际系统包安装与服务注册需在隔离系统中验证，不能将命令模拟当成真实安装通过。

WebUI 内联构建会从已安装的 `axios` 和 `js-yaml` 同步浏览器脚本到 `src/webUI/static/js/`，再生成页面。依赖升级后运行 `npm run gulp` 并一并提交静态脚本与锁文件，避免浏览器仍使用旧版本；不要手动修改这些第三方脚本。

## 检查与排错

提交代码前运行 `npm test`，执行 YAML/ESLint 检查和类型检查。`npm run test:unit` 引用 `tests/*.test.js`，但当前仓库未包含该目录（且 `.gitignore` 忽略它）；没有本地测试文件时不能将此命令视为有效的回归验证。

YAML 检查使用项目已有的 `yaml` 解析器，默认检查 `config.example.yml` 和 `src/locales/*.yml`；也可运行 `node scripts/check-yaml.js 文件路径` 检查指定文件。语法错误、重复键或无法读取的文件会返回非零状态，不再依赖 `yamllint` 命令。

依赖更新后运行 `npm audit` 和 `npm audit --omit=dev`，并验证 `npm test`、`npm run build:pre` 与 `npm run docs:build`。`overrides.nodemailer` 将推送库的传递依赖限制为 `^10.2.1`，调整版本后需验证邮件消息生成及实际使用的 SMTP 配置；`overrides.vitepress.vite` 使用 `^6.4.5` 修复文档工具链的已知漏洞。npm 审计不覆盖 `native/windows-tray/vendor/` 中的第三方源码。

2026-10-29 更新后，生产依赖审计为 0 漏洞；完整审计仍报告 `@rollup/plugin-node-resolve → deepmerge@4.3.1` 依赖链的 2 项低危问题，源于同一个 [deepmerge 原型污染漏洞](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)，上游尚无修复版本。暂保留当前构建插件，避免采用 `npm audit fix --force` 建议的跨主版本降级；上游修复发布后重新评估并验证构建。

Battle Pass 页面解析位于 `src/client/AWA/parsers/battlePass.ts`，领取与刷新验证位于 `src/core/DailyQuest/tasks/BattlePassTask.ts`。页面的 `completed` 表示进度完成，仍可能有 `unlockable` 奖励；`active` 和 `completed` 状态都应检查领取表单。领取成功后会刷新页面确认奖励变为 `claimed`；遇到 `verification-failed` 时检查刷新结果，遇到 `rejected` 时检查服务器响应与登录状态。

验证领取逻辑时可用脱敏 HTML 和模拟 API，覆盖进度完成但仍有奖励、全部已领、请求拒绝及刷新验证失败等情况，避免测试时真实领取奖励。
