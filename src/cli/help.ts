/**
 * @file help
 * @description Formats command-line usage for the unified Manager runtime.
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
