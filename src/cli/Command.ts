/**
 * @file src/cli/Command.ts
 * @description 定义命令行支持的运行模式以及帮助、更新、健康检查等命令类型。
 */
export type RuntimeMode = 'persistent' | 'once';

export type Command =
  | { kind: 'run'; mode: RuntimeMode; deprecatedHelper: boolean; trayChild: boolean }
  | { kind: 'healthcheck' }
  | { kind: 'init' }
  | { kind: 'update' }
  | { kind: 'help' }
  | { kind: 'version' };
