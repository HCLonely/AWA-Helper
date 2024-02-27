/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
/* global WebSocket, logs, __, language */
import * as express from 'express';
import * as fs from 'fs';
import * as os from 'os';
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
  }
  webUI: {
    enable: boolean
    port: number
    ssl?: {
      key?: string
      cert?: string
    }
  }
}
const startManager = async (startHelper: boolean) => {
  dayjs.extend(minMax);
  i18n.configure({
    locales: ['zh', 'en'],
    // directory: join(process.cwd(), '/locales'),
    // extension: '.json',
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
      port: 2345
    },
    webUI: {
      enable: true,
      port: 3456
    }
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
  const { language, managerServer, logsExpire, webUI }: config = config;
  i18n.setLocale(language);

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
    // app.use(express.static(`${__dirname}/manager/static`));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    if (options?.key && options?.cert) {
      server = https.createServer(options, app);
    }

    app.get('/', (_, res) => {
      res.send(
        // fs.readFileSync(`${__dirname}/manager/index.html`).toString()).end();
        indexHtml.replace('__LANG__', language)
          .replaceAll('__VERSION__', 'V__VERSION__')
          .replace('__I18N__', JSON.stringify(langs))).end();
    });
    app.get('/configer', (_, res) => {
      res.send(
        // fs.readFileSync(`${__dirname}/manager/configer/index.html`).toString()).end();
        configerHtml).end();
    });
    app.get('/js/template.yml', (_, res) => {
      res.send(
        // fs.readFileSync(`${__dirname}/manager/configer/index.html`).toString()).end();
        language === 'en' ? templateYmlEN : templateYml).end();
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
          if (!(req.body.cookie.includes('REMEMBERME=') || (req.body.cookie.includes('sc=') && req.body.cookie.includes('PHPSESSID=')))) {
            return res.status(502).end();
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
          .findLast((e) => /^\[[\d]{4}-[\d]{2}-[\d]{2} [\d]{2}:[\d]{2}:[\d]{2}\] [^c][^o][^o][^k][^i][^e]/.test(e)) // todo
          ?.match(/^\[([\d]{4}-[\d]{2}-[\d]{2} [\d]{2}:[\d]{2}:[\d]{2})\]/)?.[1];

        const pid = await getPid();

        let runStatus = 'Stop';
        if (pid) {
          runStatus = 'Running';
        }

        const webui = {
          port: webUI.port,
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

    app.get('/pid', async (_, res) => {
      res.send(`${process.pid}`).status(200).end();
    });

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
      .catch((e) => '0');
    return parseInt(pidRaw, 10);
  }
};

export { startManager };
