/**
 * @file src/tools/logging/WebSocketLimits.ts
 * @description 定义 WebSocket 消息及缓冲区的容量限制。
 */
import { enqueueReplayMessage } from './WebSocketReplay';
import type WebSocket from 'ws';
import type { LogScope } from './LogContext';

const subscriptions = new WeakMap<WebSocket, LogScope>();
export const subscribeWebUiScope = (client: WebSocket, scope: LogScope): void => {
  subscriptions.set(client, scope);
};
export const acceptsWebUiScope = (client: WebSocket, scope: LogScope): boolean => !subscriptions.has(client) || subscriptions.get(client) === scope;

export const MAX_WS_CLIENTS = 16;
export const MAX_WS_BUFFER = 1024 * 1024;

export const sendWebUiMessage = (client: WebSocket, message: string, bytes = Buffer.byteLength(message)): boolean => {
  if (client.readyState !== 1 || (client.bufferedAmount || 0) + bytes > MAX_WS_BUFFER) {
    globalThis.wsClients.delete(client);
    client.terminate();
    return false;
  }
  const queued = enqueueReplayMessage(client, message, bytes);
  if (queued !== undefined) {
    return queued;
  }
  try {
    client.send(message);
    return true;
  } catch (_error) {
    globalThis.wsClients.delete(client);
    client.terminate();
    return false;
  }
};
