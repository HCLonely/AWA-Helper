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
import { deepMerge, validateHelperConfig } from '../tools/config/ConfigSchema';
import type { LoadedConfig } from '../tools/config/types';
import type { JobName } from '../core/Manager/Job';
import type { JobCoordinator } from '../core/Manager/JobCoordinator';
import { decodeManagerWebSocketSecret } from './websocket/authenticate';
import { getManagerListenHost } from './network';
import { getLogFilePath, isLogScope, Logger } from '../tools/logging';
import { time } from '../tools/common';
import { getLatestVersion, isNewVersion } from '../tools/update';
// @ts-ignore 由构建流程以内联文本形式提供。
import managerHtml from '../webUI/dist/index.html';
// @ts-ignore 由构建流程以内联文本形式提供。
import dailyQuestHtml from '../webUI/dist/dailyQuest.html';
// @ts-ignore 由构建流程以内联文本形式提供。
import achievementHtml from '../webUI/dist/achievement.html';
// @ts-ignore 由构建流程以内联文本形式提供。
import settingsHtml from '../webUI/dist/settings.html';
// @ts-ignore 由构建流程以内联文本形式提供。
import templateYml from '../webUI/static/templates/config.zh.yml';
// @ts-ignore 由构建流程以内联文本形式提供。
import templateYmlEN from '../webUI/static/templates/config.en.yml';
// @ts-ignore 由构建流程生成本地化资源。
import * as zh from '../locales/zh.json';
// @ts-ignore 由构建流程生成本地化资源。
import * as en from '../locales/en.json';

class UnifiedServer {
  private server?: Server;

  /**
   * 初始化 Unified Server 实例。
   * @param loaded - 已经加载并通过校验的应用配置，类型为 `LoadedConfig`。
   * @param coordinator - 负责协调作业启动与停止的协调器，类型为 `JobCoordinator`。
   * @param version - 用于比较或展示的应用版本号，类型为 `string`。
   * @param requestShutdown - 请求应用安全关闭的回调函数，类型为 `() => void`。
   */
  constructor(
    private readonly loaded: LoadedConfig,
    private readonly coordinator: JobCoordinator,
    private readonly version: string,
    private readonly requestShutdown: () => void
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
    const requestSecret = (req: express.Request): unknown => req.body?.secret ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '');
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

