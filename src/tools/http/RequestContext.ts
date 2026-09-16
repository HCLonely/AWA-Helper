/**
 * @file src/tools/http/RequestContext.ts
 * @description 在异步请求调用链中传递取消信号。
 */
import { AsyncLocalStorage } from 'async_hooks';

const requestSignals = new AsyncLocalStorage<AbortSignal>();

/** 在嵌套 API 调用中传递作业取消信号，避免共享可变状态。 */
export const runWithRequestSignal = <T>(signal: AbortSignal, action: () => T): T => requestSignals.run(signal, action);

export const withRequestSignal = <T extends myAxiosConfig>(options: T): T => {
  const signal = options.signal ?? requestSignals.getStore();
  if (signal?.aborted) {
    throw new Error('Request cancelled', {
      cause: (signal as AbortSignal).reason
    });
  }
  return {
    ...options,
    ...(signal && {
      signal
    })
  };
};

export const getRequestSignal = (): AbortSignal | undefined => requestSignals.getStore();
