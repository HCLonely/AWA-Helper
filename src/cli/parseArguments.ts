/**
 * @file src/cli/parseArguments.ts
 * @description 解析命令行参数，校验互斥运行模式，并转换为类型安全的命令对象。
 */
import type { Command } from './Command';

/**
 * 解析 parse Arguments 相关数据。
 * @param args - 待解析的命令行参数列表，类型为 `string[]`。
 * @returns `Command`，parseArguments 解析得到的结构化结果。
 */
const parseArguments = (args: string[]): Command => {
  const hasManager = args.includes('--manager');
  const hasDaily = args.includes('--daily');
  const hasHelper = args.includes('--helper');
  const trayChild = args.includes('--tray-child');
  if (hasManager && (hasDaily || hasHelper)) {
    throw new Error('--manager cannot be combined with --daily or --helper');
  }
  if (trayChild && (hasDaily || hasHelper)) {
    throw new Error('--tray-child can only be used with persistent Manager mode');
  }
  if (args.includes('--healthcheck')) {
    return { kind: 'healthcheck' };
  }
  if (args.includes('--init')) {
    return { kind: 'init' };
  }
  if (args.includes('--update')) {
    return { kind: 'update' };
  }
  if (args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' };
  }
  if (args.includes('--version') || args.includes('-v')) {
    return { kind: 'version' };
  }
  if (hasDaily || hasHelper) {
    return { kind: 'run', mode: 'once', deprecatedHelper: hasHelper && !hasDaily, trayChild: false };
  }
  return { kind: 'run', mode: 'persistent', deprecatedHelper: false, trayChild };
};

export { parseArguments };
