/**
 * @file src/tools/common/async.ts
 * @description 提供支持取消信号的计时与终端交互辅助函数。
 */
import type { Interface } from 'readline';

export const sleep = (seconds: number, signal?: AbortSignal): Promise<boolean> => new Promise((resolve) => {
  if (signal?.aborted) {
    return resolve(false);
  }
  let settled = false;
  const finish = (result: boolean): void => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
    resolve(result);
  };
  const onAbort = (): void => finish(false);
  const timeout = setTimeout(() => finish(true), seconds * 1000);
  signal?.addEventListener('abort', onAbort, {
    once: true
  });
});

export const ask = (input: Interface, question: string, answers?: string[]): Promise<string> => new Promise((resolve) => {
  input.question(question, (chunk) => {
    const answer = chunk.toString().trim();
    resolve((answers && !answers.includes(answer)) || !answer ? ask(input, question, answers) : answer);
  });
});
