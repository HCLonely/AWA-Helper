/**
 * @file src/tools/logging/OperationLog.ts
 * @description 记录外部请求边界，并移除 URL 查询参数以及请求凭据等敏感信息。
 */
import { Logger } from './Logger';
import { time } from '../common';

interface RequestResult {
  status?: number;
}

const safeRequestTarget = (value: unknown): string => {
  const source = String(value || '(unknown URL)');
  try {
    const parsed = new URL(source);
    return `${parsed.origin}${parsed.pathname}`;
  } catch (_error) {
    return source.split(/[?#]/, 1)[0];
  }
};

const requestFailureDetails = (error: unknown): string => {
  if (!error || typeof error !== 'object') {
    return __('unknownError');
  }
  const candidate = error as {
    code?: unknown;
    name?: unknown;
    response?: {
    status?: unknown
  }
  };
  const status = typeof candidate.response?.status === 'number' ? `HTTP ${candidate.response.status}` : undefined;
  const code = typeof candidate.code === 'string' ? candidate.code : undefined;
  const name = typeof candidate.name === 'string' ? candidate.name : undefined;
  return [status, code, name].filter(Boolean).join(', ') || __('unknownError');
};

/** 记录一次真实网络请求的开始、结果和耗时；不会记录 headers、body 或完整查询字符串。 */
export const observeExternalRequest = async <T extends RequestResult>(
  service: string,
  options: Pick<myAxiosConfig, 'method' | 'url'>,
  request: () => Promise<T>
): Promise<T> => {
  const startedAt = Date.now();
  const method = String(options.method || 'GET').toUpperCase();
  const target = safeRequestTarget(options.url);
  new Logger(`${time()}${__('httpRequestStarted', service, method, target)}`);
  try {
    const response = await request();
    new Logger(`${time()}${__('httpRequestCompleted', service, method, target, String(response.status ?? '-'), String(Date.now() - startedAt))}`);
    return response;
  } catch (error) {
    new Logger(`${time()}${__('httpRequestFailed', service, method, target, requestFailureDetails(error), String(Date.now() - startedAt))}`);
    throw error;
  }
};

export { safeRequestTarget };
