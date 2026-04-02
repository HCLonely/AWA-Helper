/*
 * @Author       : HCLonely
 * @Date         : 2025-06-17 14:03:46
 * @LastEditTime : 2026-03-18 20:56:10
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
import { Archievement } from '../Archievement/Archievement';
// @ts-ignore
import indexHtml from './dist/index.html';
// @ts-ignore
import configerHtml from './dist/configer.html';
// @ts-ignore
import templateYml from './static/js/template.yml';
// @ts-ignore
import templateYmlEN from './static/js/template_en.yml';
// @ts-ignore
import icon from './static/img/icon.ico';

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
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.set('query parser', (str: string) => qs.parse(str));
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

        new Logger(time() + __('nextArchievementRestart', chalk.blue(dayjs(parser.parseExpression('0 14 * * *').next().toString()).format('YYYY-MM-DD HH:mm:ss'))));
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
    href="${icon}" type="image/x-icon"></head><body style="width:100%;height:100%"><textarea style="width:100%;height:100%">${fs.readFileSync(`logs/${dayjs().format('YYYY-MM-DD')}.txt`).toString()}</textarea></body></html>`).status(200).end();
        } else {
          res.send('').status(200).end();
        }
      } else {
        res.status(401).end();
      }
    });
    app.get('/awaArchievementLogs', async (req, res) => {
      if (req.query?.secret === managerServer.secret) {
        new Logger(time() + __('watchLogs'));
        if (fs.existsSync(`logs/Archievement-${dayjs().format('YYYY-MM-DD')}.txt`)) {
          res.send(`<html><head><title>AWA Archievement ${__('log')}</title><link rel="shortcut icon"
    href="${icon}" type="image/x-icon"></head><body style="width:100%;height:100%"><textarea style="width:100%;height:100%">${fs.readFileSync(`logs/Archievement-${dayjs().format('YYYY-MM-DD')}.txt`).toString()}</textarea></body></html>`).status(200).end();
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
    app.post('/startArchievement', async (req, res) => {
      if (req.body?.secret === managerServer.secret) {
        if (!awaCookie) {
          res.send('awaCookie is not set').status(200).end();
          return;
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

          new Logger(time() + __('nextArchievementRestart', chalk.blue(dayjs(parser.parseExpression('0 14 * * *').next().toString()).format('YYYY-MM-DD HH:mm:ss'))));
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
        res.send('success').status(200).end();
      } else {
        res.status(401).end();
      }
    });
    app.get('/stopArchievement', async (req, res) => {
      if (req.body?.secret === managerServer.secret) {
        if (fs.existsSync('data/Archievement')) {
          fs.rmSync('data/Archievement');
        }
        archievement?.destroy();
        archievement = null;
        archievementCorn?.stop();
        archievementCorn = null;
        res.send('success').status(200).end();
      } else {
        res.status(401).end();
      }
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