    app.get('/', (_, res) => res.send(render(managerHtml)));
    app.get(['/daily-quest', '/dailyQuest', '/awa-helper'], (_, res) => res.send(render(dailyQuestHtml)));
    app.get('/achievement', (_, res) => res.send(render(achievementHtml)));
    app.get(['/settings', '/configer'], (_, res) => res.send(settingsHtml));
    app.get('/js/template.yml', (_, res) => res.type('text/yaml').send(raw.language === 'en' ? templateYmlEN : templateYml));
    app.get(['/health/live', '/api/health/live'], (_, res) => res.json({ status: 'live', version: this.version }));
    app.get('/api/version/latest', async (_, res) => {
      try {
        const latestVersion = await getLatestVersion(raw.proxy);
        if (!latestVersion) {
          return res.status(502).json({ error: 'Unable to determine the latest version' });
        }
        return res.json({
          currentVersion: this.version,
          latestVersion,
          updateAvailable: isNewVersion(this.version, latestVersion)
        });
      } catch (error) {
        new Logger(`${time()}Failed to check the latest version: ${error instanceof Error ? error.message : String(error)}`);
        return res.status(502).json({ error: 'Unable to check the latest version' });
      }
    });
    app.get('/api/health/ready', (_, res) => res.json({ status: 'ready', jobs: this.coordinator.states.list() }));
    app.get('/run-status', (req, res) => {
      const remote = req.socket.remoteAddress || '';
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) {
        return res.status(404).end();
      }
      return res.send(String(process.pid));
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
        new Logger(`${time()}${__('serverJobStartRequested', name)}`);
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
      await this.coordinator.stop(req.params.name as JobName);
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
        const parsed = deepMerge(this.loaded.raw, parseYaml(source));
        const errors = validateHelperConfig(parsed);
        if (errors.length > 0) {
          return res.status(422).json({ errors });
        }
        atomicWriteFileSync(configPath, source);
        new Logger(`${time()}${__('serverConfigUpdated')}`);
        return res.json({ status: 'success', restartRequired: true });
      } catch (error) {
        new Logger(`${time()}${__('serverConfigRejected', error instanceof Error ? error.name : __('unknownError'))}`);
        return res.status(422).json({ error: error instanceof Error ? error.message : String(error) });
      }
    });
    app.post(['/api/cookies/awa', '/updateCookie'], (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      if (typeof req.body?.cookie !== 'string' || !req.body.cookie.trim()) {
        return res.status(400).json({ error: 'cookie is required' });
      }
      updateYamlFieldsSync(configPath, { awaCookie: req.body.cookie, ...(req.body.userAgent ? { UA: req.body.userAgent } : {}) });
      new Logger(`${time()}${__('serverAwaCredentialsUpdated')}`);
      return res.json({ status: 'success' });
    });
    app.post(['/api/cookies/twitch', '/updateTwitchCookie'], (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      if (typeof req.body?.cookie !== 'string' || !req.body.cookie.includes('auth-token=') || !req.body.cookie.includes('unique_id=')) {
        return res.status(422).json({ error: 'invalid Twitch cookie' });
      }
      updateYamlFieldsSync(configPath, { twitchCookie: req.body.cookie });
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
      return res.type('text/plain').send(fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : '');
    };
    app.get('/api/logs', (req, res) => sendLogs(req, res));
    app.get('/api/logs/:job', (req, res) => sendLogs(req, res));
    app.post('/runLogs', (req, res) => {
      sendLogs(req, res, 'dailyQuest');
    });
    app.post('/awaAchievementLogs', (req, res) => {
      sendLogs(req, res, 'achievement');
    });
    app.post('/api/manager/shutdown', (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      new Logger(`${time()}${__('serverManagerShutdownRequested')}`);
      res.json({ status: 'success' });
      setImmediate(this.requestShutdown);
    });

    // Legacy API aliases retained for one compatibility cycle.
    app.post('/start', async (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      new Logger(`${time()}${__('serverLegacyDailyQuestStart')}`);
      void this.coordinator.start('dailyQuest');
      res.send('success');
    });
    app.post('/stop', async (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      new Logger(`${time()}${__('serverLegacyDailyQuestStop')}`);
      await this.coordinator.stop('dailyQuest');
      res.send('success');
    });
    app.post('/startAchievement', async (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      new Logger(`${time()}${__('serverLegacyAchievementStart')}`);
      fs.mkdirSync(path.join('data', 'achievement'), { recursive: true });
      fs.writeFileSync(path.join('data', 'achievement', 'enabled'), '');
      void this.coordinator.start('achievement');
      res.send('success');
    });
    app.post('/stopAchievement', async (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      new Logger(`${time()}${__('serverLegacyAchievementStop')}`);
      await this.coordinator.stop('achievement');
      fs.rmSync(path.join('data', 'achievement', 'enabled'), { force: true });
      res.send('success');
    });
    app.post('/runStatus', (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      const state = this.coordinator.states.get('dailyQuest');
      return res.json({
        runStatus: ['running', 'stopping'].includes(state?.status || '') ? 'Running' : 'Stop',
        lastRunTime: state?.startedAt || '',
        webui: { port: raw.webUI?.port || 2345, ssl: !!raw.webUI?.ssl?.cert }
      });
    });
    app.post('/update', (req, res) => authenticate(req, res) && res.status(501).send('Automatic installation is disabled; install a signed release manually.'));
    app.post('/stopManager', (req, res) => {
      if (!authenticate(req, res)) {
        return;
      }
      new Logger(`${time()}${__('serverLegacyManagerShutdown')}`);
      res.send('success');
      setImmediate(this.requestShutdown);
    });

    // @ts-ignore express-ws 会在运行时扩展 Express。
    app.ws('/ws', (ws: WebSocket, req) => {
      const candidate = decodeManagerWebSocketSecret(req.headers['sec-websocket-protocol']);
      if (!isValidSecret(candidate)) {
        return ws.close(1008, 'Authentication required');
      }
      globalThis.wsClients.add(ws);
      ws.send(JSON.stringify(globalThis.logs));
      ws.on('close', () => globalThis.wsClients.delete(ws));
      ws.on('error', () => globalThis.wsClients.delete(ws));
    });

    this.server = server;
    const port = raw.webUI?.port || 2345;
    const host = getManagerListenHost(raw.webUI?.local, process.env.AWA_HELPER_CONTAINER === 'true');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
      server.listen(port, host);
    });
    new Logger(`${time()}${__('serverListening', raw.webUI?.ssl?.cert ? 'https' : 'http', host, String(port))}`);
  }

  /**
   * 停止 stop 相关数据。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async stop(): Promise<void> {
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
    new Logger(`${time()}${__('serverStopped')}`);
  }
}

export { UnifiedServer };
