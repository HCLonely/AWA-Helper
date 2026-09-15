import type WebSocket from 'ws';
import type { WebLogEntry } from './LogCache';

const MAX_BYTES = 1024 * 1024;
export const REPLAY_SEND_TIMEOUT_MS = 30_000;
interface Delivery {
  queue: string[];
  bytes: number;
  active: boolean;
  closed: boolean;
  timer?: NodeJS.Timeout;
}
const deliveries = new WeakMap<WebSocket, Delivery>();

const closeDelivery = (client: WebSocket, delivery: Delivery): void => {
  delivery.closed = true;
  clearTimeout(delivery.timer);
  delivery.timer = undefined;
  delivery.queue.length = 0;
  delivery.bytes = 0;
  deliveries.delete(client);
};

const pump = (client: WebSocket, delivery: Delivery): void => {
  if (delivery.closed || delivery.active || !delivery.queue.length) {
    return;
  }
  if (client.readyState !== 1 || client.bufferedAmount > MAX_BYTES) {
    closeDelivery(client, delivery); client.terminate(); return;
  }
  const message = delivery.queue.shift()!;
  delivery.active = true;
  delivery.timer = setTimeout(() => {
    closeDelivery(client, delivery); client.terminate();
  }, REPLAY_SEND_TIMEOUT_MS);
  delivery.timer.unref();
  try {
    client.send(message, (error?: Error) => {
      if (delivery.closed) {
        return;
      }
      delivery.active = false;
      clearTimeout(delivery.timer);
      delivery.timer = undefined;
      delivery.bytes -= Buffer.byteLength(message);
      if (error) {
        closeDelivery(client, delivery); client.terminate(); return;
      }
      pump(client, delivery);
    });
  } catch (_error) {
    closeDelivery(client, delivery); client.terminate();
  }
};

/** undefined means the client uses the legacy direct-send protocol. */
export const enqueueReplayMessage = (client: WebSocket, message: string, bytes: number): boolean | undefined => {
  const delivery = deliveries.get(client);
  if (!delivery) {
    return undefined;
  }
  if (delivery.bytes + bytes > MAX_BYTES || delivery.queue.length >= 4096) {
    closeDelivery(client, delivery); client.terminate(); return false;
  }
  delivery.queue.push(message);
  delivery.bytes += bytes;
  pump(client, delivery);
  return !delivery.closed;
};

export const startLogReplay = (client: WebSocket, entries: WebLogEntry[]): void => {
  const delivery: Delivery = { queue: [], bytes: 0, active: false, closed: false };
  let chunk: Record<string, WebLogEntry | string> = { type: 'logs' };
  let size = 0;
  const append = (): void => {
    const encoded = JSON.stringify(chunk);
    delivery.queue.push(encoded);
    delivery.bytes += Buffer.byteLength(encoded);
    chunk = { type: 'logs' }; size = 0;
  };
  for (const entry of entries) {
    const entrySize = Buffer.byteLength(JSON.stringify(entry));
    if (size && size + entrySize > 48 * 1024) {
      append();
    }
    chunk[`${entry.scope}:${entry.type === 'questInfo' ? 'questInfo' : entry.id}`] = entry;
    size += entrySize;
  }
  append();
  if (delivery.bytes > MAX_BYTES) {
    client.terminate(); return;
  }
  deliveries.set(client, delivery);
  client.once('close', () => closeDelivery(client, delivery));
  client.once('error', () => closeDelivery(client, delivery));
  pump(client, delivery);
};
