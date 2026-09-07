/** Scoped file, console, and WebSocket logger shared by Manager-owned jobs. */
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { formatLogValue } from './sanitize';
import { getLogFilePath, getLogScope, type LogScope } from './LogContext';
import { sendWebUiMessage } from './WebSocketLimits';

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
const terminalColorLevel = chalk.level;

/**
 * WebUI 日志以 Chalk 的 ANSI 标记作为颜色语义的中间格式。即使 stdout
 * 不是 TTY（例如 Docker），启用 WebUI 时也必须让 Chalk 生成这些标记。
 */
const configureWebUiColors = (enabled: boolean): void => {
  chalk.level = enabled ? 1 : terminalColorLevel;
};

const broadcastWebUi = (data: WebLogEntry): void => {
  const message = JSON.stringify(data);
  globalThis.wsClients.forEach((client) => {
    sendWebUiMessage(client, message);
  });
};

const boundLogCache = (): void => {
  const entries = Object.entries(globalThis.logs).filter(([key]) => key !== 'type');
  let bytes = entries.reduce((total, [, entry]) => total + Buffer.byteLength(JSON.stringify(entry)), 0);
  for (const [key, entry] of entries.filter(([key]) => !key.endsWith(':questInfo'))) {
    if (bytes <= 512 * 1024) {
      break;
    }
    bytes -= Buffer.byteLength(JSON.stringify(entry));
    delete globalThis.logs[key];
  }
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
  const filename = getLogFilePath(scope);
  const text = formatLogValue(value, true).slice(0, 64 * 1024) + (newLine ? '\n' : '');
  if (fs.existsSync(filename) && fs.statSync(filename).size + Buffer.byteLength(text) > 10 * 1024 * 1024) {
    const previous = filename.replace(/\.txt$/, '.1.txt');
    fs.rmSync(previous, { force: true });
    fs.renameSync(filename, previous);
  }
  fs.appendFileSync(filename, text);
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
      if (Buffer.byteLength(JSON.stringify(entry)) > 64 * 1024) {
        return;
      }
      globalThis.logs[`${this.scope}:questInfo`] = entry;
      boundLogCache();
      broadcastWebUi(entry);
      return;
    }
    writeFileLog(this.scope, value, newLine);
    if (globalThis.log) {
      const consoleValue = formatLogValue(value, !process.stdout.isTTY || Object.hasOwn(process.env, 'NO_COLOR'));
      if (newLine) {
        console.log(consoleValue);
      } else {
        process.stdout.write(consoleValue);
      }
    }
    this.data = (this.data + formatLogValue(value)).slice(-2048);
    const entry: WebLogEntry = { id: this.id, data: toHtml(this.data), type: 'log', scope: this.scope };
    globalThis.logs[`${this.scope}:${this.id}`] = entry;
    const ids = Object.keys(globalThis.logs).filter((id) => id.startsWith(`${this.scope}:`) && /\d+$/.test(id));
    if (ids.length > 1000) {
      ids.slice(0, ids.length - 1000).forEach((id) => delete globalThis.logs[id]);
    }
    boundLogCache();
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

export { configureWebUiColors };
