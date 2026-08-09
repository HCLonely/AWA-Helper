/** Scoped file, console, and WebSocket logger shared by Manager-owned jobs. */
import * as fs from 'fs-extra';
import { formatLogValue } from './sanitize';
import { getLogFilePath, getLogScope, type LogScope } from './LogContext';

interface WebLogEntry {
  id: number;
  data: unknown;
  type: 'log' | 'questInfo';
  scope: LogScope;
}

globalThis.logs = { type: 'logs' };
globalThis.wsClients = new Set();
globalThis.secrets = [];

let nextLogId = Date.now();

const broadcastWebUi = (data: WebLogEntry): void => {
  const message = JSON.stringify(data);
  globalThis.wsClients.forEach((client) => {
    if (client.readyState !== 1) {
      globalThis.wsClients.delete(client);
      return;
    }
    try {
      client.send(message);
    } catch (_error) {
      globalThis.wsClients.delete(client);
    }
  });
};

const escapeHtml = (data: string): string => data
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll('\'', '&#39;');

const toHtml = (value: unknown): string => {
  const safeText = escapeHtml(formatLogValue(value));
  // eslint-disable-next-line no-control-regex
  return safeText.replace(/\x1B\[90m(.+?)\x1B\[39m/g, '<font class="gray">$1</font>')
    // eslint-disable-next-line no-control-regex
    .replace(/\x1B\[31m(.+?)\x1B\[39m/g, '<font class="red">$1</font>')
    // eslint-disable-next-line no-control-regex
    .replace(/\x1B\[32m(.+?)\x1B\[39m/g, '<font class="green">$1</font>')
    // eslint-disable-next-line no-control-regex
    .replace(/\x1B\[33m(.+?)\x1B\[39m/g, '<font class="yellow">$1</font>')
    // eslint-disable-next-line no-control-regex
    .replace(/\x1B\[34m(.+?)\x1B\[39m/g, '<font class="blue">$1</font>')
    // eslint-disable-next-line no-control-regex
    .replace(/\x1B\[(?:1|22)m/g, '')
    .replace(/\n/g, '</br>');
};

const writeFileLog = (scope: LogScope, value: unknown, newLine: boolean): void => {
  fs.mkdirSync('logs', { recursive: true });
  fs.appendFileSync(getLogFilePath(scope), formatLogValue(value, true) + (newLine ? '\n' : ''));
};

export class Logger {
  readonly id = nextLogId++;
  readonly scope = getLogScope();
  private data = '';

  constructor(text: unknown, newLine = true) {
    if (globalThis.webUI) {
      this.log(text, newLine);
    } else {
      Logger.consoleLog(text, newLine, this.scope);
    }
  }

  log(value: unknown, newLine = true): void {
    if (value && typeof value === 'object' && 'type' in value && value.type === 'questInfo') {
      const entry: WebLogEntry = {
        id: this.id,
        data: 'data' in value ? value.data : undefined,
        type: 'questInfo',
        scope: this.scope
      };
      globalThis.logs[`${this.scope}:questInfo`] = entry;
      broadcastWebUi(entry);
      return;
    }
    writeFileLog(this.scope, value, newLine);
    if (globalThis.log) {
      if (newLine) {
        console.log(formatLogValue(value));
      } else {
        process.stdout.write(formatLogValue(value));
      }
    }
    this.data += typeof value === 'string' ? value : formatLogValue(value);
    const entry: WebLogEntry = { id: this.id, data: toHtml(this.data), type: 'log', scope: this.scope };
    globalThis.logs[`${this.scope}:${this.id}`] = entry;
    const ids = Object.keys(globalThis.logs).filter((id) => id.startsWith(`${this.scope}:`) && /\d+$/.test(id));
    if (ids.length > 1000) {
      ids.slice(0, ids.length - 1000).forEach((id) => delete globalThis.logs[id]);
    }
    broadcastWebUi(entry);
  }

  static consoleLog(text: unknown, newLine = true, scope = getLogScope()): void {
    if (text && typeof text === 'object' && 'type' in text && text.type === 'questInfo') {
      return;
    }
    writeFileLog(scope, text, newLine);
    if (!globalThis.log) {
      return;
    }
    if (newLine) {
      console.log(formatLogValue(text));
    } else {
      process.stdout.write(formatLogValue(text));
    }
  }
}
