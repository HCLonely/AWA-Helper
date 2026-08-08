/**
 * @file Command
 * @description Defines supported CLI commands and Manager runtime modes.
 */
export type RuntimeMode = 'persistent' | 'once';

export type Command =
  | { kind: 'run'; mode: RuntimeMode; deprecatedHelper: boolean }
  | { kind: 'healthcheck' }
  | { kind: 'init' }
  | { kind: 'update' }
  | { kind: 'help' }
  | { kind: 'version' };
