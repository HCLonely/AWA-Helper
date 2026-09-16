/**
 * @file src/tools/http/SharedRead.ts
 * @description 仅共享进行中的读取，不将已完成的结果复用为最新状态。
 */
export class SharedRead<T> {
  private current?: {
    controller: AbortController;
    promise: Promise<T>;
    waiters: number
  };

  get(read: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) {
      return Promise.reject(new Error('Request cancelled', {
        cause: signal.reason
      }));
    }
    let entry = this.current;
    if (!entry) {
      const controller = new AbortController();
      entry = {
        controller,
        promise: Promise.resolve().then(() => read(controller.signal)),
        waiters: 0
      };
      this.current = entry;
    }
    const active = entry;
    active.waiters++;
    return new Promise<T>((resolve, reject) => {
      let done = false;
      const finish = (action: () => void): void => {
        if (done) {
          return;
        }
        done = true;
        signal?.removeEventListener('abort', abort);
        active.waiters--;
        if (!active.waiters) {
          if (this.current === active) {
            this.current = undefined;
          }
          active.controller.abort();
        }
        action();
      };
      const abort = (): void => finish(() => reject(new Error('Request cancelled', {
        cause: signal?.reason
      })));
      signal?.addEventListener('abort', abort, {
        once: true
      });
      active.promise.then(
        (value) => finish(() => resolve(value)),
        (error: unknown) => finish(() => reject(error))
      );
    });
  }
}
