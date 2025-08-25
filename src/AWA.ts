/*
 * @Author       : HCLonely
 * @Date         : 2025-08-22 11:03:33
 * @LastEditTime : 2025-08-25 10:29:58
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/AWA.ts
 * @Description  : AWA主类
 */
/* global __, proxy, questInfo, awaInfo, myAxiosConfig */
import { RawAxiosRequestHeaders } from 'axios';
import { load } from 'cheerio';
import * as chalk from 'chalk';
import * as FormData from 'form-data';
import { Logger, sleep, random, time, netError, http as axios, formatProxy, Cookie } from './tool';

import * as fs from 'fs';
import { chunk } from 'lodash';
import * as dayjs from 'dayjs';
import { execSync } from 'child_process';
import * as os from 'os';

class AWA {
  headers: RawAxiosRequestHeaders;
  cookie: Cookie;
  httpsAgent!: myAxiosConfig['httpsAgent'];
  userId!: string;
  borderId!: string;
  avatar!: string;
  dailyQuestLink!: string;
  clickQuestId?: string | undefined;
  dailyQuestName!: Array<string>;
  newCookie: string;
  proxy?: {
    server: string
    username?: string
    password?: string
  };
  questInfo: questInfo = {};
  userProfileUrl!: string;
  additionalTwitchARP = 0;
  signArp: {
    daily?: string,
    monthly?: string
  } = {};
  promotionalCalendarInfo?: Array<{
    name: string,
    day: string,
    finished?: boolean
  }>;
  dailyArp = '0';
  getStarted = false;
  tasksFinished!: Map<string, boolean>;
  taskType: string = 'New';
  joinSteamCommunityEvent = false;
  steamCommunityEventPath?: string;
  awaDailyQuestNumber1: boolean;
  dailyQuestNumber = 0;
  posts!: Array<string>;
  trackError = 0;
  trackTimes = 0;
  postReplied: null | boolean = null;
  steamCommunityEventInfo?: {
    status: string,
    playedTime: string,
    totalTime: string
  };

  constructor({ awaCookie, proxy, joinSteamCommunityEvent, awaDailyQuestNumber1, getStarted }: {
    awaCookie: string
    proxy?: proxy
    joinSteamCommunityEvent?: boolean
    awaDailyQuestNumber1?: boolean
    getStarted?: boolean
  }) {
    this.newCookie = awaCookie;
    this.cookie = new Cookie(awaCookie);
    this.headers = {
      cookie: this.cookie.stringify(),
      'user-agent': globalThis.userAgent,
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6'
    };

    if (proxy?.enable?.includes('awa') && proxy.host && proxy.port) {
      this.httpsAgent = formatProxy(proxy);
      this.proxy = {
        server: `${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`,
        username: proxy.username,
        password: proxy.password
      };
    }
    this.joinSteamCommunityEvent = !!joinSteamCommunityEvent;
    this.awaDailyQuestNumber1 = awaDailyQuestNumber1 ?? true;
    this.getStarted = !!getStarted;
  }

  async init(): Promise<number> {
    await this.updateCookie();
    const result = await this.updateDailyQuests(true);
    if (result !== 200) {
      return result;
    }
    if (fs.existsSync('.awa-info.json')) {
      const { awaUserId, awaBorderId, awaAvatar } = JSON.parse(fs.readFileSync('.awa-info.json').toString()) as awaInfo;
      this.userId = awaUserId;
      this.borderId = awaBorderId;
      this.avatar = awaAvatar;
      if (!(awaUserId && awaBorderId)) {
        const result = await this.getPersonalization();
        if (result !== 200) {
          return result;
        }
      }
    } else if (!(await this.getPersonalization())) {
      return 603;
    }
    this.newCookie = this.cookie.stringify();

    return 200;
  }

