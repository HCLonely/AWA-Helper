/*
 * @Author       : HCLonely
 * @Date         : 2025-06-17 14:03:46
 * @LastEditTime : 2026-03-18 20:56:10
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/manager/index.ts
 * @Description  : 管理器
 */
/* global __ */
import express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as qs from 'qs';
import expressWs from 'express-ws';
import WebSocket from 'ws';
import { Logger, time } from './tool';
import chalk from 'chalk';
import * as https from 'https';
import { dirname, join, resolve } from 'path';
import * as i18n from 'i18n';
import * as yamlLint from 'yaml-lint';
import { parse } from 'yaml';
import { execSync, spawn } from 'child_process';
import dayjs from 'dayjs';
import minMax from 'dayjs/plugin/minMax';
import axios from 'axios';
import * as crypto from 'crypto';
import * as corn from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Artifacts } from './Artifacts';
import { Archievement } from '../Archievement/Archievement';
import { atomicWriteFileSync, updateYamlFieldsSync, validateYaml } from '../core/config/yamlConfig';
import { deepMerge, validateHelperConfig } from '../core/config/configSchema';
import { getManagerListenHost } from './network';
// @ts-ignore
import indexHtml from './dist/index.html';
// @ts-ignore
import configerHtml from './dist/configer.html';
// @ts-ignore
import templateYml from './static/js/template.yml';
// @ts-ignore
import templateYmlEN from './static/js/template_en.yml';
// @ts-ignore
import * as zh from '../locales/zh.json';
// @ts-ignore
import * as en from '../locales/en.json';
interface pusher {
  enable: boolean
  platform: string
  key: {
    [name: string]: any
  }
  options?: {
    [name: string]: any
  }
}
interface config {
  language: string
  logsExpire: number
  managerServer?: {
    enable: boolean
    secret: string
    local?: boolean
    port: number
    ssl?: {
      key?: string
      cert?: string
    }
    corn?: string
    artifacts: Array<{
      corn: string
      ids: string
    }>
  }
  webUI: {
    enable: boolean
    port: number
    local?: boolean
    reverseProxyPort?: number
    ssl?: {
      key?: string
      cert?: string
    }
  }
  awaHost: string,
  awaCookie?: string,
  twitchCookie?: string,
  UA?: string,
  pusher?: pusher,
  proxy?: {
    enable: Array<string>
    host: string
    port: number
    protocol?: string
    username?: string
    password?: string
  }
}
const startManager = async (startHelper: boolean) => {
  const version = 'V__VERSION__';
  const logArr = '  ______   __       __   ______           __       __\n /      \\ /  |  _  /  | /      \\         /  \\     /  |\n/$$$$$$  |$$ | / \\ $$ |/$$$$$$  |        $$  \\   /$$ |  ______   _______    ______    ______    ______    ______\n$$ |__$$ |$$ |/$  \\$$ |$$ |__$$ | ______ $$$  \\ /$$$ | /      \\ /       \\  /      \\  /      \\  /      \\  /      \\\n$$    $$ |$$ /$$$  $$ |$$    $$ |/      |$$$$  /$$$$ | $$$$$$  |$$$$$$$  | $$$$$$  |/$$$$$$  |/$$$$$$  |/$$$$$$  |\n$$$$$$$$ |$$ $$/$$ $$ |$$$$$$$$ |$$$$$$/ $$ $$ $$/$$ | /    $$ |$$ |  $$ | /    $$ |$$ |  $$ |$$    $$ |$$ |  $$/\n$$ |  $$ |$$$$/  $$$$ |$$ |  $$ |        $$ |$$$/ $$ |/$$$$$$$ |$$ |  $$ |/$$$$$$$ |$$ \\__$$ |$$$$$$$$/ $$ |\n$$ |  $$ |$$$/    $$$ |$$ |  $$ |        $$ | $/  $$ |$$    $$ |$$ |  $$ |$$    $$ |$$    $$ |$$       |$$ |\n$$/   $$/ $$/      $$/ $$/   $$/         $$/      $$/  $$$$$$$/ $$/   $$/  $$$$$$$/  $$$$$$$ | $$$$$$$/ $$/\n                                                                                    /  \\__$$ |\n                                                                                    $$    $$/\n                                                                                     $$$$$$/         by HCLonely '.split('\n');
  logArr[logArr.length - 2] = `${logArr[logArr.length - 2]}        ${version}`;
  new Logger(logArr.join('\n'));
  new Logger(chalk.red.bold('\n* 重要提示：后台挂机可能导致COD封号，游玩COD时请关闭本程序！！！\n\n* Important: Running this program at the same time as COD may result in a COD account ban. Please close this program when playing COD !!!\n'));

  dayjs.extend(minMax);
  i18n.configure({
    locales: ['zh', 'en'],
    staticCatalog: {
      zh,
      en
    },
    defaultLocale: 'zh',
    register: globalThis
  });
  globalThis.webUI = false;
  let configPath = 'config.yml';
  if (/dist$/.test(process.cwd()) || /output$/.test(process.cwd())) {
    if (!fs.existsSync(configPath) && fs.existsSync(join('../', configPath))) {
      configPath = join('../', configPath);
    }
  }
  if (!fs.existsSync(configPath)) {
    configPath = 'config/config.yml';
    if (/dist$/.test(process.cwd()) || /output$/.test(process.cwd())) {
      if (!fs.existsSync(configPath) && fs.existsSync(join('../', configPath))) {
        configPath = join('../', configPath);
      }
    }
  }
  if (!fs.existsSync(configPath)) {
    new Logger(chalk.red(`${__('configFileNotFound')}[${chalk.yellow(resolve(configPath))}]!`));
    return;
  }

  const defaultConfig: config = {
    language: 'zh',
    logsExpire: 30,
    managerServer: {
      enable: true,
      secret: '',
      local: true,
      port: 2345,
      artifacts: []
    },
    webUI: {
      enable: true,
      port: 3456,
      local: true
    },
    awaHost: 'www.alienwarearena.com'
  };
  const configString = fs.readFileSync(configPath).toString();
  let config: config | null = null;
  await yamlLint
    .lint(configString)
    .then(() => {
      const parsedConfig = deepMerge(defaultConfig, parse(configString));
      const validationErrors = validateHelperConfig(parsedConfig);
      if (validationErrors.length > 0) {
        throw new Error(`Invalid configuration: ${validationErrors.join('; ')}`);
      }
      config = parsedConfig;
    })
    .catch((error) => {
      new Logger(time() + chalk.red(__('configFileErrorAlter', error.mark?.line ? chalk.blue(error.mark.line + 1) : '???', chalk.yellow(__('configFileErrorLocation')))));
      new Logger(error.message);
    });
  if (!config) {
    return;
  }
  const { language, managerServer, logsExpire, webUI, awaHost, pusher, proxy, awaCookie, twitchCookie, UA }: config = config;
  i18n.setLocale(language);
  globalThis.awaHost = awaHost || 'www.alienwarearena.com';
  globalThis.pusher = pusher;
  if (pusher?.enable && proxy?.enable?.includes('pusher')) {
    globalThis.pusherProxy = proxy;
  }

  if (fs.existsSync('logs')) {
    const logFiles = fs.readdirSync('logs');
    if (logsExpire && logsExpire < logFiles.length) {
      const logger = new Logger(`${time()}${__('clearingLogs')}`, false);
      const now = dayjs();
      logFiles.forEach((filename) => {
        if (now.diff(filename.replace('.txt', '').replace('Manager-', '').replace('Archievement-', ''), 'day') >= logsExpire) {
          fs.unlinkSync(join('logs', filename));
        }
      });
      logger.log(chalk.green('OK'));
    }
  }
  if (managerServer?.enable !== true) {
    new Logger(time() + chalk.red(__('managerServerNotConfig')));
    return;
  }
  if (!managerServer?.secret) {
    new Logger(time() + chalk.red(__('managerServerSecretNotSet')));
    return;
  }
  if (managerServer.secret.length < 16) {
    new Logger(time() + chalk.red('managerServer.secret must contain at least 16 characters.'));
    return;
  }
  if (!Array.prototype.findLast) {
    Array.prototype.findLast = function (callback) {
      if (this === null) {
        throw new TypeError('this is null or not defined');
      }
      const arr = Object(this);
      const len = arr.length >>> 0;
      for (let i = len - 1; i >= 0; i--) {
        if (callback(arr[i], i, arr)) {
          return arr[i];
        }
      }
      return undefined;
    };
  }

  const langs: {
    [name: string]: string
  } = {
    zh,
    en
  };

  const createServer = (options?: { key: Buffer, cert: Buffer }) => {
    let server;
    let archievement: Archievement | null = null;
    let archievementCorn: corn.ScheduledTask | null = null;
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
    app.set('query parser', (str: string) => qs.parse(str));
    const isValidSecret = (candidate: unknown): boolean => {
      if (typeof candidate !== 'string') return false;
      const actual = Buffer.from(managerServer.secret);
      const provided = Buffer.from(candidate);
      return actual.length === provided.length && crypto.timingSafeEqual(actual, provided);
    };
    if (options?.key && options?.cert) {
      server = https.createServer(options, app);
    }

    if (awaCookie && fs.existsSync('data/Archievement')) {
      archievementCorn = corn.schedule('0 14 * * *', async () => {
        new Logger(time() + __('startArchievement'));
        if (archievement) {
          archievement.destroy();
          archievement = null;
        }

        archievement = new Archievement({
          awaCookie,
          proxy,
          awaHost,
          twitchCookie,
          userAgent: UA
        });
        await archievement.init();
        archievement.run();

        new Logger(time() + __('nextArchievementRestart', chalk.blue(dayjs(CronExpressionParser.parse('0 14 * * *').next().toString()).format('YYYY-MM-DD HH:mm:ss'))));
      });

      archievement = new Archievement({
        awaCookie,
        proxy,
        awaHost,
        twitchCookie,
        userAgent: UA
      });
      archievement.init().then(() => {
        archievement?.run();
      });
    }

    expressWs(app, server);
    app.get('/', (_, res) => {
      let htmlContext = indexHtml.replace('__LANG__', language)
        .replaceAll('__VERSION__', version)
        .replace('__I18N__', JSON.stringify(langs));
      if (archievementCorn) {
        htmlContext = htmlContext
          .replace('class="btn btn-success btn-custom awa-archievement-start"', 'class="btn btn-success btn-custom awa-archievement-start disabled"')
          .replace('class="btn btn-danger btn-custom awa-archievement-stop disabled"', 'class="btn btn-danger btn-custom awa-archievement-stop"');
      }
      res.send(htmlContext).end();
    });
    app.get('/configer', (_, res) => {
      res.send(configerHtml).end();
    });
    app.get('/js/template.yml', (_, res) => {
      res.send(language === 'en' ? templateYmlEN : templateYml).end();
    });

    app.post('/getConfig', (req, res) => {
      if (!isValidSecret(req.body?.secret)) {
        return res.status(401).end();
      }
      return res.type('text/yaml').status(200).send(fs.readFileSync(configPath).toString());
    });
    app.post('/setConfig', (req, res) => {
      if (!isValidSecret(req.body?.secret)) {
        return res.status(401).end();
      }
      if (typeof req.body?.config !== 'string' || !req.body.config.trim()) {
        return res.status(400).end();
      }
      try {
        validateYaml(req.body.config);
        atomicWriteFileSync(configPath, req.body.config);
      } catch (_error) {
        return res.status(422).end();
      }
      return res.status(200).end();
    });

    app.post(['/api/cookies/awa', '/updateCookie'], (req, res) => {
      if (isValidSecret(req.body?.secret)) {
        if (typeof req.body?.cookie === 'string' && req.body.cookie.trim()) {
          const fields: Record<string, string> = { awaCookie: req.body.cookie };
          const userAgent = typeof req.body?.userAgent === 'string'
            ? req.body.userAgent
            : req.headers['user-agent'];
          if (userAgent && userAgent.length <= 1024) {
            fields.UA = userAgent;
          }
          updateYamlFieldsSync(configPath, fields);
          new Logger(time() + __('cookieUpdated', chalk.yellow(req.ip)));
          return res.status(200).json({ status: 'success' });
        }
        return res.status(400).json({ error: 'cookie is required' });
      }
      return res.status(401).end();
    });

    app.post(['/api/cookies/twitch', '/updateTwitchCookie'], (req, res) => {
      if (isValidSecret(req.body?.secret)) {
        if (typeof req.body?.cookie === 'string' && req.body.cookie.trim()) {
          if (!req.body.cookie.includes('auth-token=') || !req.body.cookie.includes('unique_id=')) {
            return res.status(422).json({ error: 'invalid Twitch cookie' });
          }
          updateYamlFieldsSync(configPath, { twitchCookie: req.body.cookie });
          new Logger(time() + __('twitchCookieUpdated', chalk.yellow(req.ip)));
          return res.status(200).json({ status: 'success' });
        }
        return res.status(400).json({ error: 'cookie is required' });
      }
      return res.status(401).end();
    });

    app.post('/runStatus', async (req, res) => {
      if (isValidSecret(req.body?.secret)) {
        const lastRunDate = dayjs.max(fs.readdirSync('logs').filter((e) => /^[\d]{4}-[\d]{2}-[\d]{2}.txt$/.test(e)).map((e) => dayjs(e.replace('.txt', ''))))?.format('YYYY-MM-DD');

        if (!lastRunDate) {
          return res.status(200).json({ lastRunTime: 'Null', runStatus: 'Stop' });
        }
        const lastRunTime = fs.readFileSync(`logs/${lastRunDate}.txt`).toString().split('\n')
          .filter((e) => e.trim())
          .findLast((e) => /^\[[\d]{4}-[\d]{2}-[\d]{2} [\d]{2}:[\d]{2}:[\d]{2}\] [^c][^o][^o][^k][^i][^e]/.test(e))
          ?.match(/^\[([\d]{4}-[\d]{2}-[\d]{2} [\d]{2}:[\d]{2}:[\d]{2})\]/)?.[1];

        const pid = await getPid();

        let runStatus = 'Stop';
        if (pid) {
          runStatus = 'Running';
        }

        const webui = {
          port: webUI.reverseProxyPort || webUI.port,
          ssl: !!webUI.ssl?.cert
        };

        if (runStatus === 'Running') {
          return res.status(200).json({ lastRunTime, runStatus, webui });
        }
        return res.status(200).json({ lastRunTime, runStatus });
      }
      return res.status(401).end();
    });

    app.post('/start', async (req, res) => {
      if (isValidSecret(req.body?.secret)) {
        new Logger(time() + __('startHelper'));
        if (['Windows_NT', 'Linux'].includes(os.type()) && !/.*main\.js$/.test(process.argv[1])) {
          const awaHelper = spawn('./AWA-Helper', ['--helper', '--color'], { detached: true, windowsHide: true, stdio: 'ignore' });
          awaHelper.unref();
        } else {
          const awaHelper = spawn('node', ['main.js', '--helper', '--color'], { detached: true, windowsHide: true, stdio: 'ignore' });
          awaHelper.unref();
        }
        return res.status(200).send('success');
      }
      return res.status(401).end();
    });

    app.post('/stop', async (req, res) => {
      if (isValidSecret(req.body?.secret)) {
        new Logger(time() + __('stopHelper'));
        const pid = await getPid();
        if (pid) {
          try {
            if (os.type() === 'Windows_NT') {
              execSync(`taskkill -f -pid ${pid}`);
            } else {
              execSync(`kill ${pid}`);
            }
            return res.status(200).send('success');
          } catch (_e) {
            return res.status(500).send('error');
          }
        } else {
          return res.status(200).send('success');
        }
      } else {
        return res.status(401).end();
      }
    });
    app.post('/stopManager', async (req, res) => {
      if (isValidSecret(req.body?.secret)) {
        new Logger(time() + __('stopManager'));
        res.status(200).send('success');
        setImmediate(() => process.exit(0));
      } else {
        res.status(401).end();
      }
    });
    app.post('/update', async (req, res) => {
      if (isValidSecret(req.body?.secret)) {
        new Logger(time() + __('updateHelper'));
        return res.status(501).send('Automatic installation is disabled; install a signed release manually.');
      }
      return res.status(401).end();
    });
    app.post('/runLogs', async (req, res) => {
      if (isValidSecret(req.body?.secret)) {
        new Logger(time() + __('watchLogs'));
        if (fs.existsSync(`logs/${dayjs().format('YYYY-MM-DD')}.txt`)) {
          return res.status(200).set('Content-Type', 'text/plain; charset=utf-8').send(fs.readFileSync(`logs/${dayjs().format('YYYY-MM-DD')}.txt`, 'utf8'));
        }
        return res.status(200).set('Content-Type', 'text/plain; charset=utf-8').send('');
      }
      return res.status(401).end();
    });
    app.post('/awaArchievementLogs', async (req, res) => {
      if (isValidSecret(req.body?.secret)) {
        new Logger(time() + __('watchLogs'));
        if (fs.existsSync(`logs/Archievement-${dayjs().format('YYYY-MM-DD')}.txt`)) {
          return res.status(200).set('Content-Type', 'text/plain; charset=utf-8').send(fs.readFileSync(`logs/Archievement-${dayjs().format('YYYY-MM-DD')}.txt`, 'utf8'));
        }
        return res.status(200).set('Content-Type', 'text/plain; charset=utf-8').send('');
      }
      return res.status(401).end();
    });

    app.get('/health/live', async (_, res) => {
      res.status(200).json({ status: 'live', version });
    });
    app.post('/startArchievement', async (req, res) => {
      if (isValidSecret(req.body?.secret)) {
        if (!awaCookie) {
          return res.status(400).send('awaCookie is not set');
        }
        if (!fs.existsSync('data')) {
          fs.mkdirSync('data');
        }
        fs.writeFileSync('data/Archievement', '');

        archievementCorn = corn.schedule('0 14 * * *', async () => {
          new Logger(time() + __('startArchievement'));
          if (archievement) {
            archievement.destroy();
            archievement = null;
          }

          archievement = new Archievement({
            awaCookie,
            proxy,
            awaHost,
            twitchCookie,
            userAgent: UA
          });
          await archievement.init();
          archievement.run();

          new Logger(time() + __('nextArchievementRestart', chalk.blue(dayjs(CronExpressionParser.parse('0 14 * * *').next().toString()).format('YYYY-MM-DD HH:mm:ss'))));
        });

        if (archievement) {
          archievement.destroy();
          archievement = null;
        }

        archievement = new Archievement({
          awaCookie,
          proxy,
          awaHost,
          twitchCookie,
          userAgent: UA
        });
        await archievement.init();
        archievement.run();
        return res.status(200).send('success');
      }
      return res.status(401).end();
    });
    app.post('/stopArchievement', async (req, res) => {
      if (isValidSecret(req.body?.secret)) {
        if (fs.existsSync('data/Archievement')) {
          fs.rmSync('data/Archievement');
        }
        archievement?.destroy();
        archievement = null;
        archievementCorn?.stop();
        archievementCorn = null;
        return res.status(200).send('success');
      }
      return res.status(401).end();
    });

    if (webUI.enable) {
      app.use('/awa-helper', createProxyMiddleware({
        target: `http://127.0.0.1:${webUI.port}`,
        changeOrigin: true
      }));
      const targetUrl = `ws://127.0.0.1:${webUI.port}/ws`;
      // @ts-ignore
      app.ws('/ws', (ws: WebSocket) => {
        const targetWs = new WebSocket(targetUrl);
        ws.on('message', (data) => {
          targetWs.send(typeof data === 'string' ? data : data.toString());
        });
        targetWs.on('message', (data) => {
          ws.send(typeof data === 'string' ? data : data.toString());
        });
        ws.on('close', () => {
          targetWs.close();
        });
        targetWs.on('close', () => {
          ws.close();
        });
      });
    }

    return server || app;
  };

  let options: undefined | {
    key: Buffer,
    cert: Buffer
  } = undefined;
  if (managerServer.ssl?.key && managerServer.ssl.cert) {
    const keyPath = join(dirname(configPath), managerServer.ssl.key);
    const certPath = join(dirname(configPath), managerServer.ssl.cert);
    if (!fs.existsSync(keyPath)) {
      new Logger(time() + chalk.yellow(__('missingSSLKey')));
      return;
    }
    if (!fs.existsSync(certPath)) {
      new Logger(time() + chalk.yellow(__('missingSSLCert')));
      return;
    }
    options = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  }
  const server = createServer(options);
  const containerRuntime = process.env.AWA_HELPER_CONTAINER === 'true' || (process.platform === 'linux' && fs.existsSync('/.dockerenv'));
  const hostname = getManagerListenHost(managerServer.local, containerRuntime);
  server.listen(managerServer.port, hostname, () => {
    new Logger(time() + __('managerServerStart', chalk.yellow(`${managerServer.ssl?.cert ? 'https' : 'http'}://127.0.0.1:${managerServer.port}/`)));
    if (managerServer.local && containerRuntime) {
      new Logger(time() + chalk.yellow(`Container mode: Manager is listening on 0.0.0.0:${managerServer.port} for port forwarding.`));
    }
    if (!managerServer.local) new Logger(time() + __('publicNetworkNotice', `${managerServer.port}`));
  });

  // corn
  if (managerServer.corn) {
    if (corn.validate(managerServer.corn)) {
      corn.schedule(managerServer.corn, () => {
        new Logger(time() + __('startHelper'));
        if (['Windows_NT', 'Linux'].includes(os.type()) && !/.*main\.js$/.test(process.argv[1])) {
          const awaHelper = spawn('./AWA-Helper', ['--helper', '--color'], { detached: true, windowsHide: true, stdio: 'ignore' });
          awaHelper.unref();
        } else {
          const awaHelper = spawn('node', ['main.js', '--helper', '--color'], { detached: true, windowsHide: true, stdio: 'ignore' });
          awaHelper.unref();
        }
        new Logger(time() + __('nextRunTime', chalk.blue(dayjs(CronExpressionParser.parse(managerServer.corn as string).next().toString()).format('YYYY-MM-DD HH:mm:ss'))));
      });
      new Logger(`${time()}${chalk.green(__('cornEnabled'))}(${managerServer.corn})`);
      new Logger(time() + __('nextRunTime', chalk.blue(dayjs(CronExpressionParser.parse(managerServer.corn).next().toString()).format('YYYY-MM-DD HH:mm:ss'))));
    } else {
      new Logger(`${time()}${chalk.red(__('cornError'))}(${managerServer.corn})`);
    }
  }
  if (managerServer.artifacts && managerServer.artifacts.length > 0) {
    managerServer.artifacts.forEach((option) => {
      if (corn.validate(option.corn)) {
        corn.schedule(option.corn, async () => {
          new Logger(time() + __('changeArtifacts'));
          const artifacts = new Artifacts(configPath);
          if (!artifacts.initted) {
            return;
          }
          const initResult = await artifacts.init();
          if (initResult !== 200) {
            const errorMap = {
              0: __('netError'),
              602: __('tokenExpired'),
              603: __('noBorderAndBadges'),
              604: __('noBorder'),
              605: __('noBadges'),
              610: __('ipBanned')
            };
            const initError = errorMap[initResult as keyof typeof errorMap] || __('unknownError');
            new Logger(time() + __('changeArtifactsFailed') + chalk.red(initError));
            return;
          }
          await artifacts.start(option.ids.split(',').map((e) => parseInt(e.trim(), 10)));
        });
        new Logger(`${time()}${chalk.green(__('artifactCornEnabled'))}(${option.corn})`);
      } else {
        new Logger(`${time()}${chalk.red(__('cornError'))}(${option.corn})`);
      }
    });
  }

  // 更新后首次启动
  if (startHelper) {
    new Logger(time() + __('startHelper'));
    if (['Windows_NT', 'Linux'].includes(os.type()) && !/.*main\.js$/.test(process.argv[1])) {
      const awaHelper = spawn('./AWA-Helper', ['--helper', '--color', '--no-update'], { detached: true, windowsHide: true, stdio: 'ignore' });
      awaHelper.unref();
    } else {
      const awaHelper = spawn('node', ['main.js', '--helper', '--color', '--no-update'], { detached: true, windowsHide: true, stdio: 'ignore' });
      awaHelper.unref();
    }
  }

  async function getPid() {
    const pidRaw = await axios.get(`${webUI.ssl?.cert ? 'https' : 'http'}://127.0.0.1:${webUI.port}/run-status`)
      .then((response) => response.data)
      .catch(() => '0');
    return parseInt(pidRaw, 10);
  }
};

export { startManager };
