/**
 * @file parseArguments
 * @description Parses public CLI flags without allowing ambiguous runtime modes.
 */
import type { Command } from './Command';

const parseArguments = (args: string[]): Command => {
  const hasManager = args.includes('--manager');
  const hasDaily = args.includes('--daily');
  const hasHelper = args.includes('--helper');
  if (hasManager && (hasDaily || hasHelper)) {
    throw new Error('--manager cannot be combined with --daily or --helper');
  }
  if (args.includes('--healthcheck')) return { kind: 'healthcheck' };
  if (args.includes('--init')) return { kind: 'init' };
  if (args.includes('--update')) return { kind: 'update' };
  if (args.includes('--help') || args.includes('-h')) return { kind: 'help' };
  if (args.includes('--version') || args.includes('-v')) return { kind: 'version' };
  if (hasDaily || hasHelper) {
    return { kind: 'run', mode: 'once', deprecatedHelper: hasHelper && !hasDaily };
  }
  return { kind: 'run', mode: 'persistent', deprecatedHelper: false };
};

export { parseArguments };
