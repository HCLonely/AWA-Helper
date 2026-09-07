import type WebSocket from 'ws';

export const MAX_WS_CLIENTS = 16;
export const MAX_WS_BUFFER = 1024 * 1024;

export const sendWebUiMessage = (client: WebSocket, message: string): boolean => {
  if (client.readyState !== 1 || (client.bufferedAmount || 0) + Buffer.byteLength(message) > MAX_WS_BUFFER) {
    globalThis.wsClients.delete(client);
    client.terminate();
    return false;
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
