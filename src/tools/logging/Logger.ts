/**
 * @file src/tools/logging/Logger.ts
 * @description 为 Manager 作业提供带作用域的文件、控制台及 WebSocket 日志。
 */
import chalk from 'chalk';
import { formatLogValue, stripLogAnsi } from './sanitize';
import { getLogScope } from './LogContext';
import { LogCache, type WebLogEntry } from './LogCache';
import { writeFormattedFileLog } from './LogWriter';
import { acceptsWebUiScope, sendWebUiMessage } from './WebSocketLimits';

globalThis.logs = {
  type: 'logs'
};
globalThis.wsClients = new Set();
globalThis.secrets = [];

let nextLogId = Date.now();
const terminalColorLevel = chalk.level;

/**
 * WebUI 日志以 Chalk 的 ANSI 标记作为颜色语义的中间格式。即使 stdout
 * 不是 TTY（例如 Docker），启用 WebUI 时也必须让 Chalk 生成这些标记。
 */
const configureWebUiColors = (enabled: boolean): void => {
  chalk.level = enabled ? 1 : terminalColorLevel;
};

let cacheTarget = globalThis.logs;
let cache = new LogCache(cacheTarget);
const broadcastWebUi = (data: WebLogEntry): void => {
  const message = JSON.stringify(data);
  const bytes = Buffer.byteLength(message);
  if (data.type === 'questInfo' && bytes > 64 * 1024) {
    return;
  }
  if (cacheTarget !== globalThis.logs) {
    cacheTarget = globalThis.logs;
    cache = new LogCache(cacheTarget);
  }
  cache.put(data, message);
  globalThis.wsClients.forEach((client) => {
    if (acceptsWebUiScope(client, data.scope)) {
      sendWebUiMessage(client, message, bytes);
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
      broadcastWebUi(entry);
      return;
    }
    const safeText = formatLogValue(value);
    writeFormattedFileLog(this.scope, safeText, newLine, value instanceof Error);
    if (globalThis.log) {
      const consoleValue = !process.stdout.isTTY || Object.hasOwn(process.env, 'NO_COLOR') ? stripLogAnsi(safeText) : safeText;
      if (newLine) {
        console.log(consoleValue);
      } else {
        process.stdout.write(consoleValue);
      }
    }
    this.data = (this.data + safeText).slice(-2048);
    const entry: WebLogEntry = {
      id: this.id,
      data: toHtml(this.data),
      type: 'log',
      scope: this.scope
    };
    broadcastWebUi(entry);
  }

  static consoleLog(text: unknown, newLine = true, scope = getLogScope()): void {
    if (text && typeof text === 'object' && 'type' in text && text.type === 'questInfo') {
      return;
    }
    const safeText = formatLogValue(text);
    writeFormattedFileLog(scope, safeText, newLine, text instanceof Error);
    if (!globalThis.log) {
      return;
    }
    if (newLine) {
      console.log(safeText);
    } else {
      process.stdout.write(safeText);
    }
  }
}

export { configureWebUiColors };
