/* eslint-disable max-len */
/* global __, questStatus, proxy, awaInfo, myAxiosConfig, boosters */
import { RawAxiosRequestHeaders } from 'axios';
import { load } from 'cheerio';
import * as chalk from 'chalk';
import * as FormData from 'form-data';
import * as cornParser from 'cron-parser';
import { Logger, sleep, random, time, netError, http as axios, formatProxy, push, pushQuestInfoFormat, Cookie } from './tool';
import { TwitchTrack } from './TwitchTrack';
import { SteamQuestASF } from './SteamQuestASF';
// import { SteamQuestSU } from './SteamQuestSU';
// import { DailyQuestUS } from './DailyQuestUS';
import * as fs from 'fs';
import { chunk } from 'lodash';
import * as events from 'events';
const EventEmitter = new events.EventEmitter();
import * as dayjs from 'dayjs';

import * as dailyQuestDbJson from './dailyQuestDb.json';
// import { chromium, LaunchOptions } from 'playwright';
/*
import { createInterface } from 'readline';
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});
*/

class DailyQuest {
  // eslint-disable-next-line no-undef
  questInfo: questInfo = {};
  posts!: Array<string>;
  trackError = 0;
  trackTimes = 0;
  headers: RawAxiosRequestHeaders;
  cookie: Cookie;
  httpsAgent!: myAxiosConfig['httpsAgent'];
  userId!: string;
  borderId!: string;
  badgeIds!: Array<string>;
  avatar!: string;
  questStatus: questStatus = {};
  dailyQuestLink!: string;
  awaBoosterNotice: boolean;
  dailyQuestNumber = 0;
  clickQuestId?: string | undefined;
  awaDailyQuestType = [
    'click',
    'visitLink',
    'openLink',
    'changeBorder',
    'changeBadge',
    'changeAvatar',
    'viewNews',
    'sharePost',
    'replyPost'
  ];
  dailyQuestName!: Array<string>;
  done:Array<string> = [];
  EventEmitter = EventEmitter;
  listenTwitch = false;
  listenSteam = false;
  listenAwa = false;
  awaDailyQuestNumber1: boolean;
  boosters: {
    [name: string]: Array<boosters>
  } = {};
  boosterRule: Array<string> = [];
  boosterCorn?: cornParser.CronExpression;
  #loginInfo?: {
    enable: boolean
    username: string
    password: string
  };
  newCookie: string;
  proxy?: {
    server: string
    username?: string
    password?: string
  };
  doTaskUS = false;
  postReplied: null | boolean = null;
  safeReply = false;
  joinSteamCommunityEvent = false;
  steamCommunityEventPath?: string;
  steamCommunityEventInfo?: {
    status: string,
    playedTime: string,
    totalTime: string
  };
  userProfileUrl!: string;
  additionalTwitchARP = 0;
  signArp: {
    daily?: string,
    monthly?: string
  } = {};
  promotionalCalendarInfo?: {
    name: string,
    id: string | undefined,
    day: string,
    finished?: boolean
  };
  taskType: string = 'New';
  dailyArp = '0';
  // USTaskInfo?: Array<{ url: string; progress: Array<string>; }>;

  constructor({ awaCookie, awaDailyQuestType, awaDailyQuestNumber1, boosterRule, boosterCorn, awaBoosterNotice, proxy, autoLogin, doTaskUS, awaSafeReply, joinSteamCommunityEvent }: {
    awaCookie: string
    awaDailyQuestType?: Array<string>
    awaDailyQuestNumber1: boolean | undefined
    boosterRule?: Array<string>
    boosterCorn?: string
    awaBoosterNotice: boolean
    proxy?: proxy
    autoLogin?: {
      enable: boolean
      username: string
      password: string
    },
    doTaskUS?: boolean
    awaSafeReply?: boolean
    joinSteamCommunityEvent?: boolean
  }) {
    this.awaBoosterNotice = awaBoosterNotice ?? true;
    this.newCookie = awaCookie;
    this.cookie = new Cookie(awaCookie);
    this.headers = {
      cookie: this.cookie.stringify(),
      'user-agent': globalThis.userAgent,
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6'
    };
    this.awaDailyQuestNumber1 = awaDailyQuestNumber1 ?? true;
    if (boosterRule) {
      this.boosterRule = boosterRule;
    }
    if (boosterCorn) {
      this.boosterCorn = cornParser.parseExpression(boosterCorn, {
        currentDate: new Date(`${dayjs().add(-1, 'day')
          .format('YYYY-MM-DD')} 23:59:59`)
      });
    }
    if (awaDailyQuestType) {
      this.awaDailyQuestType = awaDailyQuestType;
      if (awaDailyQuestType.includes('viewNew')) {
        this.awaDailyQuestType.push('viewNews');
      }
      if (awaDailyQuestType.includes('sharePost')) {
        this.awaDailyQuestType.push('sharePosts');
      }
    }
    if (proxy?.enable?.includes('awa') && proxy.host && proxy.port) {
      this.httpsAgent = formatProxy(proxy);
      this.proxy = {
        server: `${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`
      };
      if (proxy.username && proxy.password) {
        this.proxy.username = proxy.username;
        this.proxy.password = proxy.password;
      }
    }
    if (autoLogin?.enable) {
      this.#loginInfo = autoLogin;
    }
    this.doTaskUS = !!doTaskUS;
    this.safeReply = !!awaSafeReply;
    this.joinSteamCommunityEvent = !!joinSteamCommunityEvent;
  }
  async init(): Promise<number> {
    const REMEMBERME = this.cookie.get('REMEMBERME');
    if (REMEMBERME) {
      await this.updateCookie(`REMEMBERME=${REMEMBERME}`);
    } /* else {
      new Logger(`${time()}${__('noREMEMBERMEAlert', chalk.yellow('awaCookie')), chalk.blue('REMEMBERME')}`);
    }*/
    if (this.cookie.get('REMEMBERME') === 'deleted') {
      /* if (!await this.login()) {
        return 602;
      } */
      return 602;
    }
    const result = await this.updateDailyQuests(true);
    if (result === 602) {
      /*
      if (!await this.login()) {
        return 602;
      }
      if (first) {
        return this.init();
      }
      */
      return 602;
    }
    if (result !== 200) {
      return result;
    }
    if (fs.existsSync('awa-info.json')) {
      const { awaUserId, awaBorderId, awaBadgeIds, awaAvatar } = JSON.parse(fs.readFileSync('awa-info.json').toString()) as awaInfo;
      this.userId = awaUserId;
      this.borderId = awaBorderId;
      this.avatar = awaAvatar;
      this.badgeIds = awaBadgeIds;
      if (!(awaUserId && awaBorderId && awaBadgeIds)) {
        const result = await this.getPersonalization();
        if (result !== 200) {
          return result;
        }
      }
      /*
      if (!awaAvatar) {
        const result = await this.getAvatar();
        if (result !== 200) {
          return result;
        }
      }
      */
    // } else if (!(await this.getPersonalization() && await this.getAvatar())) {
    } else if (!(await this.getPersonalization())) {
      return 603;
    }
    this.newCookie = `${this.cookie.get('REMEMBERME') ? `REMEMBERME=${this.cookie.get('REMEMBERME')}` : ''};${this.cookie.get('PHPSESSID') ? `PHPSESSID=${this.cookie.get('PHPSESSID')}` : ''};${this.cookie.get('sc') ? `sc=${this.cookie.get('sc')}` : ''};`;
    return 200;
  }
  /*
  async login(): Promise<boolean> {
    try {
      if (!this.#loginInfo?.enable) {
        return false;
      }
      new Logger(`${time()}${__('updatingAwaCookies')}`);
      const launchOptions: LaunchOptions = {
        timeout: 3 * 60000
      };
      if (this.proxy) {
        launchOptions.proxy = this.proxy;
      }
      if (process.env.CHROME_BIN) {
        launchOptions.executablePath = process.env.CHROME_BIN;
      }
      const browser = await chromium.launch(launchOptions);
      const context = await browser.newContext({
        userAgent: globalThis.userAgent
      });
      context.setDefaultTimeout(3 * 60000);
      const page = await context.newPage();
      let logger = new Logger(`${time()}${__('openingPage', chalk.yellow(`https://${globalThis.awaHost}/`))}`, false);
      await page.goto(`https://${globalThis.awaHost}/`);
      logger.log(chalk.green('OK'));
      await sleep(random(3, 5));
      await page.screenshot({ path: 'temp/homepage.png', fullPage: true });

      logger = new Logger(`${time()}${__('loginingAWA')}`, false);
      await page.locator('a.nav-link.nav-link-login').click();
      logger.log(chalk.green('OK'));
      await sleep(random(3, 5));
      await page.screenshot({ path: 'temp/loginpage.png', fullPage: true });

      // await page.waitForFunction(() => $('[name="_recaptcha_token"]').val());

      logger = new Logger(`${time()}${__('inputingUsername')}`, false);
      await page.locator('input#_username').click();
      await page.locator('input#_username').focus();
      await page.locator('input#_username').fill(this.#loginInfo.username);
      logger.log(chalk.green('OK'));
      await sleep(random(3, 5));
      await page.screenshot({ path: 'temp/username.png', fullPage: true });

      logger = new Logger(`${time()}${__('inputingPassword')}`, false);
      await page.locator('input#_password').click();
      await page.locator('input#_password').focus();
      await page.locator('input#_password').fill(this.#loginInfo.password);
      logger.log(chalk.green('OK'));
      await sleep(random(3, 5));
      await page.screenshot({ path: 'temp/passwordpage.png', fullPage: true });

      logger = new Logger(`${time()}${__('checkingRememberMe')}`, false);
      await page.locator('input#remember_me').setChecked(true);
      logger.log(chalk.green('OK'));
      await sleep(random(3, 5));
      await page.screenshot({ path: 'temp/rememberpage.png', fullPage: true });

      logger = new Logger(`${time()}${__('clickingLogin')}`, false);
      await page.locator('button#_login').click();
      logger.log(chalk.green('OK'));
      await page.screenshot({ path: 'temp/clickLoginpage.png', fullPage: true });

      let result = false;
      try {
        logger = new Logger(`${time()}${__('verifyingLogin')}`, false);
        await page.waitForNavigation({ timeout: 3 * 60000 });
        logger.log(chalk.green('OK'));
        await page.screenshot({ path: 'temp/loginedpage.png', fullPage: true });
      } catch (e) {
        logger.log(chalk.yellow(__('retry')));
        logger = new Logger(`${time()}${__('clickingLogin')}`, false);
        await page.locator('button#_login').click();
        logger.log(chalk.green('OK'));
        await page.screenshot({ path: 'temp/clickLoginpage2.png', fullPage: true });

        logger = new Logger(`${time()}${__('verifyingLogin')}`, false);
        await page.waitForNavigation({ timeout: 3 * 60000 });
        logger.log(chalk.green('OK'));
        await page.screenshot({ path: 'temp/loginedpage2.png', fullPage: true });
      } finally {
        logger = new Logger(`${time()}${__('gettingCookied')}`, false);
        const cookies = await context.cookies('https://.alienwarearena.com');
        this.cookie = new Cookie();
        cookies.forEach((cookie) => {
          if (['REMEMBERME', 'PHPSESSID', 'sc'].includes(cookie.name)) {
            this.cookie.update(`${cookie.name}=${cookie.value}`);
          }
        });
        this.headers.cookie = this.cookie.stringify();
        logger.log(chalk.green('OK'));
        await browser.close();
        new Logger(`${time()}${__('updatingAwaCookiesSuccess')}`);
        result = true;
      }
      return result;
    } catch (error) {
      new Logger(`${time()}${__('updatingAwaCookiesError')}`);
      new Logger(error);
      return false;
    }
  }
  */
  async listen(twitch: TwitchTrack | null, steamQuest: SteamQuestASF | null, check = false): Promise<void> {
    if (twitch && !this.listenTwitch) {
      this.listenTwitch = true;
      twitch.EventEmitter.addListener('complete', async () => {
        await sleep(60);
        this.listen(twitch, steamQuest, true);
      });
    }
    if (steamQuest && !this.listenSteam) {
      this.listenSteam = true;
      steamQuest.EventEmitter.addListener('complete', async () => {
        await sleep(60);
        this.listen(twitch, steamQuest, true);
      });
    }
    if (!this.listenAwa) {
      this.listenAwa = true;
      this.EventEmitter.addListener('complete', async () => {
        await sleep(60);
        this.listen(twitch, steamQuest, true);
      });
    }

    if (await this.updateDailyQuests() === 200) {
      // if (this.questInfo.steamQuest && steamQuest && parseInt(this.questInfo.steamQuest, 10) >= steamQuest.maxArp) {
      if (
        this.questInfo.steamQuest && steamQuest &&
        (
          steamQuest.taskStatus?.length === 0 ||
          (steamQuest.taskStatus?.length > 0 && !steamQuest.taskStatus.find((e) => parseInt(e.progress || '0', 10) < 100))
        )
      ) {
        if (steamQuest.status === 'running') {
          await steamQuest.resume();
        }
        this.questStatus.steamQuest = 'complete';
      }
      if (steamQuest?.status === 'stopped' || (!check && !steamQuest)) {
        this.questStatus.steamQuest = 'complete';
      }
      if (twitch?.complete || (!check && !twitch)) {
        this.questStatus.watchTwitch = 'complete';
      }
      if ((
        this.questStatus.dailyQuest === 'complete' ||
        this.questStatus.dailyQuest === 'skip' ||
        (this.questInfo.dailyQuest || []).filter((e) => e.status === 'complete').length === this.questInfo.dailyQuest?.length
      ) && (
        this.questStatus.timeOnSite === 'complete' ||
        this.questInfo.timeOnSite?.addedArp === this.questInfo.timeOnSite?.maxArp
      ) && (
        this.questStatus.watchTwitch === 'complete' ||
        (parseInt(this.questInfo.watchTwitch?.[0] || '0', 10) + parseFloat(this.questInfo.watchTwitch?.[1] || '0')) >= (15 + this.additionalTwitchARP)
      ) && this.questStatus.steamQuest === 'complete') {
        new Logger(time() + chalk.green(__('allTaskCompleted')));
        await push(`${__('pushTitle')}\n${__('allTaskCompleted')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
        process.exit(0);
        /*
        log('按任意键退出...');
        process.stdin.setRawMode(true);
        process.stdin.on('data', () => process.exit(0));
        */
        return;
      }
      if (check) return;
    }
    await sleep(60 * 5);
    this.listen(twitch, steamQuest);
  }
  async updateCookie(REMEMBERME: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('updatingCookie', chalk.yellow('AWA Cookie'))}...`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/`,
      method: 'GET',
      headers: {
        ...this.headers,
        cookie: REMEMBERME,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      maxRedirects: 0,
      validateStatus: (status: number) => status === 302 || status === 200,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200 && response.data.toLowerCase().includes('we have detected an issue with your network')) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('ipBanned')));
          return false;
        }
        if (response.status === 302 && response.headers['set-cookie']?.length) {
          this.headers.cookie = this.cookie.update(response.headers['set-cookie']).stringify();
          const homeSite = this.cookie.get('home_site');
          if (homeSite && globalThis.awaHost !== homeSite) {
            globalThis.awaHost = homeSite;
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__('redirected')));
            return this.updateCookie(REMEMBERME);
          }
          if (this.cookie.get('REMEMBERME') === 'deleted') {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('cookieExpired', chalk.yellow('awaCookie'))}`));
            return false;
          }
          if (!this.cookie.get('REMEMBERME')) {
            this.headers.cookie = this.cookie.update(REMEMBERME).stringify();
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async updateDailyQuests(verify = false): Promise<number> {
    const logger = new Logger(time() + (verify ? __('verifyingToken', chalk.yellow('AWA Token')) : __('gettingTaskInfo')), false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/control-center`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          if (response.data.toLowerCase().includes('we have detected an issue with your network')) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('ipBanned')));
            return 610;
          }
          const $ = load(response.data);
          if ($('a.nav-link-login').length > 0) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
            return 602;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          if (!this.userProfileUrl) {
            this.userProfileUrl = response.data.match(/user_profile_url.*?=.*?"(.+?)"/)?.[1];
          }
          if (verify) {
            this.taskType = response.data.match(/user_country.*?=.*?"(.+?)"/)?.[1] === 'US' ? 'US' : 'New';

            const rewardBonusArp = response.data.match(/bonusCalendarArp.*?=.*?([\d]+?)/)?.[1];
            // 连续签到
            const consecutiveLoginsText = response.data.match(/consecutive_logins.*?=.*?({.+?})/)?.[1];
            if (consecutiveLoginsText) {
              try {
                const consecutiveLogins = JSON.parse(consecutiveLoginsText);
                const rewardArp = $(`#streak-days .calendar-rewards__day[data-day="${consecutiveLogins.count}"] .calendar-rewards__reward h1`).text().trim();
                if (rewardArp) {
                  this.signArp.daily = `${rewardArp} + ${rewardBonusArp || ''} ARP`;
                  new Logger(`${time()}${__('consecutiveLoginsAlert', chalk.yellow(`${consecutiveLogins.count} / 7`), chalk.green(`${rewardArp} + ${rewardBonusArp || ''}`))}`);
                }
              } catch (e) {
                //
              }
            }
            // 月签到
            const monthlyLoginsText = response.data.match(/monthly_logins.*?=.*?({.+?})/)?.[1];
            if (monthlyLoginsText) {
              try {
                const monthlyLogins = JSON.parse(monthlyLoginsText);
                if (monthlyLogins.count < 29) {
                  const week = Math.ceil(monthlyLogins.count / 7);
                  const rewardArp = $(`#monthly-days-${week} .calendar-rewards__day[data-day="${monthlyLogins.count}"] .calendar-rewards__reward h1`).text().trim();
                  const rewardItem = $(`#monthly-days-${week} .calendar-rewards__day[data-day="${monthlyLogins.count}"] .calendar-rewards__day-overlay`).eq(0).text()
                    .trim();
                  if (rewardArp) {
                    this.signArp.monthly = `${rewardArp} + ${rewardBonusArp || ''} ARP`;
                    new Logger(`${time()}${__('monthlyLoginsARPAlert', chalk.yellow(monthlyLogins.count), chalk.green(`${rewardArp} + ${rewardBonusArp || ''}`))}`);
                  }
                  if (rewardItem) {
                    this.signArp.monthly = rewardItem;
                    new Logger(`${time()}${__('monthlyLoginsItemAlert', chalk.yellow(monthlyLogins.count), chalk.green(rewardItem))}`);
                  }
                } else {
                  this.signArp.monthly = `${monthlyLogins.extra_arp} + ${rewardBonusArp || ''} ARP`;
                  new Logger(`${time()}${__('monthlyLoginsARPAlert', chalk.yellow(monthlyLogins.count), chalk.green(`${monthlyLogins.extra_arp} + ${rewardBonusArp || ''}`))}`);
                }
              } catch (e) {
                //
              }
            }
            // 活动奖励
            const getItemBtn = $('.promotional-calendar__day-claim').filter((i, e) => /GET[\s]*?ITEM/gi.test($(e).text().trim()));
            if (getItemBtn.length > 0) {
              new Logger(`${time()}${chalk.green(__('promotionalAlert'))}`);
            }

            // 推广活动
            const promotionalCalendar = $('div.promotional-calendar__day').filter((i, e) => $(e).text().includes('GET ITEM')).eq(0);
            if (promotionalCalendar.length > 0) {
              this.promotionalCalendarInfo = {
                name: promotionalCalendar.find('div.promotional-calendar__day-label').text().trim(),
                id: promotionalCalendar.find('button.promotional-calendar__day-claim').attr('data-id')?.trim(),
                day: promotionalCalendar.find('div.promotional-calendar__day-date').text().trim()
              };
            }
            // Steam社区活动
            if (this.joinSteamCommunityEvent) {
              if (await this.getSteamCommunityEventPath() && this.steamCommunityEventPath) {
                await this.getSteamCommunityEvent();
              }
            }
          }
          if (this.joinSteamCommunityEvent && this.steamCommunityEventPath) {
            await this.checkSteamCommunityEventStatus();
          }

          // AWA 在线任务
          const maxArp = $('#control-center__tos-max-arp').text().trim()
            .match(/[\d]+/)?.[0] || '0';
          if (!this.questInfo.timeOnSite) {
            this.questInfo.timeOnSite = {
              maxArp,
              addedArp: '0',
              addedArpExtra: '0'
            };
          }
          const dailyArpDataRaw = response.data.match(/dailyArpData.*?=.*?({.+?}})/)?.[1];
          if (dailyArpDataRaw) {
            try {
              const dailyArpData = JSON.parse(dailyArpDataRaw);
              this.questInfo.timeOnSite.addedArp = `${dailyArpData.timeOnSiteArp}`;
              this.questInfo.watchTwitch = [`${dailyArpData.twitchData.totalPoints}`, `${dailyArpData.twitchData.bonusPoints}`];
              this.dailyArp = `${dailyArpData.dailyArp}`;
            } catch (e) {
              console.log(e);
              //
            }
          }
          // 每日任务 New
          this.questInfo.dailyQuestUS = $('div.user-profile__card-body').eq(0).find('.card-table-row')
            .filter((i, e) => $(e).find('a[href^="/quests/"]').length > 0)
            .toArray()
            .map((e) => ({
              link: new URL($(e).find('a[href^="/quests/"]').attr('href') as string, `https://${globalThis.awaHost}/`).href,
              title: $(e).find('.quest-title').text()
                .trim(),
              arp: $(e).find('.quest-item-progress').toArray()
                .map((e) => $(e).text().trim()
                  .toLowerCase())
                .at(-1)
                ?.match(/[\d\s+]+/)?.[0]
                ?.split('+')?.[0]?.trim() || '0',
              extraArp: $(e).find('.quest-item-progress').toArray()
                .map((e) => $(e).text().trim()
                  .toLowerCase())
                .at(-1)
                ?.match(/[\d\s+]+/)?.[0]
                ?.split('+')?.[1]?.trim() || '0'
            }));

          /*
          // Booster
          const userArpBoostText = response.data.match(/userArpBoost[\s]*?=[\s]*?({[\w\W]+?})/)?.[1];
          let boostEnabled = false;
          if (userArpBoostText) {
            try {
              const userArpBoostEnd = new Date(userArpBoostText.match(/new Date\("(.+?)"/m)?.[1] || 0);
              if (new Date() < userArpBoostEnd) {
                boostEnabled = true;
              }
            } catch (e) {
              //
            }
          }
          if (verify && !boostEnabled && this.boosterRule.length > 0 && this.boosterCorn) {
            const nextTime = this.boosterCorn?.next()?.getTime();
            if (nextTime && dayjs(nextTime).isSame(dayjs(nextTime).format('YYYY-MM-DD'), 'day') && nextTime < Date.now()) {
              await this.getBoosters();
              for (const rule of this.boosterRule) {
                const [, ratio, time, numbers] = rule.replace(/[\s]/g, '').match(/([\d]+?)x([\d]+?)h>([\d]+)/i) || [];
                if ((this.boosters[`${ratio}-${time}`] || []).length > parseInt(numbers, 10)) {
                  const boosters = this.boosters[`${ratio}-${time}`].sort((a, b) => new Date(a.rewardedTime).getTime() - new Date(b.rewardedTime).getTime());
                  if (await this.activateBooster(boosters[0])) {
                    boostEnabled = true;
                  }
                }
              }
            }
          }
          */

          // 每日任务
          $('div.user-profile__card-body').eq(0).find('.card-table-row')
            .each((i, e) => {
              if ($(e).find('.quest-item-progress').length === 1) {
                $(e).append('<span class="quest-item-progress">0 ARP</span>');
              }
            });
          const dailyQuests = chunk(
            $('div.user-profile__card-body').eq(0).find('.card-table-row')
              .filter((i, e) => !$(e).text().includes('ARP 6.0') && $(e).find('a[href^="/quests"]').length === 0)
              .find('.quest-item-progress')
              .map((i, e) => $(e).text().trim()
                .toLowerCase()), 2);
          let dailyQuest = dailyQuests;
          if (this.awaDailyQuestNumber1) {
            dailyQuest = [dailyQuests[0]];
          }
          if (dailyQuests.length === 0) {
            dailyQuest = [['none', '0']];
          }
          this.dailyQuestName = $('div.user-profile__card-body').eq(0).find('.card-table-row')
            .filter((i, e) => !$(e).text().includes('ARP 6.0') && $(e).find('a[href^="/quests"]').length === 0)
            .find('.quest-title')
            .toArray()
            .map((e) => $(e).text().trim()) || ['None'];
          this.questInfo.dailyQuest = dailyQuest.map(([status, arp]: Array<string>) => ({
            status, arp: arp.match(/[\d\s+]+/)?.[0]?.split('+')[0].trim() || '0',
            extraArp: arp.match(/[\d\s+]+/)?.[0]?.split('+')[1]?.trim() || '0'
          }));
          this.dailyQuestNumber = $('div.user-profile__card-body').eq(0).find('.card-table-row')
            .filter((i, e) => $(e).find('a[href^="/quests"]').length === 0)
            .find('.quest-item-progress')
            .map((i, e) => $(e).text().trim()
              .toLowerCase())
            .filter((i, e) => e === 'incomplete').length;
          /*
          if (verify && this.awaBoosterNotice && this.dailyQuestNumber > 1) {
            if (!boostEnabled) {
              const answer = await ask(rl, __('boosterAlert', chalk.blue(__('booster')), chalk.yellow(__('selfOpen')), chalk.yellow('1'), chalk.yellow('2')), ['1', '2']);
              if (answer === '2') {
                this.questStatus.dailyQuest = 'skip';
              }
            }
          }
          */

          this.clickQuestId = $('a.quest-title[data-award-on-click="true"][href]').filter((i, e) => !/^\/quests\//.test($(e).attr('href') as string)).attr('data-quest-id');

          // Steam 挂机任务
          this.questInfo.steamQuest = $('div.user-profile__card-body').eq(1).find('.card-table-row')
            .map((i, e) => ({
              name: $(e).find('.quest-list__quest-details div').eq(0)
                .text()
                .trim(),
              status: $(e).find('[id^=control-center__steam-quest-status-]').text()
                .trim()
                .toLowerCase(),
              maxAvailableARP: $(e).find('[id^=control-center__steam-quest-reward-]').text()
                .match(/[\d\s+]+/)?.[0]
                .trim() || '0'
            }))
            .toArray();
          /*
          const [steamArp, steamArpExtra] = $('section.tutorial__um-community').filter((i, e) => $(e).text().includes('Steam Quests')).find('center b')
            .last()
            .text()
            .split('+')
            .map((e) => e.trim());
          this.questInfo.steamQuest = [steamArp, steamArpExtra || '0'];
          */
          if (!verify) Logger.consoleLog(`${time()}${__('taskInfo')}`);
          const formatQuestInfo = this.formatQuestInfo();
          fs.appendFileSync(`logs/${dayjs().format('YYYY-MM-DD')}.txt`, `${JSON.stringify(formatQuestInfo, null, 2)}\n`);
          if (!verify) console.table(formatQuestInfo);
          new Logger({
            type: 'questInfo',
            data: formatQuestInfo
          });

          this.posts = $('.featured-row-News a[href*="/ucf/show/"]').toArray()
            .map((e) => $(e).attr('href')?.match(/ucf\/show\/([\d]+)/)?.[1])
            .filter((e) => e) as Array<string>;
          if ($('a.quest-title').length > 0) {
            this.dailyQuestLink = new URL($('a.quest-title[href]').attr('href') as string, `https://${globalThis.awaHost}/`).href;
          }

          return 200;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
        return response.status;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return 0;
      });
  }
  async do(): Promise<any> {
    if (!this.dailyQuestName[0]) {
      this.questStatus.dailyQuest = 'complete';
      return new Logger(time() + chalk.yellow(__('noDailyQuest')));
    }
    if (this.questStatus.dailyQuest === 'skip') {
      return new Logger(time() + chalk.yellow(__('dailyQuestSkipped')));
    }
    if ((this.questInfo.dailyQuest || []).filter((e) => e.status === 'complete').length === this.questInfo.dailyQuest?.length) {
      this.questStatus.dailyQuest = 'complete';
      return new Logger(time() + chalk.green(__('dailyQuestCompleted')));
    }
    if (this.awaDailyQuestType.includes('click') && this.clickQuestId) {
      await this.questAward(this.clickQuestId);
      await this.updateDailyQuests();
      if ((this.questInfo.dailyQuest || []).filter((e) => e.status === 'complete').length === this.questInfo.dailyQuest?.length) {
        this.questStatus.dailyQuest = 'complete';
        return new Logger(time() + chalk.green(__('dailyQuestCompleted')));
      }
    }
    if (this.awaDailyQuestType.includes('visitLink') && this.dailyQuestLink) {
      await this.openLink(this.dailyQuestLink);
      const postId = this.dailyQuestLink.match(/ucf\/show\/([\d]+)/)?.[1];
      if (postId) {
        await this.viewPost(postId);
      }
      await this.updateDailyQuests();
      if ((this.questInfo.dailyQuest || []).filter((e) => e.status === 'complete').length === this.questInfo.dailyQuest?.length) {
        this.questStatus.dailyQuest = 'complete';
        return new Logger(time() + chalk.green(__('dailyQuestCompleted')));
      }
    }
    if ((this.questInfo.dailyQuest || []).filter((e) => e.status === 'complete').length === this.questInfo.dailyQuest?.length) {
      this.questStatus.dailyQuest = 'complete';
      if (this.dailyQuestNumber < 2) {
        return new Logger(time() + chalk.green(__('dailyQuestCompleted')));
      }
    }

    for (const dailyQuestName of this.dailyQuestName) {
      const matchedQuest = this.matchQuest(dailyQuestName);
      if (matchedQuest.length > 0) {
        for (const quest of matchedQuest) {
          // @ts-ignore
          if (this[quest] && this.awaDailyQuestType.includes(quest)) {
            // @ts-ignore
            await this[quest]();
          } else if (/^\//.test(quest)) {
            await this.openLink(`https://${globalThis.awaHost}${quest}`);
          }
          this.done.push(quest);
          await sleep(random(1, 2));
        }
        await this.updateDailyQuests();
        if ((this.questInfo.dailyQuest || []).filter((e) => e.status === 'complete').length === this.questInfo.dailyQuest?.length) {
          this.questStatus.dailyQuest = 'complete';
          if (this.dailyQuestNumber < 2) {
            return new Logger(time() + chalk.green(__('dailyQuestCompleted')));
          }
        }
      }
    }

    if (this.awaDailyQuestType.includes('changeBorder') && !this.done.includes('changeBorder')) await this.changeBorder();
    // if (this.awaDailyQuestType.includes('changeBadge') && !this.done.includes('changeBadge')) await this.changeBadge();
    if (this.awaDailyQuestType.includes('changeAvatar') && !this.done.includes('changeAvatar')) await this.changeAvatar();
    // if (this.awaDailyQuestType.includes('viewPost') && !this.done.includes('viewPost')) await this.viewPosts();
    if (this.awaDailyQuestType.includes('viewNews') && !this.done.includes('viewNews')) await this.viewNews();
    if (this.awaDailyQuestType.includes('sharePosts') && !this.done.includes('sharePosts')) await this.sharePosts();

    await this.updateDailyQuests();
    if ((this.questInfo.dailyQuest || []).filter((e) => e.status === 'complete').length === this.questInfo.dailyQuest?.length) {
      this.questStatus.dailyQuest = 'complete';
      if (this.dailyQuestNumber < 2) {
        return new Logger(time() + chalk.green(__('dailyQuestCompleted')));
      }
    }

    if (this.awaDailyQuestType.includes('openLink')) {
      const linksPathname = ['/rewards/leaderboard', '/rewards', '/marketplace/', '/ucf/Video', '/faq-contact', '/account/personalization'];
      for (const pathname of linksPathname) {
        if (!this.done.includes(pathname)) {
          await this.openLink(`https://${globalThis.awaHost}${pathname}`);
          await sleep(random(1, 3));
        }
      }
    }
    await this.updateDailyQuests();
    if ((this.questInfo.dailyQuest || []).filter((e) => e.status === 'complete').length === this.questInfo.dailyQuest?.length) {
      this.questStatus.dailyQuest = 'complete';
      if (this.dailyQuestNumber < 2) {
        return new Logger(time() + chalk.green(__('dailyQuestCompleted')));
      }
    }
    if (this.awaDailyQuestType.includes('replyPost') && !this.done.includes('replyPost')) {
      this.safeReply = false; // todo: 新版界面失效！
      if (
        this.safeReply &&
        (
          this.postReplied === true ||
          (
            typeof this.postReplied !== 'boolean' &&
            await this.replyChecker()
          )
        )
      ) {
        new Logger(time() + chalk.blue(__('repliedNotice')));
      } else {
        await this.replyPost();
        await this.updateDailyQuests();
        if ((this.questInfo.dailyQuest || []).filter((e) => e.status === 'complete').length === this.questInfo.dailyQuest?.length) {
          this.questStatus.dailyQuest = 'complete';
          if (this.dailyQuestNumber < 2) {
            return new Logger(time() + chalk.green(__('dailyQuestCompleted')));
          }
        }
      }
    }
    this.questStatus.dailyQuest = 'complete';
    return new Logger(time() + chalk.red(__('dailyQuestNotCompleted')));
  }
  async doQuestUS(): Promise<void> {
    /*
    if (this.questInfo.dailyQuestUS?.length) {
      const dailyQuestUS = new DailyQuestUS({
        awaCookie: this.cookie,
        httpsAgent: this.httpsAgent,
        proxy: this.proxy
      });
      for (const { link, arp } of this.questInfo.dailyQuestUS) {
        if (parseInt(arp, 10) > 0) {
          continue; // todo
        }
        await dailyQuestUS.doTask(link);
      }
    }
    */
  }
  async changeBorder(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('changing', chalk.yellow('Border'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/border/select`,
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${globalThis.awaHost}`,
        referer: `https://${globalThis.awaHost}/account/personalization`
      },
      data: { id: this.borderId },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.data.success) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data?.message || response);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }

  async changeBadge(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('changing', chalk.yellow('Badge'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/badges/update/${this.userId}`,
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${globalThis.awaHost}`,
        referer: `https://${globalThis.awaHost}/account/personalization`
      },
      data: JSON.stringify(this.badgeIds.slice(0, 5)),
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.data.success) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data?.message || response);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }

  async changeAvatar(): Promise<boolean> {
    await this.getAvatar();
    const logger = new Logger(`${time()}${__('changing', chalk.yellow('Avatar'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/ajax/user/avatar/save/${this.userId}`,
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${globalThis.awaHost}`,
        referer: `https://${globalThis.awaHost}/avatar/edit/hat`
      },
      data: this.avatar,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.data.success) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data?.message || response);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }

  async sendViewTrack(link: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('sendingViewTrack', chalk.yellow(link))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/tos/track`,
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${globalThis.awaHost}`,
        referer: link
      },
      data: JSON.stringify({ url: link }),
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.data.success) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data?.message || response);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }

  async track(): Promise<any> {
    if (this.trackTimes % 3 === 0) {
      if (!this.questInfo.timeOnSite) {
        return new Logger(time() + chalk.yellow(__('noTimeOnSiteInfo')));
      }
      if (this.questInfo.timeOnSite.addedArp >= this.questInfo.timeOnSite.maxArp) {
        this.questStatus.timeOnSite = 'complete';
        this.EventEmitter.emit('complete');
        return new Logger(time() + chalk.green(__('timeOnSiteCompleted')));
      }
    }
    if (this.trackError >= 6) {
      return new Logger(`${time()}${chalk.red(__('trackError', chalk.yellow('AWA')))}`);
    }
    const logger = new Logger(`${time()}${__('sendingOnlineTrack', chalk.yellow('AWA'))}`, false);
    await this.sendTrack(undefined, logger);
    await sleep(60);
    this.track();
  }

  async sendTrack(link?: string, logger?: Logger): Promise<boolean> {
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/tos/track`,
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${globalThis.awaHost}`,
        referer: link || `https://${globalThis.awaHost}/account/personalization`
      },
      data: JSON.stringify({ url: link || `https://${globalThis.awaHost}/account/personalization` }),
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (!link) {
          if (response.data.success) {
            if (logger) ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
            this.trackError = 0;
            this.trackTimes++;
            return true;
          }
          if (logger) ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
          if (logger) new Logger(response.data?.message || response);
          this.trackError++;
          return false;
        }
        return true;
      })
      .catch((error) => {
        if (!link) {
          if (logger) ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
          globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
          if (logger) new Logger(error);
          this.trackError++;
          return false;
        }
        return true;
      });
  }

  async viewPost(postId?: string): Promise<boolean> {
    await this.openLink(`https://${globalThis.awaHost}/ucf/show/${postId}`);
    const logger = new Logger(`${time()}${__('sendingViewRecord', chalk.yellow(postId))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/ucf/increment-views/${postId}`,
      method: 'POST',
      headers: {
        ...this.headers,
        origin: `https://${globalThis.awaHost}`,
        referer: `https://${globalThis.awaHost}/ucf/show/${postId}`
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.data === 'success') {
          await this.sendTrack(`https://${globalThis.awaHost}/ucf/show/${postId}`);
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data || response.statusText);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async viewPosts(postIds?: Array<string>): Promise<boolean> {
    const posts = postIds || this.posts;
    if (!posts?.length) {
      return false;
    }
    for (const post of posts.slice(0, 3)) {
      await this.viewPost(post);
      await sleep(random(1, 5));
    }
    return true;
  }
  async replyPost(postId?: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('gettingRelatedPosts')}`, false);
    const getOptions: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/forums/board/113/awa-on-topic`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        referer: `https://${globalThis.awaHost}/`
      },
      Logger: logger
    };
    if (this.httpsAgent) getOptions.httpsAgent = this.httpsAgent;

    const post = postId || await axios(getOptions)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          const $ = load(response.data);
          const topicPost = $('.card-title a.forums__topic-link').toArray()
            .filter((e) => /Daily[\s]*?Quest/gi.test($(e).text()) && $(e).prev().attr('title') !== 'Locked')
            .map((e) => $(e).attr('href')?.match(/ucf\/show\/([\d]+)/)?.[1])
            .filter((e) => e);
          if (topicPost.length > 0) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
            return topicPost[0];
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.gray(__('noRelatedPosts')));
          return false;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });

    if (!post) {
      return false;
    }

    const logger1 = new Logger(`${time()}${__('replyingPost', chalk.yellow(post))}`, false);
    const form = new FormData();

    form.append('topic_post[content]', '<p>Thanks!</p>');
    form.append('topic_post[quotedPostIds]', '');
    form.append('topic_post[parentPost]', '');
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/comments/${post}/new/ucf`,
      method: 'POST',
      headers: {
        ...this.headers,
        origin: `https://${globalThis.awaHost}`,
        referer: `https://${globalThis.awaHost}/ucf/show/${post}`,
        ...form.getHeaders()
      },
      data: form,
      Logger: logger1
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.data.success) {
          this.postReplied = true;
          ((response.config as myAxiosConfig)?.Logger || logger1).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger1).log(chalk.red('Error(1)'));
        new Logger(response.data?.message || response);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger1).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async replyChecker(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('checkingReply')}`, false);
    const getOptions: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/account/arp-log?max=20`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        referer: `https://${globalThis.awaHost}/`
      },
      Logger: logger
    };
    if (this.httpsAgent) getOptions.httpsAgent = this.httpsAgent;

    return axios(getOptions)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          const $ = load(response.data);
          this.postReplied = !!$('.table.account__table tr').toArray().find((e) => $(e).text().includes('Add Post') && $(e).text().includes(dayjs().format('YYYY-MM-DD')));
          return this.postReplied;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }

  async sharePost(postId: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('sharingPost', chalk.yellow(postId))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/arp/quests/share/${postId}`,
      method: 'POST',
      headers: {
        ...this.headers,
        origin: `https://${globalThis.awaHost}`,
        referer: `https://${globalThis.awaHost}/ucf/show/${postId}`
      },
      responseType: 'json',
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        try {
          if (JSON.stringify(response.data) === '{}') {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
            return true;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
          new Logger(response.data);
          return false;
        } catch {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(2)'));
          new Logger(response.data);
          return false;
        }
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async sharePosts(postIds?: Array<string>): Promise<boolean> {
    const posts = postIds || this.posts;
    if (!posts?.length) {
      return false;
    }
    for (const post of posts.slice(0, 2)) {
      await this.sharePost(post);
      await sleep(random(1, 5));
    }
    return true;
  }
  async promoView(id: string, token: string): Promise<void> {
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/ajax/promo/view/${id}`,
      method: 'POST',
      headers: {
        ...this.headers,
        accept: '*/*',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${globalThis.awaHost}`,
        referer: `https://${globalThis.awaHost}/ucf/show/2162951/boards/awa-information/News/arp-6-0`
      },
      data: `token=${token}`
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    await axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
      })
      .catch(() => { });
  }
  async viewNews(): Promise<void> {
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/ucf/show/2162951/boards/awa-information/News/arp-6-0`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      }
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    await axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        const $ = load(response.data);
        const promoViewScriptHtml = $('script')
          .filter((i, script) => !!$(script).html()?.includes('/ajax/promo/view/'))
          .map((i, script) => $(script).html())
          .toArray();
        for (const scriptHtml of promoViewScriptHtml) {
          const [, urlId] = scriptHtml.match(/"\/ajax\/promo\/view\/([\d]+?)"/) || [];
          const [, token] = scriptHtml.match(/token:[\s]*?'(.+?)'/) || [];
          await this.promoView(urlId, token);
        }
      })
      .catch(() => { });
    await this.viewPost('2162951');
  }
  async openLink(link: string):Promise<void> {
    const logger = new Logger(`${time()}${__('visitingPage', chalk.yellow(link))}`, false);
    const options: myAxiosConfig = {
      url: link,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        referer: `https://${globalThis.awaHost}/`
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          const $ = load(response.data);
          if ($('a.nav-link-login').length > 0) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
            return;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
        return;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return;
      });
  }

  async questAward(questId: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('doingTask', chalk.yellow(questId))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/ajax/user/quest-award/${questId}`,
      method: 'get',
      headers: {
        ...this.headers,
        referer: `https://${globalThis.awaHost}/`
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then(async (response) => {
        if (response.status === 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data || response.statusText);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }

  async getPersonalization(): Promise<number> {
    const logger = new Logger(`${time()}${__('gettingUserInfo', chalk.yellow('Personalization'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/account/personalization`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          const $ = load(response.data);
          if ($('a.nav-link-login').length > 0) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
            return 602;
          }
          const [, , awaUserId] = response.data.match(/(var|let)[\s]+?user_id[\s]*?=[\s]*?([\d]+);/);
          const [, , awaBorderId] = response.data.match(/(var|let)[\s]+?selectedBorder[\s]*?=[\s]*?([\d]+);/) || [];
          // const [, , awaBadgeIds] = response.data.match(/(var|let)[\s]+?selectedBadges[\s]*?=[\s]*?\[(([\d]+)(,[\d]+)*?)\];/) || [];
          this.userId = awaUserId;
          /*
          if (!awaBorderId && !awaBadgeIds) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('noBorderAndBadges')}`));
            return 603;
          }
          */
          if (!awaBorderId) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('noBorder')}`));
            return 604;
          }
          /*
          if (!awaBadgeIds) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('noBadges')}`));
            return 405;
          }
          */
          this.borderId = awaBorderId;
          // this.badgeIds = awaBadgeIds.split(',');
          fs.writeFileSync('awa-info.json', JSON.stringify({
            awaUserId: this.userId,
            awaBorderId: this.borderId,
            awaBadgeIds: this.badgeIds,
            awaAvatar: this.avatar
          }));
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return 200;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
        new Logger(response.data || response.statusText);
        return 0;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return 0;
      });
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getAvatar(): Promise<number> {
    const logger = new Logger(`${time()}${__('gettingUserInfo', chalk.yellow('Avatar'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/avatar/edit`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        referer: `https://${globalThis.awaHost}/account/personalization`
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          const $ = load(response.data);
          if ($('a.nav-link-login').length > 0) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
            return 602;
          }
          const awaAvatar = JSON.stringify({
            body: null, hat: null, top: null, item: null, legs: null, ...Object.fromEntries($('.drag-drop').toArray().map((e) => {
              const slotType = $(e).attr('data-slot-type')?.split('-')[0];
              const altimg = $(e).attr('data-altImg');
              const data: {
                id?: string
                img?: string
                slotType?: string
                altimg?: string
              } = {
                id: $(e).attr('data-id'),
                img: $(e).attr('data-img'),
                slotType: $(e).attr('data-slot-type')
              };
              if (altimg) {
                data.altimg = altimg;
              }
              return [slotType, data];
            }))
          });
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          this.avatar = awaAvatar;
          fs.writeFileSync('awa-info.json', JSON.stringify({
            awaUserId: this.userId,
            awaBorderId: this.borderId,
            awaBadgeIds: this.badgeIds,
            awaAvatar: this.avatar
          }));
          return 200;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
        return 0;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return 0;
      });
  }
  matchQuest(dailyQuestName: string): Array<string> {
    const logger = new Logger(`${time()}${__('matchingDailyQuestDb')}`, false);
    if (!dailyQuestName) {
      logger.log(chalk.yellow(__('notMatchedDailyQuest')));
      return [];
    }
    const { quests } = dailyQuestDbJson;

    let matchedQuest = Object.entries(quests).map(([key, value]) => (value.includes(dailyQuestName) ? key : '')).filter((e) => e);
    if (matchedQuest.length > 0) {
      logger.log(chalk.green(__('success')));
      return matchedQuest;
    }
    matchedQuest = Object.entries(quests).map(([key, value]) => (value.map((e) => e.toLowerCase()).includes(dailyQuestName.toLowerCase()) ? key : '')).filter((e) => e);
    if (matchedQuest.length > 0) {
      logger.log(chalk.green(__('success')));
      return matchedQuest;
    }
    matchedQuest = Object.entries(quests).map(([key, value]) => (value.map((e) => e.toLowerCase().replace(/,|\.|\/|\\|'|"|:|;|!|#|\*|\?|<|>|\[|\]|\{|\}|\+|-|=|`|@|\$|%|\^|&|\(|~|\)|\||[\s]/g, '')).includes(dailyQuestName.toLowerCase().replace(/,|\.|\/|\\|'|"|:|;|!|#|\*|\?|<|>|\[|\]|\{|\}|\+|-|=|`|@|\$|%|\^|&|\(|~|\)|\||[\s]/g, '')) ? key : '')).filter((e) => e);
    if (matchedQuest.length > 0) {
      logger.log(chalk.green(__('success')));
      return matchedQuest;
    }
    logger.log(chalk.yellow(__('notMatchedDailyQuest')));
    return [];
  }
  async getSteamCommunityEventPath(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('gettingSteamCommunityEventPath')}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/steam/events`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        referer: `https://${globalThis.awaHost}`
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          if (response.data.includes('concluded')) {
            return true;
          }
          const $ = load(response.data);
          this.steamCommunityEventPath = $('a[href*="/steam/community-event"]').attr('href')?.split('/')
            ?.at(-1);
          if (this.steamCommunityEventPath) {
            return true;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Unknown Error'));
          return false;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async getSteamCommunityEvent(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('gettingSteamCommunityEvent')}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/steam/community-event/${this.steamCommunityEventPath}`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        referer: `https://${globalThis.awaHost}`
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          if (response.data.includes('concluded')) {
            return true;
          }
          const $ = load(response.data);
          const eventTime = $('#main h1').next('div.text-light').text()
            .trim();
          const [startTime, endTime] = eventTime.split('-').map((e) => e.trim());
          if (dayjs().isAfter(dayjs(endTime)) || dayjs().isBefore(dayjs(startTime))) {
            return true;
          }
          let checkOwnedGamesStatus = false;
          const playedTime = `${$('div.progress-bar.bg-info').eq(-2).attr('aria-valuenow')}min` || '-';
          const totalTime = `${$('div.progress-bar.bg-info').eq(-2).attr('aria-valuemax')}min` || '-';
          const gameName = $('h1').text();
          const gameId = $('a.btn-steam-community-event[href^="steam://run/"]').attr('href')?.match(/[\d]+/)?.[0] || '';
          if (gameId) {
            globalThis.steamEventGameId = gameId;
          }
          if ($('a.btn-check-owned-games').length > 0) {
            if (!await this.checkOwnedGames(`[${gameName}](${gameId})`)) {
              new Logger(chalk.yellow(`${__('notOwnedGame', chalk.blue(`[${gameName}](${gameId})`))}`));
              this.steamCommunityEventInfo = {
                status: __('notOwnedGame', `[${gameName}](${gameId})`),
                playedTime,
                totalTime
              };
              return false;
            }
            checkOwnedGamesStatus = true;
          }
          if (checkOwnedGamesStatus || $('a.enter-event-btn.btn-steam-community-event').length > 0) {
            if (await this.enterSteamCommunityEvent()) {
              this.steamCommunityEventInfo = {
                status: __('joined'),
                playedTime,
                totalTime
              };
              return true;
            }
            this.steamCommunityEventInfo = {
              status: __('notJoined'),
              playedTime,
              totalTime
            };
            return false;
          }
          this.steamCommunityEventInfo = {
            status: __('joined'),
            playedTime,
            totalTime
          };
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async checkSteamCommunityEventStatus(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('checkingSteamCommunityEventStatus')}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/steam/community-event/${this.steamCommunityEventPath}`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        referer: `https://${globalThis.awaHost}`
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          if (response.data.includes('concluded')) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
            globalThis.steamEventGameId = '';
            return true;
          }
          const $ = load(response.data);
          const playedTime = parseInt(response.data.match(/personalPlaytime.*?=.*?([\d]+)/)?.[1] || '0', 10);
          const totalTime = parseInt($('div.progress-bar.bg-info').eq(-2).attr('aria-valuemax') || '0', 10);
          this.steamCommunityEventInfo = {
            status: __('joined'),
            playedTime: `${playedTime}`,
            totalTime: `${totalTime}min`
          };
          if (playedTime >= totalTime) {
            globalThis.steamEventGameId = '';
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(`${chalk.green('OK')}(${chalk.yellow(`${playedTime}/${totalTime}min`)})`);
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async checkOwnedGames(gameInfo: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('checkingOwnedGames', gameInfo)}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/ajax/user/steam/community-event/check-owned-games/${this.steamCommunityEventPath}`,
      method: 'GET',
      headers: {
        ...this.headers,
        origin: `https://${globalThis.awaHost}`,
        referer: `https://${globalThis.awaHost}/steam/community-event/${this.steamCommunityEventPath}`
      },
      responseType: 'json',
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          if (response.data?.installed === true) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('owned')));
            return true;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__('notOwned')));
          return false;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(1): ${response.status}`));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async enterSteamCommunityEvent(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('enteringSteamCommunityEvent')}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/ajax/user/steam/community-event/start/${this.steamCommunityEventPath}`,
      method: 'GET',
      headers: {
        ...this.headers,
        origin: `https://${globalThis.awaHost}`,
        referer: `https://${globalThis.awaHost}/steam/community-event/${this.steamCommunityEventPath}`
      },
      responseType: 'json',
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          if (response.data?.success === true) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__(response.data.message || 'OK')));
            return true;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__(response.data?.message || 'Error(2)')));
          return false;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error(1): ${response.status}`));
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }

  async getBoosters(page = 1): Promise<number> {
    const logger = new Logger(`${time()}${__('gettingBoosters', chalk.yellow(page))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/account/my-rewards/arp_boost/${page}`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          const $ = load(response.data);
          if ($('a.nav-link-login').length > 0) {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
            return 602;
          }
          $('#user-account__user-reward-list .user-account__user-reward-wrapper').toArray().forEach((el) => {
            const [, ratio, time] = $(el).find('.align-self-start').text()
              .trim()
              .match(/([\d]+?)x[\s]*?([\d]+?)h/) || [];
            const rewardedTime = $(el).find('.align-self-end').text()
              .trim()
              .match(/REWARDED[\s]*?([\d]+?-[\d]+?-[\d]+)/)?.[1];
            const id = $(el).find('.user-account__user-reward').attr('data-id');
            const activateId = $(el).find('.account-reward__activate').attr('href')
              ?.match(/boosts\/activate\/([\d]+)/)?.[1];
            if (!id || !ratio || !time || !rewardedTime || !activateId) {
              return null;
            }

            const boosterInfo: boosters = {
              id,
              activateId,
              ratio,
              time,
              rewardedTime
            };

            if (!this.boosters[`${ratio}-${time}`]) {
              this.boosters[`${ratio}-${time}`] = [];
            }

            if (this.boosters[`${ratio}-${time}`].find((bst) => bst.id === boosterInfo.id)) {
              return null;
            }

            this.boosters[`${ratio}-${time}`].push(boosterInfo);
          });

          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          if ($('.page-item.active')?.next()?.hasClass('disabled') || $('.page-item.active>a.page-link')?.attr('data-page') !== `${page}`) {
            return 200;
          }
          return this.getBoosters(page + 1);
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
        return 0;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return 0;
      });
  }
  async activateBooster(info: boosters): Promise<boolean> {
    const logger = new Logger(`${time()}${__('activatingBoosters', chalk.yellow(`${info.ratio}x ${info.time}hr ARP Boost`), chalk.blue(`REWARDED ${info.rewardedTime}`))}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/account/boosts/activate/${info.activateId}`,
      method: 'GET',
      headers: {
        ...this.headers,
        referer: `https://${globalThis.awaHost}/account/my-rewards/arp_boost`,
        accept: '*/*'
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.data.success) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data?.message || response);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }
  async getTwitchTech(): Promise<boolean> {
    if (!this.userProfileUrl) return false;
    const logger = new Logger(`${time()}${__('gettingTwitchTech')}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}${this.userProfileUrl}/artifacts`,
      method: 'GET',
      headers: {
        ...this.headers,
        referer: `${globalThis.awaHost}`
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        const { userActiveArtifacts } = JSON.parse(`{${response.data.match(/artifactsData.*?=.*?{(.+?)};/m)?.[1] || ''}}`) || {};
        if (userActiveArtifacts) {
          Object.values(userActiveArtifacts).forEach((artifact: any) => {
            this.additionalTwitchARP += parseFloat(artifact?.perkTextShort?.match(/Twitch quests by ([\d]+)/)?.[1] || '0');
          });
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data?.message || response);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return false;
      });
  }

  /*
  async updateDailyQuestDb(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('updatingDailyQuestDb')}`, false);
    const options: myAxiosConfig = {
      url: 'https://awa-helper.hclonely.com/dailyQuestDb.json',
      method: 'GET',
      responseType: 'json',
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        if (response.data) {
          fs.writeFileSync('dailyQuestDbCloud.json', JSON.stringify(response.data));
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response);
        return false;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        new Logger(error);
        return false;
      });
  }
  async getPromotionalCalendarItem() {
    try {
      if (!this.promotionalCalendarInfo) {
        return;
      }
      const launchOptions: LaunchOptions = {
        // headless: false,
        timeout: 3 * 60000
      };
      if (this.proxy) {
        launchOptions.proxy = this.proxy;
      }
      if (process.env.CHROME_BIN) {
        launchOptions.executablePath = process.env.CHROME_BIN;
      }
      const browser = await chromium.launch(launchOptions);
      const context = await browser.newContext({
        userAgent: globalThis.userAgent
      });
      context.setDefaultTimeout(3 * 60000);
      await context.addCookies(this.cookie.browserify());

      const page = await context.newPage();
      let logger = new Logger(`${time()}${__('openingPage', chalk.yellow(`https://${globalThis.awaHost}/`))}`, false);
      await page.goto(`https://${globalThis.awaHost}/`);
      logger.log(chalk.green('OK'));
      await sleep(random(3, 5));
      await page.screenshot({ path: 'temp/homepage.png', fullPage: true });

      logger = new Logger(`${time()}${__('gettingItem')}`, false);
      await page.locator('button.promotional-calendar__day-claim:visible').click();
      await page.screenshot({ path: 'temp/gettingItem.png', fullPage: true });
      try {
        // eslint-disable-next-line no-undef
        await page.waitForFunction((selector) => !!document.querySelector(selector) && window.getComputedStyle(document.querySelector(selector) as Element).display !== 'none', `#claimed-${this.promotionalCalendarInfo.id}`);
        // await page.locator(`#claimed-${this.promotionalCalendarInfo.id}:visible`).waitFor({ state: 'visible' });
        await page.screenshot({ path: 'temp/gotItem.png', fullPage: true });
      } catch (e) {
        await page.locator('button.promotional-calendar__day-claim:visible').click();
        await page.screenshot({ path: 'temp/gettingItem-1.png', fullPage: true });
        // eslint-disable-next-line no-undef
        await page.waitForFunction((selector) => !!document.querySelector(selector) && window.getComputedStyle(document.querySelector(selector) as Element).display !== 'none', `#claimed-${this.promotionalCalendarInfo.id}`);
        // await page.locator(`#claimed-${this.promotionalCalendarInfo.id}:visible`).waitFor({ state: 'visible' });
        await page.screenshot({ path: 'temp/gotItem-1.png', fullPage: true });
      }
      this.promotionalCalendarInfo.finished = true;
      logger.log(chalk.green('OK'));
      return true;
    } catch (error) {
      new Logger(`\n${time()}${__('gettingPromotionalCalendarItemError')}`);
      new Logger(error);
      return false;
    }
  }
  */
  formatQuestInfo() {
    const result = {
      [`${__('dailyTask', '')}[${this.dailyQuestName[0]}]`]: {
        // eslint-disable-next-line no-nested-ternary
        [__('status')]: this.questInfo.dailyQuest?.[0]?.status === 'complete' ? __('done') : (this.questStatus.dailyQuest === 'skip' ? __('skipped') : __('undone')),
        [__('obtainedARP')]: this.questInfo.dailyQuest?.[0]?.arp?.split('+')?.[0] || '0',
        [__('extraARP')]: this.questInfo.dailyQuest?.[0]?.arp?.split('+')?.[1] || '0',
        [__('maxAvailableARP')]: this.questInfo.dailyQuest?.[0]?.arp?.split('+')?.map((num) => parseInt(num, 10))?.reduce((acr, cur) => acr + cur) || 0
      },
      [__('timeOnSite')]: {
        [__('status')]: this.questInfo.timeOnSite?.addedArp === this.questInfo.timeOnSite?.maxArp ? __('done') : __('undone'),
        [__('obtainedARP')]: this.questInfo.timeOnSite?.addedArp,
        [__('extraARP')]: this.questInfo.timeOnSite?.addedArpExtra || '0',
        [__('maxAvailableARP')]: this.questInfo.timeOnSite?.maxArp
      },
      [__('watchTwitch')]: {
        [__('status')]: (parseInt(this.questInfo.watchTwitch?.[0] || '0', 10) + parseFloat(this.questInfo.watchTwitch?.[1] || '0')) >= (15 + this.additionalTwitchARP) ? __('done') : __('undone'),
        [__('obtainedARP')]: this.questInfo.watchTwitch?.[0] || '0',
        [__('extraARP')]: this.questInfo.watchTwitch?.[1],
        [__('maxAvailableARP')]: 15 + this.additionalTwitchARP
      }
    };
    if (this.questInfo.steamQuest && this.questInfo.steamQuest.length > 0) {
      this.questInfo.steamQuest.forEach((questInfo) => {
        result[`${__('steamQuest')}([${questInfo.name}])`] = {
          // eslint-disable-next-line no-nested-ternary
          [__('status')]: questInfo.status === 'complete' ? __('done') : __('undone'),
          [__('obtainedARP')]: questInfo.status === 'complete' ? (questInfo.maxAvailableARP?.split('+')?.[0] || '0') : '0',
          [__('extraARP')]: questInfo.status === 'complete' ? (questInfo.maxAvailableARP?.split('+')?.[1] || '0') : '0',
          [__('maxAvailableARP')]: questInfo.maxAvailableARP
        };
      });
    }
    if (!this.dailyQuestName[0]) {
      delete result[`${__('dailyTask', '')}[${this.dailyQuestName[0]}]`];
    }
    if (this.questInfo.dailyQuest && this.questInfo.dailyQuest.length > 1) {
      for (let i = 1; i < this.questInfo.dailyQuest.length; i++) {
        result[`${__('dailyTask', '')}[${this.dailyQuestName[i]}]`] = {
          // eslint-disable-next-line no-nested-ternary
          [__('status')]: this.questInfo.dailyQuest?.[i]?.status === 'complete' ? __('done') : (this.questStatus.dailyQuest === 'skip' ? __('skipped') : __('undone')),
          [__('obtainedARP')]: this.questInfo.dailyQuest?.[i]?.arp?.split('+')?.[0] || '0',
          [__('extraARP')]: this.questInfo.dailyQuest?.[i]?.arp?.split('+')?.[1] || '0',
          [__('maxAvailableARP')]: this.questInfo.dailyQuest?.[i]?.arp?.split('+')?.map((num) => parseInt(num, 10))?.reduce((acr, cur) => acr + cur) || 0
        };
      }
    }
    if (this.questInfo.dailyQuestUS && this.questInfo.dailyQuestUS.length > 0) {
      for (const questInfo of this.questInfo.dailyQuestUS) {
        result[`${__('dailyTask', this.taskType)}[${questInfo.title}]`] = {
          // eslint-disable-next-line no-nested-ternary
          [__('status')]: parseInt(questInfo.arp, 10) > 0 ? __('done') : __('undone'),
          [__('obtainedARP')]: questInfo.arp,
          [__('extraARP')]: questInfo.extraArp || '0',
          [__('maxAvailableARP')]: '-',
          link: questInfo.link
        };
      }
    }
    if (this.promotionalCalendarInfo) {
      result[__('promotionalCalendar')] = {
        // eslint-disable-next-line no-nested-ternary
        [__('status')]: this.promotionalCalendarInfo.finished ? __('done') : __('undone'),
        [__('obtainedARP')]: this.promotionalCalendarInfo.name,
        [__('extraARP')]: '-',
        [__('maxAvailableARP')]: '-'
      };
    }
    if (this.steamCommunityEventInfo) {
      result[__('steamCommunityEvent')] = {
        // eslint-disable-next-line no-nested-ternary
        [__('status')]: this.steamCommunityEventInfo.status,
        [__('obtainedARP')]: this.steamCommunityEventInfo.playedTime,
        [__('extraARP')]: '-',
        [__('maxAvailableARP')]: this.steamCommunityEventInfo.totalTime
      };
    }
    return result;
  }
}

export { DailyQuest };
