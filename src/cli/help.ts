/**
 * @file src/cli/help.ts
 * @description 生成统一 Manager 运行方式、兼容参数和辅助命令的命令行帮助文本。
 */
/**
 * 格式化命令行帮助文本。
 * @returns `string`，formatHelp 获取或生成的文本内容。
 */
const formatHelp = (): string => [
  'AWA-Helper',
  '',
  'Usage:',
  '  AWA-Helper                  Start Manager (persistent mode)',
  '  AWA-Helper --manager        Start Manager (persistent mode)',
  '  AWA-Helper --daily          Run DailyQuest once through Manager',
  '  AWA-Helper --helper         Legacy alias for --daily',
  '  AWA-Helper --healthcheck    Probe the unified WebUI server',
  '  AWA-Helper --init           Create runtime files and exit',
  '  AWA-Helper --update         Check for updates and exit',
  '  AWA-Helper --version        Print version'
].join('\n');

export { formatHelp };
