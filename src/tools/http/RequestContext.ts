/**
 * @file src/tools/http/RequestContext.ts
 * @description 在异步请求调用链中传递取消信号。
 */
import { AsyncLocalStorage } from 'async_hooks';

const requestSignals = new AsyncLocalStorage<{ signal: AbortSignal; cancelInFlight: boolean }>();

/** 在嵌套 API 调用中传递作业取消信号，避免共享可变状态。 */
export const runWithRequestSignal = <T>(signal: AbortSignal, action: () => T, cancelInFlight = false): T => requestSignals.run({
  signal,
  cancelInFlight
}, action);

export const withRequestSignal = <T extends myAxiosConfig>(options: T): T => {
  const context = requestSignals.getStore();
  const signal = context?.signal.aborted ? context.signal : options.signal;
  if (signal?.aborted) {
    throw new Error('Request cancelled', {
      cause: (signal as AbortSignal).reason
    });
  }
  return {
    ...options,
    // 作业停止只阻止新请求；显式请求期限仍可中止正在进行的传输。
    ...(context?.cancelInFlight && !options.signal && {
      signal: context.signal
    })
  };
};

export const getRequestSignal = (): AbortSignal | undefined => requestSignals.getStore()?.signal;
