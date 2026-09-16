/**
 * @file src/tools/logging/sanitize.ts
 * @description 递归清理日志对象中的密钥、Cookie、请求头和 ANSI 控制序列。
 */
import { format } from 'util';
import { AsyncLocalStorage } from 'async_hooks';

const secretScopes = new AsyncLocalStorage<Set<string>>();
let configuredSecrets = new Set<string>();
const errorSecrets = new WeakMap<object, Set<string>>();

const sensitiveKeyPattern = /(authorization|authentication|cookie|password|secret|token|api[-_]?key|proxy[-_]?auth)/i;
const visibleConfigKeyPattern = /^awaHost$/i;

/**
 * 隐藏已知敏感信息。
 * @param text - 需要记录、推送或格式化的文本内容，类型为 `string`。
 * @returns `string`，redactKnownSecrets 获取或生成的文本内容。
 */
const redactKnownSecrets = (text: string, retained?: Set<string>): string => {
  let result = text;
  const secrets = new Set([...(globalThis.secrets || []), ...configuredSecrets, ...(secretScopes.getStore() || []), ...(retained || [])]);
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length > 5) {
      result = result.replaceAll(secret, '********');
    }
  }
  return result;
};

/**
 * 收集日志脱敏所需的敏感值。
 * @param value - 需要写入或参与计算的值，类型为 `unknown`。
 * @returns `string[]`，collectLogSecrets 收集或筛选得到的数据列表。
 */
const collectLogSecrets = (value: unknown): Array<string> => {
  const secrets = new Set<string>();
  const visited = new WeakSet<object>();
  /**
   * 访问目标页面。
   * @param item - 需要遍历或处理的数据集合，类型为 `unknown`。
   * @param key - 用于读取或更新目标数据的键，类型为 `string`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  const visit = (item: unknown, key = ''): void => {
    if (typeof item === 'string') {
      if (!visibleConfigKeyPattern.test(key) && sensitiveKeyPattern.test(key) && item.length > 5) {
        secrets.add(item);
        if (/cookie/i.test(key)) {
          item.split(';').forEach((part) => {
            const separator = part.indexOf('=');
            const cookieValue = separator >= 0 ? part.slice(separator + 1).trim() : '';
            if (cookieValue.length > 5) {
              secrets.add(cookieValue);
            }
          });
        }
      }
      return;
    }
    if (!item || typeof item !== 'object' || visited.has(item)) {
      return;
    }
    visited.add(item);
    Object.entries(item as Record<string, unknown>).forEach(([name, child]) => visit(child, name));
  };
  visit(value);
  return [...secrets];
};

/**
 * 设置日志脱敏所需的敏感值。
 * @param config - 控制当前操作行为的配置，类型为 `unknown`。
 * @returns `void`，该函数仅执行副作用，不返回值。
 */
const setLogSecrets = (config: unknown): void => {
  const scope = secretScopes.getStore();
  if (scope) {
    collectLogSecrets(config).forEach((secret) => scope.add(secret));
  } else {
    configuredSecrets = new Set(collectLogSecrets(config));
  }
};

/** 旧值随对应异步任务保留，不存入进程级历史列表。 */
const withLogSecrets = async <T>(config: unknown, action: () => Promise<T>): Promise<T> => {
  const scope = new Set([...configuredSecrets, ...(secretScopes.getStore() || []), ...collectLogSecrets(config)]);
  return secretScopes.run(scope, async () => {
    try {
      return await action();
    } catch (error) {
      if (error && typeof error === 'object') {
        const previous = errorSecrets.get(error);
        if (previous) {
          previous.forEach((secret) => scope.add(secret));
        }
        errorSecrets.set(error, scope);
        throw error;
      }
      // 不保留非结构化的拒绝原因，其本身可能就是凭据字符串。
      // eslint-disable-next-line preserve-caught-error
      throw new Error(redactKnownSecrets(String(error)));
    }
  });
};

const safeErrorMessage = (error: unknown): string => redactKnownSecrets(
  error instanceof Error ? error.message : String(error),
  error && typeof error === 'object' ? errorSecrets.get(error) : undefined
);

/**
 * 清理对象中的敏感信息。
 * @param value - 需要写入或参与计算的值，类型为 `unknown`。
 * @param visited - 用于记录已经清理过的对象并避免循环引用，类型为 `WeakSet<object>`。
 * @returns `unknown`，移除敏感字段并处理循环引用后的安全值。
 */
const sanitizeObject = (value: unknown, visited = new WeakSet<object>()): unknown => {
  if (value instanceof Error) {
    const error = value as Error & {
      code?: unknown
      config?: {
        method?: unknown,
        url?: unknown
      }
      response?: {
        status?: unknown
      }
    };
    return {
      name: error.name,
      message: safeErrorMessage(error),
      code: error.code,
      status: error.response?.status,
      method: error.config?.method,
      url: typeof error.config?.url === 'string' ? redactKnownSecrets(error.config.url, errorSecrets.get(error)) : undefined
    };
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (visited.has(value)) {
    return '[Circular]';
  }
  visited.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObject(item, visited));
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    !visibleConfigKeyPattern.test(key) && sensitiveKeyPattern.test(key) ? '********' : sanitizeObject(item, visited)
  ]));
};

/**
 * 格式化日志值。
 * @param value - 需要写入或参与计算的值，类型为 `unknown`。
 * @param stripAnsi - 用于决定是否移除文本中的 ANSI 控制序列，类型为 `boolean`。
 * @returns `string`，formatLogValue 获取或生成的文本内容。
 */
const formatLogValue = (value: unknown, stripAnsi = false): string => {
  const safeValue = typeof value === 'string' ? value : sanitizeObject(value);
  let output = typeof safeValue === 'string' ? safeValue : format(safeValue);
  output = redactKnownSecrets(output, value && typeof value === 'object' ? errorSecrets.get(value) : undefined);
  return stripAnsi ? stripLogAnsi(output) : output;
};

// eslint-disable-next-line no-control-regex
const stripLogAnsi = (text: string): string => text.replace(/\x1B\[[\d;]*?m/g, '');

export { collectLogSecrets, formatLogValue, setLogSecrets, stripLogAnsi, withLogSecrets, safeErrorMessage };
