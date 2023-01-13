/* eslint-disable max-len */
/* global __, questStatus, myAxiosConfig */
import { AxiosRequestHeaders } from 'axios';
import * as chalk from 'chalk';
import { Logger, sleep, random, time, http as axios, Cookie } from './tool';
import * as events from 'events';
const EventEmitter = new events.EventEmitter();
import { chromium, LaunchOptions } from 'playwright';

class DailyQuestUS {
  headers: AxiosRequestHeaders;
  cookie: Cookie;
  gameCookie?: Cookie;
  httpsAgent!: myAxiosConfig['httpsAgent'];
  questStatus: questStatus = {};
  dailyQuestLink!: string;
  host: string;
  EventEmitter = EventEmitter;
  proxy?: {
    server: string
    username?: string
    password?: string
  };

  constructor({ awaCookie, awaHost, httpsAgent, proxy }: {
    awaCookie: Cookie
    awaHost?: string
    httpsAgent?: myAxiosConfig['httpsAgent']
    proxy?: {
      server: string
      username?: string
      password?: string
    }
  }) {
    this.host = awaHost || 'www.alienwarearena.com';
    this.cookie = awaCookie;
    this.headers = {
      cookie: this.cookie.stringify(),
      'user-agent': globalThis.userAgent,
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6'
    };
    if (httpsAgent) {
      this.httpsAgent = httpsAgent;
    }
    if (proxy) {
      this.proxy = proxy;
    }
  }
  async doTask(taskLink: string): Promise<boolean> {
    try {
      new Logger(`${time()}${__('doingTaskUS', chalk.yellow(taskLink))}`);
      const launchOptions: LaunchOptions = {
        timeout: 3 * 60000
      };
      if (this.proxy) {
        launchOptions.proxy = this.proxy;
      }
      const browser = await chromium.launch(launchOptions);
      const context = await browser.newContext();
      await context.addCookies(this.cookie.browserify());
      const page = await context.newPage();
      let logger = new Logger(`${time()}${__('openingPage', chalk.yellow(taskLink))}`, false);
      await page.goto(taskLink);
      logger.log(chalk.green('OK'));
      await sleep(random(3, 5));
      // const questTitle = await page.locator('.quest-title').innerText();

      logger = new Logger(`${time()}${__('startingQuest')}`, false);
      await page.locator('a.btn-play').click();
      logger.log(chalk.green('OK'));
      await sleep(random(3, 5));

      logger = new Logger(`${time()}${__('waitingIFrame')}`, false);
      await page.locator('iframe[#iFrameResizer0]');
      const gameFrame = page.mainFrame().childFrames().find((frame) => frame.url().includes('https://secure.cataboom.com/'));
      const gameFramePage = gameFrame?.page();
      if (!gameFrame || !gameFramePage) {
        logger.log(chalk.red('Error: GameFrame not found'));
        return false;
      }
      await gameFramePage.locator('#canvas');
      logger.log(chalk.green('OK'));
      await sleep(random(3, 5));

      const cookies = await context.cookies('https://secure.cataboom.com');
      this.gameCookie = new Cookie();
      cookies.forEach((cookie) => {
        (this.gameCookie as Cookie).update(`${cookie.name}=${cookie.value}`);
      });

      const getGameUrl = (): Promise<string | false> => new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 3 * 60000);
        const checker = setInterval(() => {
          if (/index\.html$/.test(gameFrame.url()) || gameFrame.url().includes('prod-wt')) {
            clearTimeout(timeout);
            clearInterval(checker);
            resolve(gameFrame.url());
          }
        }, 1000);
      });
      const gameUrl = await getGameUrl();
      if (!gameUrl) {
        logger.log(chalk.red('Error: GameFrame URL not found'));
        return false;
      }

      if (/index\.html$/.test(gameFrame.url())) {
        if (!await this.gameGateway(gameUrl)) {
          new Logger(`${time()}${__('doTaskUSFailed')}`);
          await browser.close();
          return false;
        }
      } else if (gameFrame.url().includes('prod-wt')) {
        new Logger(`${time()}${'Not supported at present'}`);
        /*
        if (!await this.gamePord(gameUrl)) {
          new Logger(`${time()}${__('doTaskUSFailed')}`);
          await browser.close();
          return false;
        }
        */
      }

      await browser.close();
      new Logger(`${time()}${__('doTaskUSSuccess')}`);
      return true;
    } catch (error) {
      new Logger(`${time()}${__('doTaskUSError')}`);
      new Logger(error);
      return false;
    }
  }
  async gameGateway(link: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('gameGateway')}`, false);
    /*
    const questData: {
      [name: string]: string
    } = {
      'Alien Invasion!': `gameclass=&picklist=&score=0&exit=0&result=0&gameresult%5Bscore%5D=0&gameresult%5Bplaytime%5D=${random(20, 40)}&gameresult%5Blevel%5D=0`
    };
    const postData = questData[questTitle];
    if (!postData) {
      logger.log(chalk.red('Unknown quest'));
      return false;
    }
    */
    const options: myAxiosConfig = {
      url: link.replace('game', 'gateway').replace('/index.html', ''),
      method: 'POST',
      headers: {
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        cookie: (this.gameCookie as Cookie).stringify(),
        origin: 'https://secure.cataboom.com',
        referer: link,
        'user-agent': globalThis.userAgent
      },
      data: `gameclass=&picklist=&score=0&exit=0&result=0&gameresult%5Bscore%5D=0&gameresult%5Bplaytime%5D=${random(20, 40)}&gameresult%5Blevel%5D=0`,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return await axios(options)
      .then(async (response) => {
        if (response.data?.url) {
          return await this.getArp(response.data.url, link);
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async getArp(link: string, referer: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('gettingArp')}`, false);
    const options: myAxiosConfig = {
      url: link,
      method: 'GET',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        cookie: (this.gameCookie as Cookie).stringify(),
        origin: 'https://secure.cataboom.com',
        referer,
        'user-agent': globalThis.userAgent
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return await axios(options)
      .then(async (response) => {
        if (response.status === 200) {
          const [result] = response.data.match(/var[\s]+?pageclass[\s]*?=[\s]*?"(.+?)";/) || [];
          if (!result) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
            return false;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.blue(result));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(2)'));
        new Logger(response.data);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  /* todo
  async gamePord(link: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('gamePord')}`, false);
    return true;
  }
  */
  async gamePordStart(link: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('startingGame')}`, false);
    const options: myAxiosConfig = {
      url: link.replace('dplay', 'event'),
      method: 'POST',
      headers: {
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'content-type': 'application/json; charset=UTF-8',
        cookie: (this.gameCookie as Cookie).stringify(),
        origin: 'https://secure.cataboom.com',
        referer: link,
        'user-agent': globalThis.userAgent
      },
      data: { event: 'game-start' },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return await axios(options)
      .then(async (response) => {
        if (response.data === 'success') {
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
}

export { DailyQuestUS };
