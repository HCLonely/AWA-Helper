import { formatLogValue } from '../../tools/logging/sanitize';

/** 保留错误链中的操作、状态码及原因，不把请求配置或堆栈放入推送。 */
export const formatQuestFailure = (name: string, reason: unknown): string => {
  const parts: string[] = [];
  const visited = new Set<unknown>();
  let current = reason;
  while (current !== undefined && current !== null && !visited.has(current) && parts.length < 5) {
    visited.add(current);
    if (typeof current === 'object') {
      const error = current as { message?: unknown, operation?: unknown, code?: unknown, statusCode?: unknown, cause?: unknown };
      const details = [error.operation, error.code, error.statusCode, error.message]
        .filter((value) => typeof value === 'string' || typeof value === 'number');
      parts.push(details.length ? details.join(': ') : formatLogValue(current, true));
      current = error.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return formatLogValue(`${name}: ${parts.join(' → ') || __('taskFailureUnknown')}`, true);
};
