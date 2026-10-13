# 开发说明

## 环境与配置

在项目根目录操作，使用 `package.json` 支持的 Node.js（`^22.20.0 || ^24.12.0 || >=26.0.0`）和 npm，通过 `npm ci` 安装锁定依赖。

运行配置参考 [README](README.md) 和 `config.example.yml`。实际运行需要按所用功能填写 AWA Cookie、Manager 密钥等配置；离线类型检查不需要这些凭据。不要提交个人配置、Cookie 或包含凭据的网页样本。

## 构建与运行

- `npm run typecheck`：只检查 TypeScript 类型，不生成文件。
- `npm run build:pre`：构建 WebUI、编译程序并整理运行资源到 `output/`。构建准备脚本会清空 `dist/` 和 `output/`，构建前备份其中的个人配置与数据。
- `npm start`：在 `output/` 中启动 Manager；先完成构建并按用户说明准备运行配置。

Windows 可执行文件打包使用 `npm run pack:win`；需要打包工具和对应平台环境，详见该脚本引用的 `scripts/` 文件。

## 检查与排错

提交代码前运行 `npm test`，执行 YAML/ESLint 检查和类型检查。`npm run test:unit` 引用 `tests/*.test.js`，但当前仓库未包含该目录（且 `.gitignore` 忽略它）；没有本地测试文件时不能将此命令视为有效的回归验证。

Battle Pass 页面解析位于 `src/client/AWA/parsers/battlePass.ts`，领取与刷新验证位于 `src/core/DailyQuest/tasks/BattlePassTask.ts`。页面的 `completed` 表示进度完成，仍可能有 `unlockable` 奖励；`active` 和 `completed` 状态都应检查领取表单。领取成功后会刷新页面确认奖励变为 `claimed`；遇到 `verification-failed` 时检查刷新结果，遇到 `rejected` 时检查服务器响应与登录状态。

验证领取逻辑时可用脱敏 HTML 和模拟 API，覆盖进度完成但仍有奖励、全部已领、请求拒绝及刷新验证失败等情况，避免测试时真实领取奖励。
