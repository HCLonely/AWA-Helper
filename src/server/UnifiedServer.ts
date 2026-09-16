import { Diagnostics } from '../core/Manager/Diagnostics';
import { Scheduler } from '../core/Manager/Scheduler';
import { formatLogValue } from '../tools/logging/sanitize';
import { readLogPage } from '../tools/logging/LogPage';
import { startLogReplay } from '../tools/logging/WebSocketReplay';
/**
 * @file src/server/UnifiedServer.ts
 * @description 在同一端口托管 WebUI、管理 API、日志接口和带身份验证的 WebSocket。
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import express from 'express';
import expressWs from 'express-ws';
import type WebSocket from 'ws';
import type { Server } from 'http';
import { parse as parseYaml } from 'yaml';
import { atomicWriteFileSync, updateYamlFieldsSync, validateYaml } from '../tools/config/YamlConfig';
import { defaultConfig } from '../tools/config/ConfigLoader';
import { deepMerge, validateHelperConfig } from '../tools/config/ConfigSchema';
import type { LoadedConfig } from '../tools/config/types';
import type { JobName } from '../core/Manager/Job';
import type { JobCoordinator } from '../core/Manager/JobCoordinator';
import { decodeManagerWebSocketSecret } from './websocket/authenticate';
import { getManagerListenHost } from './network';
import { getLogFilePath, isLogScope, Logger } from '../tools/logging';
import { MAX_WS_CLIENTS, sendWebUiMessage, subscribeWebUiScope } from '../tools/logging/WebSocketLimits';
import { time } from '../tools/common';
import { getReleaseCheck, scheduleUpdate, UpdateInstallerError } from '../tools/update';
// @ts-ignore 由构建流程以内联文本形式提供。
import managerHtml from '../webUI/dist/index.html';
// @ts-ignore 由构建流程以内联文本形式提供。
import dailyQuestHtml from '../webUI/dist/dailyQuest.html';
// @ts-ignore 由构建流程以内联文本形式提供。
import achievementHtml from '../webUI/dist/achievement.html';
// @ts-ignore 由构建流程以内联文本形式提供。
import settingsHtml from '../webUI/dist/settings.html';
// @ts-ignore inline HTML template
import operationsHtml from '../webUI/dist/operations.html';
// @ts-ignore 由构建流程以内联文本形式提供。
import templateYml from '../webUI/static/templates/config.zh.yml';
// @ts-ignore 由构建流程以内联文本形式提供。
import templateYmlEN from '../webUI/static/templates/config.en.yml';
// @ts-ignore 由构建流程生成本地化资源。
import * as zh from '../locales/zh.json';
// @ts-ignore 由构建流程生成本地化资源。
import * as en from '../locales/en.json';

interface ConfigReloadResult {
  restartRequired: boolean
}

class UnifiedServer {
  private readonly diagnostics = new Diagnostics();
  private server?: Server;
  private heartbeat?: NodeJS.Timeout;
  private readonly clients = new Set<WebSocket>();
  private readonly awaitingPong = new Set<WebSocket>();

  revokeWebSocketSessions(): void {
    this.clients.forEach((client) => {
      globalThis.wsClients.delete(client);
      client.close(1008, 'Authentication changed');
      client.terminate();
    });
    this.clients.clear();
    this.awaitingPong.clear();
  }

  /**
   * 初始化 Unified Server 实例。
   * @param loaded - 已经加载并通过校验的应用配置，类型为 `LoadedConfig`。
   * @param coordinator - 负责协调作业启动与停止的协调器，类型为 `JobCoordinator`。
   * @param version - 用于比较或展示的应用版本号，类型为 `string`。
   * @param requestShutdown - 请求应用安全关闭的回调函数，类型为 `() => void`。
   * @param reloadConfig - 配置写入成功后刷新 Manager 运行时的回调函数。
   */
  constructor(
    private readonly loaded: LoadedConfig,
    private readonly coordinator: JobCoordinator,
    private readonly version: string,
    private readonly requestShutdown: () => void,
    private readonly reloadConfig: () => ConfigReloadResult,
    private readonly scheduler?: Scheduler
  ) {}

  /**
   * 执行 start 相关数据。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async start(): Promise<void> {
    const { raw, path: configPath } = this.loaded;
    if (raw.webUI?.enable === false) {
      new Logger(`${time()}${__('serverWebUiDisabled')}`);
      return;
    }
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json({ limit: '64kb' }));
    app.use(express.urlencoded({ extended: true, limit: '64kb' }));
    app.use((_, res, next) => {
      res.set({
        'Cache-Control': 'no-store',
        'Content-Security-Policy': 'default-src \'self\'; img-src \'self\' data:; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; connect-src \'self\' ws: wss:; object-src \'none\'; frame-ancestors \'none\'; base-uri \'self\'',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      });
      next();
    });

    let server: Server;
    if (raw.webUI?.ssl?.key && raw.webUI.ssl.cert) {
      const key = fs.readFileSync(path.join(path.dirname(configPath), raw.webUI.ssl.key));
      const cert = fs.readFileSync(path.join(path.dirname(configPath), raw.webUI.ssl.cert));
      server = https.createServer({ key, cert }, app);
    } else {
      server = http.createServer(app);
    }
    expressWs(app, server, { wsOptions: { maxPayload: 64 * 1024 } });
    const langs = { zh, en };
    /**
     * 格式化 render 相关数据。
     * @param html - 待解析的 HTML 文本，类型为 `string`。
     * @returns `string`，render 获取或生成的文本内容。
     */
    const render = (html: string): string => html.replace('__LANG__', raw.language)
      .replaceAll('__VERSION__', this.version)
      .replace('__I18N__', JSON.stringify(langs));
    /**
     * 检查 is Valid Secret 相关数据。
     * @param candidate - 需要与 Manager 密钥进行安全比较的候选值，类型为 `unknown`。
     * @returns `boolean`，表示 isValidSecret 检查是否通过。
     */
    const isValidSecret = (candidate: unknown): boolean => {
      if (typeof candidate !== 'string') {
        return false;
      }
      const expected = Buffer.from(this.loaded.manager.secret);
      const actual = Buffer.from(candidate);
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    };
    /**
     * 请求 request Secret 相关数据。
     * @param req - 当前收到或即将发送的请求对象，类型为 `express.Request<ParamsDictionary, any, any, QueryString.ParsedQs, Record<string, any>>`。
     * @returns `unknown`，requestSecret 请求返回的响应结果。
     */
    const requestSecret = (req: express.Request): unknown => req.headers.authorization?.replace(/^Bearer\s+/i, '');
    /**
     * 处理 authenticate 相关逻辑。
     * @param req - 当前收到或即将发送的请求对象，类型为 `express.Request<ParamsDictionary, any, any, QueryString.ParsedQs, Record<string, any>>`。
     * @param res - 用于返回处理结果的响应对象，类型为 `express.Response<any, Record<string, any>>`。
     * @returns `boolean`，表示 authenticate 检查是否通过。
     */
    const authenticate = (req: express.Request, res: express.Response): boolean => {
      if (isValidSecret(requestSecret(req))) {
        return true;
      }
      new Logger(`${time()}${__('serverAuthenticationRejected', req.method, req.path)}`);
      res.status(401).json({ error: 'Authentication required' });
      return false;
    };
    const updateManager = async (req: express.Request, res: express.Response): Promise<express.Response> => {
      if (!authenticate(req, res)) {
        return res;
      }
      try {
        new Logger(`${time()}${__('updateHelper')}`);
        const update = await scheduleUpdate({ currentVersion: this.version, proxy: raw.proxy, restart: true });
        this.coordinator.beginShutdown();
        const response = res.status(202).json({ status: 'scheduled', ...update });
        setImmediate(this.requestShutdown);
        return response;
      } catch (error) {
        const known = error instanceof UpdateInstallerError;
        let status = 500;
        if (known && ['UP_TO_DATE', 'ALREADY_SCHEDULED'].includes(error.code)) {
          status = 409;
        } else if (known && error.code === 'UNSUPPORTED_PLATFORM') {
          status = 422;
        } else if (known && ['ASSET_NOT_FOUND', 'UNVERIFIED_ASSET', 'INTEGRITY_MISMATCH'].includes(error.code)) {
          status = 502;
        }
        const message = error instanceof Error ? error.message : String(error);
        new Logger(`${time()}${__('updateFailed')}: ${message}`);
        return res.status(status).json({ error: message, code: known ? error.code : 'UPDATE_FAILED' });
      }
    };

    app.get('/', (_, res) => res.send(render(managerHtml)));
    app.get('/daily-quest', (_, res) => res.send(render(dailyQuestHtml)));
    app.get('/achievement', (_, res) => res.send(render(achievementHtml)));
    app.get('/operations', (_, res) => res.send(render(operationsHtml)));
    app.get('/settings', (_, res) => res.send(render(settingsHtml)));
    app.get('/js/template.yml', (_, res) => res.type('text/yaml').send(raw.language === 'en' ? templateYmlEN : templateYml));
    app.get('/api/health/live', (_, res) => res.json({ status: 'live', version: this.version }));
    app.get('/api/version/latest', async (_, res) => {
      try {
        const release = await getReleaseCheck(this.version, raw.proxy);
        return res.json({
          currentVersion: release.currentVersion,
          latestVersion: release.version,
          releaseUrl: release.releaseUrl,
          updateAvailable: release.updateAvailable
        });
      } catch (error) {
        new Logger(`${time()}Failed to check the latest version: ${error instanceof Error ? error.message : String(error)}`);
        return res.status(502).json({ error: 'Unable to check the latest version' });
      }
    });
    app.get('/api/health/ready', (_, res) => res.json({ status: 'ready', jobs: this.coordinator.states.list() }));
    app.get('/api/history', (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ runs: this.coordinator.history.list(), storageError: this.coordinator.history.storageError,
        failures: Object.fromEntries((['dailyQuest', 'achievement', 'artifact'] as const).map((name) => [name, this.coordinator.history.failures(name)])) });
    });
    app.get('/api/schedules', (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      return res.json({ schedules: this.scheduler?.list() || [] });
    });
    app.post('/api/schedules/preview', (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      try {
        if (typeof req.body?.cron !== 'string' || typeof req.body?.timezone !== 'string') {
          throw new Error('Cron and timezone are required');
        }
        return res.json({ nextRuns: Scheduler.preview(req.body.cron, req.body.timezone) });
      } catch (_error) {
        return res.status(400).json({ error: 'Invalid cron expression or timezone' });
      }
    });
    app.post('/api/diagnostics', async (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      if (this.coordinator.isClosing) {
        return res.status(503).json({ error: 'Manager is shutting down' });
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ checks: await this.diagnostics.run(structuredClone(raw)) });
    });
    app.get('/api/diagnostics/export', async (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      const logs = await Promise.all((['manager', 'dailyQuest', 'achievement', 'artifact'] as const).map(async (scope) => {
        try {
          const page = await readLogPage(getLogFilePath(scope));
          return { scope, text: formatLogValue(page.text, true), truncated: !!page.older };
        } catch (_error) {
          return { scope, text: 'Log unavailable' };
        }
      }));
      // Configuration values and filesystem paths are deliberately not part of the export.
      const bundle = { version: this.version, createdAt: new Date().toISOString(), node: process.version,
        platform: process.platform, arch: process.arch, timezone: this.loaded.manager.timezone,
        checks: this.diagnostics.snapshot(), runs: this.coordinator.history.list(50), logs };
      res.setHeader('Cache-Control', 'no-store');
      res.attachment('awa-diagnostics.json').type('application/json').send(formatLogValue(JSON.stringify(bundle, null, 2), true));
    });
    app.get('/api/jobs', (req, res) => authenticate(req, res) && res.json(this.coordinator.states.list()));
    app.get('/api/jobs/:name', (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      const state = this.coordinator.states.get(req.params.name as JobName);
      if (!state) {
        return res.status(404).json({ error: 'Unknown job' });
      }
      return res.json(state);
    });
    app.post('/api/jobs/:name/start', (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      try {
        const name = req.params.name as JobName;
        if (this.coordinator.isClosing) {
          return res.status(503).json({ error: 'Manager is shutting down' });
        }
        new Logger(`${time()}${__('serverJobStartRequested', name)}`);
        if (name === 'achievement') {
          fs.mkdirSync(path.join('data', 'achievement'), { recursive: true });
          fs.writeFileSync(path.join('data', 'achievement', 'enabled'), '');
        }
        void this.coordinator.start(name, req.body?.payload);
        res.status(202).json(this.coordinator.states.get(name));
      } catch (error) {
        new Logger(`${time()}${__('serverJobStartRejected', req.params.name)}`);
        res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
      }
    });
    app.post('/api/jobs/:name/stop', async (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      new Logger(`${time()}${__('serverJobStopRequested', req.params.name)}`);
      this.scheduler?.cancelPending(req.params.name as JobName);
      await this.coordinator.stop(req.params.name as JobName);
      if (req.params.name === 'achievement') {
        fs.rmSync(path.join('data', 'achievement', 'enabled'), { force: true });
      }
      res.json({ status: 'success' });
    });

    app.get('/api/config', (req, res) => authenticate(req, res) && res.type('text/yaml').send(fs.readFileSync(configPath, 'utf8')));
    app.put('/api/config', (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      const source = typeof req.body === 'string' ? req.body : req.body?.config;
      if (typeof source !== 'string' || !source.trim()) {
        return res.status(400).json({ error: 'config is required' });
      }
      try {
        validateYaml(source);
        const parsed = deepMerge(defaultConfig, parseYaml(source));
        const errors = validateHelperConfig(parsed);
        if (errors.length > 0) {
          return res.status(422).json({ errors });
        }
        atomicWriteFileSync(configPath, source);
        const { restartRequired } = this.reloadConfig();
        new Logger(`${time()}${__('serverConfigUpdated')}`);
        return res.json({ status: 'success', reloaded: true, restartRequired });
      } catch (error) {
        new Logger(`${time()}${__('serverConfigRejected', error instanceof Error ? error.name : __('unknownError'))}`);
        return res.status(422).json({ error: error instanceof Error ? error.message : String(error) });
      }
    });
    app.post('/api/cookies/awa', (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      if (typeof req.body?.cookie !== 'string' || !req.body.cookie.trim()) {
        return res.status(400).json({ error: 'cookie is required' });
      }
      updateYamlFieldsSync(configPath, { awaCookie: req.body.cookie, ...(req.body.userAgent ? { UA: req.body.userAgent } : {}) });
      this.reloadConfig();
      new Logger(`${time()}${__('serverAwaCredentialsUpdated')}`);
      return res.json({ status: 'success' });
    });
    app.post('/api/cookies/twitch', (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      if (typeof req.body?.cookie !== 'string' || !req.body.cookie.includes('auth-token=') || !req.body.cookie.includes('unique_id=')) {
        return res.status(422).json({ error: 'invalid Twitch cookie' });
      }
      updateYamlFieldsSync(configPath, { twitchCookie: req.body.cookie });
      this.reloadConfig();
      new Logger(`${time()}${__('serverTwitchCredentialsUpdated')}`);
      return res.json({ status: 'success' });
    });
    /**
     * 发送 send Logs 相关数据。
     * @param req - 当前收到或即将发送的请求对象，类型为 `express.Request<ParamsDictionary, any, any, QueryString.ParsedQs, Record<string, any>>`。
     * @param res - 用于返回处理结果的响应对象，类型为 `express.Response<any, Record<string, any>>`。
     * @param requestedJob - 需要注册、调度或查询的作业，类型为 `string | undefined`。
     * @returns `void | express.Response<any, Record<string, any>>`，sendLogs 请求返回的响应结果。
     */
    const sendLogs = (req: express.Request, res: express.Response, requestedJob?: string): express.Response | void => {
      if (!authenticate(req, res)) {
        return;
      }
      const candidate = requestedJob || req.params.job || 'manager';
      if (!isLogScope(candidate)) {
        return res.status(404).json({ error: 'Unknown log scope' });
      }
      const filename = getLogFilePath(candidate);
      const stream = fs.createReadStream(filename);
      res.type('text/plain');
      stream.once('error', (error: NodeJS.ErrnoException) => {
        if (!res.headersSent) {
          res.status(error.code === 'ENOENT' ? 200 : 500).end();
        } else {
          res.destroy();
        }
      });
      res.once('close', () => stream.destroy());
      stream.once('open', () => {
        if (res.destroyed) {
          stream.destroy(); return;
        }
        stream.pipe(res);
      });
      return res;
    };
    app.get('/api/logs/:job/page', async (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      if (!isLogScope(req.params.job)) {
        res.status(400).json({ error: 'Invalid log scope' }); return;
      }
      const { cursor } = req.query;
      if (cursor !== undefined && typeof cursor !== 'string') {
        res.status(400).json({ error: 'Invalid log cursor' }); return;
      }
      try {
        res.json(await readLogPage(getLogFilePath(req.params.job), cursor));
      } catch (error) {
        res.status(error instanceof Error && error.message === 'Invalid log cursor' ? 400 : 500).json({ error: 'Unable to read log page' });
      }
    });
    app.get('/api/logs', (req, res) => sendLogs(req, res));
    app.get('/api/logs/:job', (req, res) => sendLogs(req, res));
    app.post('/api/manager/shutdown', (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      new Logger(`${time()}${__('serverManagerShutdownRequested')}`);
      this.coordinator.beginShutdown();
      res.json({ status: 'success' });
      setImmediate(this.requestShutdown);
    });
    app.post('/api/manager/update', updateManager);

    // @ts-ignore express-ws 会在运行时扩展 Express。
    app.ws('/ws', (ws: WebSocket, req) => {
      const candidate = decodeManagerWebSocketSecret(req.headers['sec-websocket-protocol']);
      if (!isValidSecret(candidate)) {
        ws.close(1008, 'Authentication required');
        ws.terminate();
        return;
      }
      if (this.coordinator.isClosing || this.clients.size >= MAX_WS_CLIENTS) {
        ws.close(1013, 'Manager connection limit reached');
        ws.terminate();
        return;
      }
      const scope = new URL(req.url, 'http://localhost').searchParams.get('scope');
      if (scope && !isLogScope(scope)) {
        ws.close(1008, 'Invalid log scope');
        ws.terminate();
        return;
      }
      if (isLogScope(scope)) {
        subscribeWebUiScope(ws, scope);
      }
      this.clients.add(ws);
      globalThis.wsClients.add(ws);
      const replay = scope ? Object.fromEntries(Object.entries(globalThis.logs).filter(([key, value]) => key === 'type' || (typeof value === 'object' && value.scope === scope))) : globalThis.logs;
      if (new URL(req.url, 'http://localhost').searchParams.get('replay') === 'chunks') {
        startLogReplay(ws, Object.values(replay).filter((value): value is webLogEntry => typeof value === 'object'));
      } else {
        sendWebUiMessage(ws, JSON.stringify(replay));
      }
      const remove = (): void => {
        this.clients.delete(ws);
        this.awaitingPong.delete(ws);
        globalThis.wsClients.delete(ws);
      };
      ws.on('close', remove);
      ws.on('error', () => {
        remove(); ws.terminate();
      });
      ws.on('pong', () => this.awaitingPong.delete(ws));
    });

    this.server = server;
    const port = raw.webUI?.port || 2345;
    const host = getManagerListenHost(raw.webUI?.local, process.env.AWA_HELPER_CONTAINER === 'true');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
      server.listen(port, host);
    });
    this.heartbeat = setInterval(() => {
      this.clients.forEach((client) => {
        if (this.awaitingPong.has(client) || client.readyState !== 1) {
          globalThis.wsClients.delete(client);
          this.clients.delete(client);
          this.awaitingPong.delete(client);
          client.terminate();
          return;
        }
        this.awaitingPong.add(client);
        client.ping();
      });
    }, 30_000);
    this.heartbeat.unref();
    new Logger(`${time()}${__('serverListening', raw.webUI?.ssl?.cert ? 'https' : 'http', host, String(port))}`);
  }

  /**
   * 停止 stop 相关数据。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async stop(): Promise<void> {
    await this.diagnostics.stop();
    clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    this.revokeWebSocketSessions();
    const { server } = this;
    this.server = undefined;
    if (!server?.listening) {
      new Logger(`${time()}${__('serverStopSkipped')}`);
      return;
    }
    new Logger(`${time()}${__('serverStopping')}`);
    globalThis.wsClients.forEach((client) => {
      try {
        client.close(1001, 'Manager shutting down');
      } catch (_error) { /* A disconnected client needs no further cleanup. */ }
    });
    globalThis.wsClients.clear();
    await new Promise<void>((resolve) => {
      const deadline = setTimeout(() => server.closeAllConnections(), 5000);
      deadline.unref();
      server.close(() => {
        clearTimeout(deadline); resolve();
      });
    });
    new Logger(`${time()}${__('serverStopped')}`);
  }
}

export { UnifiedServer };
