/* eslint-disable max-len */
/* global __, questStatus, myAxiosConfig */
import { AxiosRequestHeaders } from 'axios';
import * as chalk from 'chalk';
import { Logger, sleep, random, time, Cookie } from './tool';
import * as events from 'events';
const EventEmitter = new events.EventEmitter();
import { chromium, Frame, LaunchOptions, Page, Locator } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import * as pixelmatch from 'pixelmatch';

class DailyQuestUS {
  headers: AxiosRequestHeaders;
  cookie: Cookie;
  gameCookie?: Cookie;
  httpsAgent!: myAxiosConfig['httpsAgent'];
  questStatus: questStatus = {};
  dailyQuestLink!: string;
  EventEmitter = EventEmitter;
  proxy?: {
    server: string
    username?: string
    password?: string
  };

  constructor({ awaCookie, httpsAgent, proxy }: {
    awaCookie: Cookie
    httpsAgent?: myAxiosConfig['httpsAgent']
    proxy?: {
      server: string
      username?: string
      password?: string
    }
  }) {
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
  async getGameFrame(page: Page, taskLink: string, retry = 0): Promise<{
    gameFrame: Frame | undefined, gameFramePage: Page | undefined, logger?: Logger
  }> {
    try {
      let logger = new Logger(`${time()}${__('openingPage', chalk.yellow(taskLink))}`, false);
      await page.goto(taskLink);
      logger.log(chalk.green('OK'));
      await sleep(random(3, 5));

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
        if (retry >= 3) {
          return { gameFrame, gameFramePage, logger };
        }
        return await this.getGameFrame(page, taskLink, retry + 1);
      }
      return { gameFrame, gameFramePage, logger };
    } catch (error) {
      new Logger(error);
      return { gameFrame: undefined, gameFramePage: undefined };
    }
  }
  async doTask(taskLink: string, retry = 0): Promise<boolean> {
    try {
      new Logger(`${time()}${__('doingTaskUS', chalk.yellow(taskLink))}`);
      const launchOptions: LaunchOptions = {
        timeout: 3 * 60000,
        headless: false
      };
      if (this.proxy) {
        launchOptions.proxy = this.proxy;
      }
      const browser = await chromium.launch(launchOptions);
      const context = await browser.newContext({
        userAgent: globalThis.userAgent
      });
      await context.addCookies(this.cookie.browserify());
      context.setDefaultTimeout(3 * 60000);
      const page = await context.newPage();

      const { gameFrame, gameFramePage, logger: prevLogger } = await this.getGameFrame(page, taskLink);

      if (!gameFrame || !gameFramePage) {
        await browser.close();
        return false;
      }
      prevLogger?.log(chalk.green('OK'));
      await sleep(random(3, 5));

      let logger = new Logger(`${time()}${__('gettingGameUrl')}`, false);
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
        await browser.close();
        return false;
      }
      logger.log(chalk.green('OK'));

      if (/index\.html$/.test(gameFrame.url())) {
        // Game
        logger = new Logger(`${time()}${__('fulfillingGame')}`, false);
        // eslint-disable-next-line no-underscore-dangle
        await gameFrame.waitForFunction('typeof _INIT !== "undefined"');
        await sleep(random(5, 10));
        await gameFrame.evaluate('_INIT.playButtonReleased()');
        await sleep(random(5, 10));
        gameFrame.locator('#canvas').click();
        await sleep(random(5, 10));
        await gameFrame.evaluate(`_INIT.endGameButtonReleased(${random(0, 10)}, ${random(20, 40)})`);
        try {
          await gameFrame.waitForURL((url) => url.href.includes('secure.cataboom.com/fulfill') || url.href.includes('secure.cataboom.com/message'));
          const link = gameFrame.url();
          if (link.includes('secure.cataboom.com/fulfill')) {
            logger.log(chalk.green('OK'));
          } else {
            await gameFrame.waitForFunction('typeof pageclass !== "undefined"');
            const pageclass = await gameFrame.evaluate('pageclass');
            logger.log(chalk.blue(pageclass));
          }
        } catch (error) {
          if (gameFrame.url().includes('chrome-error') || (error as Error).message.includes('ERR_BLOCKED_BY_RESPONSE')) {
            logger.log(chalk.red('Error(1)'));
            new Logger(error);
            await browser.close();
            return false;
          }
          if (gameFrame.url() === gameUrl && retry < 3) {
            logger.log(chalk.blue('Retry'));
            await browser.close();
            return await this.doTask(taskLink, retry + 1);
          }
          logger.log(chalk.red(`Unknown Page[${chalk.yellow(gameFrame.url())}]`));
          new Logger(error);
        }
      } else if (gameFrame.url().includes('prod-wt')) {
        // Click
        logger = new Logger(`${time()}${__('boundingBox')}`, false);
        const gameFrameCanvas = gameFrame.locator('#canvas');
        const box = await gameFrameCanvas.boundingBox();
        if (!box) {
          logger.log(chalk.red('Error(2)'));
          await browser.close();
          return false;
        }
        logger.log(chalk.green('OK'));

        if (await this.canvasClick(gameFrameCanvas, box)) {
          new Logger(`${time()}${__('doTaskUSSuccess')}`);
          await browser.close();
          return true;
        }

        new Logger(`${time()}${__('doTaskUSFailed')}`);
        await browser.close();
        return false;
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
  async canvasClick(gameFrameCanvas: Locator, box: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<boolean> {
    try {
      let logger = new Logger(`${time()}${__('screenshoting')}`, false);
      const screenshot1Path = path.resolve('temp/screenshot1.png');
      await gameFrameCanvas.screenshot({
        path: screenshot1Path
      });
      logger.log(chalk.green('OK'));

      logger = new Logger(`${time()}${__('clickingElement')}`, false);
      gameFrameCanvas.click({
        position: {
          x: box.width * (random(10, 90) / 100),
          y: box.height * (random(10, 90) / 100)
        }
      });
      logger.log(chalk.green('OK'));

      await sleep(random(15, 25));
      logger = new Logger(`${time()}${__('screenshoting')}`, false);
      const screenshot2Path = path.resolve('temp/screenshot2.png');
      await gameFrameCanvas.screenshot({
        path: screenshot2Path
      });
      logger.log(chalk.green('OK'));

      logger = new Logger(`${time()}${__('comparingScreenshot')}`, false);
      const img1 = PNG.sync.read(fs.readFileSync(screenshot1Path));
      const img2 = PNG.sync.read(fs.readFileSync(screenshot2Path));
      const { width, height } = img1;

      const similarity = pixelmatch(img1.data, img2.data, null, width, height) / (width * height);
      if (similarity < 1e-4) {
        return true;
      }
      return await this.canvasClick(gameFrameCanvas, box);
    } catch (error) {
      new Logger(error);
      return false;
    }
  }
}

export { DailyQuestUS };
