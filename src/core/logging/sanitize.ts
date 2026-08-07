import { format } from 'util';

const sensitiveKeyPattern = /(authorization|authentication|cookie|password|secret|token|api[-_]?key|proxy[-_]?auth)/i;

const redactKnownSecrets = (text: string): string => {
  let result = text;
  for (const secret of globalThis.secrets || []) {
    if (typeof secret === 'string' && secret.length > 5) {
      result = result.replaceAll(secret, '********');
    }
  }
  return result;
};

const collectLogSecrets = (value: unknown): Array<string> => {
  const secrets = new Set<string>();
  const visited = new WeakSet<object>();
  const visit = (item: unknown, key = ''): void => {
    if (typeof item === 'string') {
      if (sensitiveKeyPattern.test(key) && item.length > 5) {
        secrets.add(item);
        if (/cookie/i.test(key)) {
          item.split(';').forEach((part) => {
            const separator = part.indexOf('=');
            const cookieValue = separator >= 0 ? part.slice(separator + 1).trim() : '';
            if (cookieValue.length > 5) secrets.add(cookieValue);
          });
        }
      }
      return;
    }
    if (!item || typeof item !== 'object' || visited.has(item)) return;
    visited.add(item);
    Object.entries(item as Record<string, unknown>).forEach(([name, child]) => visit(child, name));
  };
  visit(value);
  return [...secrets];
};

const setLogSecrets = (config: unknown): void => {
  globalThis.secrets = [...new Set([...(globalThis.secrets || []), ...collectLogSecrets(config)])];
};

const sanitizeObject = (value: unknown, visited = new WeakSet<object>()): unknown => {
  if (value instanceof Error) {
    const error = value as Error & {
      code?: unknown
      config?: { method?: unknown, url?: unknown }
      response?: { status?: unknown }
    };
    return {
      name: error.name,
      message: redactKnownSecrets(error.message),
      code: error.code,
      status: error.response?.status,
      method: error.config?.method,
      url: error.config?.url
    };
  }
  if (!value || typeof value !== 'object') return value;
  if (visited.has(value)) return '[Circular]';
  visited.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeObject(item, visited));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    sensitiveKeyPattern.test(key) ? '********' : sanitizeObject(item, visited)
  ]));
};

const formatLogValue = (value: unknown, stripAnsi = false): string => {
  const safeValue = typeof value === 'string' ? value : sanitizeObject(value);
  let output = typeof safeValue === 'string' ? safeValue : format(safeValue);
  output = redactKnownSecrets(output);
  if (stripAnsi) {
    // eslint-disable-next-line no-control-regex
    output = output.replace(/\x1B\[[\d;]*?m/g, '');
  }
  return output;
};

export { collectLogSecrets, formatLogValue, setLogSecrets };