  async updateCookie(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('updatingCookie', chalk.yellow('AWA Cookie'))}...`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}/`,
      method: 'GET',
      headers: {
        ...this.headers,
        cookie: this.cookie.stringify(),
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
        if (!response.headers['set-cookie']?.length) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        this.headers.cookie = this.cookie.update(response.headers['set-cookie']).stringify();
        if (response.status === 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        if (response.status === 302) {
          const homeSite = this.cookie.get('home_site');
          if (homeSite && globalThis.awaHost !== homeSite) {
            globalThis.awaHost = homeSite;
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__('redirected')));
            return this.updateCookie();
          }
          if (this.cookie.get('REMEMBERME') === 'deleted') {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('cookieExpired', chalk.yellow('awaCookie'))}`));
            return false;
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

  async listen(): Promise<void> {
    await this.updateDailyQuests();
    await sleep(60 * 5);
    this.listen();
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

        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
          return response.status;
        }

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
              // 处理错误
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
                const rewardItem = $(`#monthly-days-${week} .calendar-rewards__day[data-day="${monthlyLogins.count}"] .calendar-rewards__reward img[data-bs-title]`).attr('data-bs-title')?.trim();
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
              // 处理错误
            }
          }

          // 活动奖励
          const getItemBtn = $('.promotional-calendar__day-claim').filter((i, e) => /GET[\s]*?ITEM/gi.test($(e).text().trim()));
          if (getItemBtn.length > 0) {
            new Logger(`${time()}${chalk.green(__('promotionalAlert'))}`);
          }

          // Steam社区活动
          if (this.joinSteamCommunityEvent) {
            if (await this.getSteamCommunityEventPath() && this.steamCommunityEventPath) {
              await this.getSteamCommunityEvent();
            }
          }

          if (this.getStarted) {
            const getStartedItems = $('.onboarding_items .onboarding_item').has('i.fa-square').toArray()
              .map((e) => ({
                name: $(e).find('a.onboarding-link').text()
                  .trim(),
                link: $(e).find('a.onboarding-link').attr('href') as string
              }));
            if (getStartedItems.length > 0) {
              await this.doGetStartQuest(getStartedItems);
            }
          }
        }

        if (this.joinSteamCommunityEvent && this.steamCommunityEventPath) {
          await this.checkSteamCommunityEventStatus();
        }

        // 推广活动
        const promotionalCalendarDiv = $('div.promotional-calendar__day');
        const promotionalCalendar = promotionalCalendarDiv.filter((i, e) => $(e).text().includes('GET ITEM'));
        if (promotionalCalendar.length > 0) {
          this.promotionalCalendarInfo = promotionalCalendar.map((i, e) => ({
            name: $(e).find('.promotional-calendar__day-info h1').text()
              .trim(),
            day: `Day ${$(e).attr('data-day')}`,
            finished: false
          })).toArray();
        } else {
          this.promotionalCalendarInfo = promotionalCalendarDiv.filter((i, e) => $(e).text().includes('My Rewards'))
            .last()
            .toArray()
            .map((e) => ({
              name: $(e).find('.promotional-calendar__day-info h1').text()
                .trim(),
              day: `Day ${$(e).attr('data-day')}`,
              finished: true
            }));
        }

        // AWA 在线任务
        if (!this.questInfo.timeOnSite) {
          this.questInfo.timeOnSite = {
            maxArp: '5',
            addedArp: '0',
            addedArpExtra: '0'
          };
        }
        const dailyArpDataRaw = response.data.match(/dailyArpData.*?=.*?({.+?}})/)?.[1];
        if (dailyArpDataRaw) {
          try {
            const dailyArpData = JSON.parse(dailyArpDataRaw);
            this.questInfo.timeOnSite.maxArp = `${dailyArpData.timeOnSiteCap}`;
            this.questInfo.timeOnSite.addedArp = `${dailyArpData.timeOnSiteArp}`;
            this.questInfo.watchTwitch = [`${dailyArpData.twitchData.totalPoints}`, `${dailyArpData.twitchData.bonusPoints}`];
            this.dailyArp = `${dailyArpData.dailyArp}`;
          } catch (e) {
            console.log(e);
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

        // 每日任务
        const cardBody = $('div.user-profile__card-body');
        cardBody.eq(0).find('.card-table-row')
          .each((i, e) => {
            if ($(e).find('.quest-item-progress').length === 1) {
              $(e).append('<span class="quest-item-progress">0 ARP</span>');
            }
          });
        const dailyQuests = chunk(
          cardBody.eq(0).find('.card-table-row')
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
        this.dailyQuestName = cardBody.eq(0).find('.card-table-row')
          .filter((i, e) => !$(e).text().includes('ARP 6.0') && $(e).find('a[href^="/quests"]').length === 0)
          .find('.quest-title')
          .toArray()
          .map((e) => $(e).text().trim()) || ['None'];
        this.questInfo.dailyQuest = dailyQuest.map(([status, arp]: Array<string>) => ({
          status, arp: arp.match(/[\d\s+]+/)?.[0]?.split('+')[0].trim() || '0',
          extraArp: arp.match(/[\d\s+]+/)?.[0]?.split('+')[1]?.trim() || '0'
        }));
        this.dailyQuestNumber = cardBody.eq(0).find('.card-table-row')
          .filter((i, e) => $(e).find('a[href^="/quests"]').length === 0)
          .find('.quest-item-progress')
          .map((i, e) => $(e).text().trim()
            .toLowerCase())
          .filter((i, e) => e === 'incomplete').length;

        this.clickQuestId = $('a.quest-title[data-award-on-click="true"][href]').filter((i, e) => !/^\/quests\//.test($(e).attr('href') as string)).attr('data-quest-id');

        // Steam 挂机任务
        this.questInfo.steamQuest = cardBody.eq(1).find('.card-table-row')
          .map((i, e) => ({
            name: $(e).find('.quest-list__quest-details div').eq(0)
              .text()
              .trim(),
            status: $(e).find('[id^=control-center__steam-quest-status-]').text()
              .trim()
              .toLowerCase(),
            maxAvailableARP: $(e).find('[id^=control-center__steam-quest-reward-]').text()
              .match(/[\d\s+]+/)?.[0].trim() || '0'
          }))
          .toArray();

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
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return 0;
      });
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
  // async replyChecker(): Promise<boolean> {
  //   const logger = new Logger(`${time()}${__('checkingReply')}`, false);
  //   const getOptions: myAxiosConfig = {
  //     url: `https://${globalThis.awaHost}/account/arp-log?max=20`,
  //     method: 'GET',
  //     headers: {
  //       ...this.headers,
  //       accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
  //       referer: `https://${globalThis.awaHost}/`
  //     },
  //     Logger: logger
  //   };
  //   if (this.httpsAgent) getOptions.httpsAgent = this.httpsAgent;

  //   return axios(getOptions)
  //     .then((response) => {
  //       globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
  //       if (response.status === 200) {
  //         const $ = load(response.data);
  //         this.postReplied = !!$('.table.account__table tr').toArray().find((e) => $(e).text().includes('Add Post') && $(e).text().includes(dayjs().format('YYYY-MM-DD')));
  //         return this.postReplied;
  //       }
  //       ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
  //       return false;
  //     })
  //     .catch((error) => {
  //       ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
  //       globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
  //       new Logger(error);
  //       return false;
  //     });
  // }

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
  async openLink(link: string): Promise<void> {
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

        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
          new Logger(response.data || response.statusText);
          return 0;
        }
        const $ = load(response.data);
        if ($('a.nav-link-login').length > 0) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
          return 602;
        }

        const [, , awaUserId] = response.data.match(/(var|let)[\s]+?user_id[\s]*?=[\s]*?([\d]+);/);
        const [, , awaBorderId] = response.data.match(/(var|let)[\s]+?selectedBorder[\s]*?=[\s]*?([\d]+);/) || [];
        this.userId = awaUserId;

        if (!awaBorderId) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('noBorder')}`));
          return 604;
        }

        this.borderId = awaBorderId;
        fs.writeFileSync('.awa-info.json', JSON.stringify({
          awaUserId: this.userId,
          awaBorderId: this.borderId,
          awaAvatar: this.avatar
        }));
        if (os.type() === 'Windows_NT') {
          try {
            execSync('attrib +h .awa-info.json');
          } catch (e) {
            //
          }
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        return 200;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return 0;
      });
  }

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

        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
          return 0;
        }

        const $ = load(response.data);
        if ($('a.nav-link-login').length > 0) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
          return 602;
        }

        const awaAvatar = JSON.stringify({
          body: null, hat: null, top: null, item: null, legs: null,
          ...Object.fromEntries($('.drag-drop').toArray().map((e) => [$(e).attr('data-slot-type')?.split('-')[0], {
            id: $(e).attr('data-id'),
            img: $(e).attr('data-img'),
            slotType: $(e).attr('data-slot-type'),
            altimg: $(e).attr('data-altImg') || undefined
          }]))
        });

        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        this.avatar = awaAvatar;
        fs.writeFileSync('.awa-info.json', JSON.stringify({
          awaUserId: this.userId,
          awaBorderId: this.borderId,
          awaAvatar: this.avatar
        }));
        if (os.type() === 'Windows_NT') {
          try {
            execSync('attrib +h .awa-info.json');
          } catch (e) {
            //
          }
        }
        return 200;
      })
      .catch((error) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(error.response?.headers?.['set-cookie']))])];
        new Logger(error);
        return 0;
      });
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

        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
          return false;
        }

        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));

        if (response.data.includes('concluded')) {
          return true;
        }

        if (response.data.includes('EVENT IS CLOSED')) {
          this.steamCommunityEventPath = '';
          return false;
        }

        const $ = load(response.data);
        const eventTime = $('#main h1').next('div.text-light').text()
          .trim();
        const [startTime, endTime] = eventTime.split('-').map((e) => e.trim());

        if (dayjs().isAfter(dayjs(endTime)) || dayjs().isBefore(dayjs(startTime))) {
          return true;
        }

        const playedTime = `${$('div.progress-bar.bg-info').eq(-2).attr('aria-valuenow')}min` || '-';
        const totalTime = `${$('div.progress-bar.bg-info').eq(-2).attr('aria-valuemax')}min` || '-';
        const gameName = $('h1').text();
        const gameId = $('a.btn-steam-community-event[href^="steam://run/"]').attr('href')?.match(/[\d]+/)?.[0] || '';

        if (gameId) {
          globalThis.steamEventGameId = gameId;
        }

        this.steamCommunityEventInfo = {
          status: __('notJoined'),
          playedTime,
          totalTime
        };
        if ($('a.btn-check-owned-games').length > 0) {
          if (!await this.checkOwnedGames(`[${gameName}](${gameId})`)) {
            new Logger(chalk.yellow(`${__('notOwnedGame', chalk.blue(`[${gameName}](${gameId})`))}`));
            this.steamCommunityEventInfo.status = __('notOwnedGame', `[${gameName}](${gameId})`);
            return false;
          }
        }

        if (await this.enterSteamCommunityEvent()) {
          this.steamCommunityEventInfo.status = __('joined');
          return true;
        }

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

        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
          return false;
        }

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
          this.steamCommunityEventInfo.status = __('done');
        }

        ((response.config as myAxiosConfig)?.Logger || logger).log(`${chalk.green('OK')}(${chalk.yellow(`${playedTime}/${totalTime}min`)})`);
        return true;
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

  async doGetStartQuest(itemsInfo: Array<{ name: string, link: string }>, index = 0): Promise<boolean> {
    const itemInfo = itemsInfo[index];
    const logger = new Logger(`${time()}${__('doingGetStartedQuest', itemInfo.name)}`, false);
    const options: myAxiosConfig = {
      url: `https://${globalThis.awaHost}${itemInfo.link}`,
      method: 'GET',
      headers: {
        ...this.headers,
        origin: `https://${globalThis.awaHost}`,
        referer: `https://${globalThis.awaHost}/control-center`
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    const result = await axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets, ...Object.values(Cookie.ToJson(response.headers?.['set-cookie']))])];
        if (response.status === 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green(__('OK')));
          return true;
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

    if (index < itemsInfo.length - 1) {
      return this.doGetStartQuest(itemsInfo, index + 1);
    }
    return result;
  }

  formatQuestInfo() {
    const result = {
      [`${__('dailyTask', '')}[${this.dailyQuestName[0]}]`]: {
        // eslint-disable-next-line no-nested-ternary
        [__('status')]: this.questInfo.dailyQuest?.[0]?.status === 'complete' ? __('done') : __('undone'),
        // [__('status')]: this.questInfo.dailyQuest?.[0]?.status === 'complete' ? __('done') : (this.questStatus.dailyQuest === 'skip' ? __('skipped') : __('undone')),
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
          [__('status')]: this.questInfo.dailyQuest?.[i]?.status === 'complete' ? __('done') : __('undone'),
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
    if (this.promotionalCalendarInfo && this.promotionalCalendarInfo.length > 0) {
      this.promotionalCalendarInfo.forEach((calendarInfo) => {
        result[`${__('promotionalCalendar')}[${calendarInfo.day}]`] = {
          // eslint-disable-next-line no-nested-ternary
          [__('status')]: calendarInfo.finished ? __('done') : __('undone'),
          [__('obtainedARP')]: calendarInfo.name,
          [__('extraARP')]: '-',
          [__('maxAvailableARP')]: calendarInfo.name
        };
      });
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

export { AWA };
