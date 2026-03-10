/*
 * @Author       : HCLonely
 * @Date         : 2025-06-17 14:03:46
 * @LastEditTime : 2025-08-21 12:48:54
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/manager/index.ts
 * @Description  : 管理器
 */
/* global __ */
import * as express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as qs from 'qs';
import * as expressWs from 'express-ws';
import * as WebSocket from 'ws';
import { Logger, time } from './tool';
import * as chalk from 'chalk';
import * as https from 'https';
import { dirname, join, resolve } from 'path';
import * as i18n from 'i18n';
import * as yamlLint from 'yaml-lint';
import { parse } from 'yaml';
import { execSync, spawn } from 'child_process';
import * as dayjs from 'dayjs';
import * as minMax from 'dayjs/plugin/minMax';
import axios from 'axios';
import * as corn from 'node-cron';
import * as parser from 'cron-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Artifacts } from './Artifacts';
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
      port: 3456
    },
    awaHost: 'www.alienwarearena.com'
  };
  const configString = fs.readFileSync(configPath).toString();
  let config: config | null = null;
  await yamlLint
    .lint(configString)
    .then(() => {
      config = { ...defaultConfig, ...parse(configString) };
    })
    .catch((error) => {
      // eslint-disable-next-line max-len
      new Logger(time() + chalk.red(__('configFileErrorAlter', error.mark?.line ? chalk.blue(error.mark.line + 1) : '???', chalk.yellow(__('configFileErrorLocation')))));
      new Logger(error.message);
    });
  if (!config) {
    return;
  }
  const { language, managerServer, logsExpire, webUI, awaHost, pusher, proxy }: config = config;
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
        if (now.diff(filename.replace('.txt', '').replace('Manager-', ''), 'day') >= logsExpire) {
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
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.set('query parser', (str: string) => qs.parse(str));
    if (options?.key && options?.cert) {
      server = https.createServer(options, app);
    }

    expressWs(app, server);
    app.get('/', (_, res) => {
      res.send(indexHtml.replace('__LANG__', language)
        .replaceAll('__VERSION__', version)
        .replace('__I18N__', JSON.stringify(langs))).end();
    });
    app.get('/configer', (_, res) => {
      res.send(configerHtml).end();
    });
    app.get('/js/template.yml', (_, res) => {
      res.send(language === 'en' ? templateYmlEN : templateYml).end();
    });

    app.post('/getConfig', (req, res) => {
      if (req.body?.secret === managerServer.secret) {
        res.send(
          fs.readFileSync(configPath).toString()).end();
      }
      return res.status(401).end();
    });
    app.post('/setConfig', (req, res) => {
      if (req.body?.secret === managerServer.secret) {
        if (req.body?.config) {
          fs.writeFileSync(configPath, req.body.config);
        }
        res.status(200).end();
      }
      return res.status(401).end();
    });

    app.post('/updateCookie', (req, res) => {
      if (req.body?.secret === managerServer.secret) {
        if (req.body?.cookie) {
          let oldConfigStringRaw = fs.readFileSync(configPath).toString();
          if (req.headers['user-agent']) {
            const oldUA = oldConfigStringRaw.match(/^UA:.+/m)?.[0];
            if (oldUA) {
              oldConfigStringRaw = oldConfigStringRaw.replaceAll(oldUA, `UA: '${req.headers['user-agent']}'`);
            } else {
              oldConfigStringRaw = `${oldConfigStringRaw}\n\n` + `UA: '${req.headers['user-agent']}'`;
            }
          }
          const oldCookie = oldConfigStringRaw.match(/^awaCookie:.+/m)?.[0];
          if (!oldCookie) {
            return res.status(501).end();
          }
          const newConfigStringRaw = oldConfigStringRaw.replaceAll(oldCookie, `awaCookie: '${req.body.cookie}'`);
          fs.writeFileSync(configPath, newConfigStringRaw);
          new Logger(time() + __('cookieUpdated', chalk.yellow(req.ip)));
          return res.status(200).end();
        }
        return res.status(500).end();
      }
      return res.status(401).end();
    });

    app.post('/updateTwitchCookie', (req, res) => {
      if (req.body?.secret === managerServer.secret) {
        if (req.body?.cookie) {
          const oldConfigStringRaw = fs.readFileSync(configPath).toString();
          if (!req.body.cookie.includes('auth-token=') || !req.body.cookie.includes('unique_id=')) {
            return res.status(502).end();
          }
          const oldCookie = oldConfigStringRaw.match(/^twitchCookie:.+/m)?.[0];
          if (!oldCookie) {
            return res.status(501).end();
          }
          const newConfigStringRaw = oldConfigStringRaw.replaceAll(oldCookie, `twitchCookie: '${req.body.cookie}'`);
          fs.writeFileSync(configPath, newConfigStringRaw);
          new Logger(time() + __('twitchCookieUpdated', chalk.yellow(req.ip)));
          return res.status(200).end();
        }
        return res.status(500).end();
      }
      return res.status(401).end();
    });

    app.post('/runStatus', async (req, res) => {
      if (req.body?.secret === managerServer.secret) {
        // eslint-disable-next-line max-len
        const lastRunDate = dayjs.max(fs.readdirSync('logs').filter((e) => /^[\d]{4}-[\d]{2}-[\d]{2}.txt$/.test(e)).map((e) => dayjs(e.replace('.txt', ''))))?.format('YYYY-MM-DD');

        if (!lastRunDate) {
          res.json({ lastRunTime: 'Null', runStatus: 'Stop' }).status(200).end();
          return;
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
          res.json({ lastRunTime, runStatus, webui }).status(200).end();
        } else {
          res.json({ lastRunTime, runStatus }).status(200).end();
        }
      } else {
        res.status(401).end();
      }
    });

    app.post('/start', async (req, res) => {
      if (req.body?.secret === managerServer.secret) {
        new Logger(time() + __('startHelper'));
        if (['Windows_NT', 'Linux'].includes(os.type()) && !/.*main\.js$/.test(process.argv[1])) {
          const awaHelper = spawn('./AWA-Helper', ['--helper', '--color'], { detached: true, windowsHide: true, stdio: 'ignore' });
          awaHelper.unref();
        } else {
          const awaHelper = spawn('node', ['main.js', '--helper', '--color'], { detached: true, windowsHide: true, stdio: 'ignore' });
          awaHelper.unref();
        }
        res.send('success').status(200).end();
      } else {
        res.status(401).end();
      }
    });

    app.post('/stop', async (req, res) => {
      if (req.body?.secret === managerServer.secret) {
        new Logger(time() + __('stopHelper'));
        const pid = await getPid();
        if (pid) {
          try {
            if (os.type() === 'Windows_NT') {
              execSync(`taskkill -f -pid ${pid}`);
            } else {
              execSync(`kill ${pid}`);
            }
            res.send('success').status(200).end();
          } catch (e) {
            res.send('error').status(501).end();
          }
        } else {
          res.send('success').status(200).end();
        }
      } else {
        res.status(401).end();
      }
    });
    app.post('/stopManager', async (req, res) => {
      if (req.body?.secret === managerServer.secret) {
        new Logger(time() + __('stopManager'));
        process.exit(0);
        res.send('success').status(200).end();
      } else {
        res.status(401).end();
      }
    });
    app.post('/update', async (req, res) => {
      if (req.body?.secret === managerServer.secret) {
        new Logger(time() + __('updateHelper'));
        if (['Windows_NT', 'Linux'].includes(os.type()) && !/.*main\.js$/.test(process.argv[1])) {
          const awaHelper = spawn('./AWA-Helper', ['--update', '--color'], { detached: true, windowsHide: true, stdio: 'ignore' });
          awaHelper.unref();
        } else {
          const awaHelper = spawn('node', ['main.js', '--update', '--color'], { detached: true, windowsHide: true, stdio: 'ignore' });
          awaHelper.unref();
        }
        res.send('success').status(200).end();
      } else {
        res.status(401).end();
      }
    });
    app.get('/runLogs', async (req, res) => {
      if (req.query?.secret === managerServer.secret) {
        new Logger(time() + __('watchLogs'));
        if (fs.existsSync(`logs/${dayjs().format('YYYY-MM-DD')}.txt`)) {
          res.send(`<html><head><title>${__('log')}</title><link rel="shortcut icon"
    href="data:image/x-icon;base64,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" type="image/x-icon"></head><body style="width:100%;height:100%"><textarea style="width:100%;height:100%">${fs.readFileSync(`logs/${dayjs().format('YYYY-MM-DD')}.txt`).toString()}</textarea></body></html>`).status(200).end();
        } else {
          res.send('').status(200).end();
        }
      } else {
        res.status(401).end();
      }
    });

    app.get('/pid', async (_, res) => {
      res.send(`${process.pid}`).status(200).end();
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
          targetWs.send(data);
        });
        targetWs.on('message', (data) => {
          ws.send(data);
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
  const hostname = managerServer.local ? '127.0.0.1' : '0.0.0.0';
  server.listen(managerServer.port, hostname, () => {
    new Logger(time() + __('managerServerStart', chalk.yellow(`${managerServer.ssl?.cert ? 'https' : 'http'}://127.0.0.1:${managerServer.port}/`)));
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
        new Logger(time() + __('nextRunTime', chalk.blue(dayjs(parser.parseExpression(managerServer.corn as string).next().toString()).format('YYYY-MM-DD HH:mm:ss'))));
      });
      new Logger(`${time()}${chalk.green(__('cornEnabled'))}(${managerServer.corn})`);
      new Logger(time() + __('nextRunTime', chalk.blue(dayjs(parser.parseExpression(managerServer.corn).next().toString()).format('YYYY-MM-DD HH:mm:ss'))));
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
