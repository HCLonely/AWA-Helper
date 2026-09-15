import { AsyncLocalStorage } from 'async_hooks';

const requestSignals = new AsyncLocalStorage<AbortSignal>();

/** Propagate job cancellation through nested API calls without shared mutable state. */
export const runWithRequestSignal = <T>(signal: AbortSignal, action: () => T): T => requestSignals.run(signal, action);

export const withRequestSignal = <T extends myAxiosConfig>(options: T): T => {
  const signal = options.signal ?? requestSignals.getStore();
  if (signal?.aborted) {
    throw new Error('Request cancelled', { cause: (signal as AbortSignal).reason });
  }
  return { ...options, ...(signal && { signal }) };
};

export const getRequestSignal = (): AbortSignal | undefined => requestSignals.getStore();
