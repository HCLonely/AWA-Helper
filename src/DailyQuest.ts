/* eslint-disable max-len */
/* global __, questStatus, proxy, awaInfo, dailyQuestDb */
import { AxiosRequestConfig, AxiosRequestHeaders } from 'axios';
import { load } from 'cheerio';
import * as chalk from 'chalk';
import * as FormData from 'form-data';
import { log, sleep, random, time, netError, ask, http as axios, formatProxy } from './tool';
import { TwitchTrack } from './TwitchTrack';
import { SteamQuestASF } from './SteamQuestASF';
import { SteamQuestSU } from './SteamQuestSU';
import * as fs from 'fs';

class DailyQuest {
  // eslint-disable-next-line no-undef
  questInfo: questInfo = {};
  posts!: Array<string>;
  trackError = 0;
  trackTimes = 0;
  headers: AxiosRequestHeaders;
  httpsAgent!: AxiosRequestConfig['httpsAgent'];
  userId!: string;
  borderId!: string;
  badgeIds!: Array<string>;
  avatar!: string;
  questStatus: questStatus = {};
  dailyQuestLink!: string;
  host: string;
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
    'viewPost',
    'viewNew',
    'sharePost',
    'replyPost'
  ];
  dailyQuestName!: string;
  done:Array<string> = [];
  // USTaskInfo?: Array<{ url: string; progress: Array<string>; }>;

  constructor({ awaCookie, awaHost, awaDailyQuestType, awaBoosterNotice, proxy }: { awaCookie: string, awaHost?: string, awaDailyQuestType?: Array<string>,  awaBoosterNotice:boolean, proxy?: proxy }) {
    this.host = awaHost || 'www.alienwarearena.com';
    this.awaBoosterNotice = awaBoosterNotice ?? true;
    this.headers = {
      cookie: awaCookie,
      'user-agent': globalThis.userAgent,
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6'
    };
    if (awaDailyQuestType) {
      this.awaDailyQuestType = awaDailyQuestType;
    }
    if (proxy?.enable?.includes('awa') && proxy.host && proxy.port) {
      this.httpsAgent = formatProxy(proxy);
    }
  }
  async init(): Promise<number> {
    const REMEMBERME = (this.headers.cookie as string).split(';').find((e) => e.includes('REMEMBERME'));
    if (REMEMBERME) {
      await this.updateCookie(REMEMBERME);
    } else {
      log(`${time()}${__('noREMEMBERMEAlert', chalk.yellow('awaCookie')), chalk.blue('REMEMBERME')}`);
    }
    if ((this.headers.cookie as string).includes('REMEMBERME=deleted')) {
      return 402;
    }
    const result = await this.updateDailyQuests(true);
    if (result !== 200) {
      return result;
    }
    if (fs.existsSync('awa-info.json')) {
      const { awaUserId, awaBorderId, awaBadgeIds, awaAvatar } = JSON.parse(fs.readFileSync('awa-info.json').toString()) as awaInfo;
      this.userId = awaUserId;
      this.borderId = awaBorderId;
      this.avatar = awaAvatar;
      this.badgeIds = awaBadgeIds;
      if (!(awaUserId && awaBorderId && awaBadgeIds) && !(await this.getPersonalization())) {
        return 405;
      }
      if (!awaAvatar && !(await this.getAvatar())) {
        return 405;
      }
    } else if (!(await this.getPersonalization() && await this.getAvatar())) {
      return 405;
    }
    return 200;
  }
  async listen(twitch: TwitchTrack | null, steamQuest: SteamQuestASF | SteamQuestSU | null, check = false): Promise<void> {
    if (await this.updateDailyQuests() === 200) {
      if (this.questInfo.steamQuest && steamQuest && parseInt(this.questInfo.steamQuest, 10) >= steamQuest.maxArp) {
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
      if ((this.questStatus.dailyQuest === 'complete' || this.questStatus.dailyQuest === 'skip' || this.questInfo.dailyQuest?.status === 'complete') && (this.questStatus.timeOnSite === 'complete' || this.questInfo.timeOnSite?.addedArp === this.questInfo.timeOnSite?.maxArp) && this.questStatus.watchTwitch === 'complete' && this.questStatus.steamQuest === 'complete') {
        log(time() + chalk.green(__('allTaskCompleted')));
        /*
        log('按任意键退出...');
        process.stdin.setRawMode(true);
        process.stdin.on('data', () => process.exit(0));
        */
        return;
      }
      if (check) return;
      await sleep(60 * 5);
      this.listen(twitch, steamQuest);
    }
  }
  async updateCookie(REMEMBERME: string): Promise<boolean> {
    log(`${time()}${__('updatingCookie', chalk.yellow('AWA Cookie'))}...`, false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/`,
      method: 'GET',
      headers: {
        ...this.headers,
        cookie: REMEMBERME,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      maxRedirects: 0,
      validateStatus: (status) => status === 302 || status === 200
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200 && response.data.toLowerCase().includes('we have detected an issue with your network')) {
          log(chalk.red(__('ipBanned')));
          return false;
        }
        if (response.status === 302 && response.headers['set-cookie']?.length) {
          const homeSite = response.headers['set-cookie'].find((e) => e.includes('home_site='))?.split(';')[0].split('=')[1]?.trim();
          if (homeSite) {
            this.host = homeSite;
            log(chalk.yellow(__('redirected')));
            return this.updateCookie(REMEMBERME);
          }
          this.headers.cookie = `${response.headers['set-cookie'].map((e) => e.split(';')[0].trim()).join(';')}`;
          if (this.headers.cookie.includes('REMEMBERME=deleted')) {
            log(chalk.red(`Error: ${__('cookieExpired', chalk.yellow('awaCookie'))}`));
            return false;
          }
          if (!this.headers.cookie.includes('REMEMBERME')) {
            this.headers.cookie = `${REMEMBERME};${this.headers.cookie}`;
          }
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Error'));
        log(response);
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return false;
      });
  }
  async updateDailyQuests(verify = false): Promise<number> {
    log(time() + (verify ? __('verifyingToken', chalk.yellow('AWA Token')) : __('gettingTaskInfo')), false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      }
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          if (response.data.toLowerCase().includes('we have detected an issue with your network')) {
            log(chalk.red(__('ipBanned')));
            return 410;
          }
          const $ = load(response.data);
          if ($('a.nav-link-login').length > 0) {
            log(chalk.red(__('tokenExpired')));
            return 401;
          }
          log(chalk.green('OK'));
          if (verify) {
            // 连续签到
            const consecutiveLoginsText = response.data.match(/consecutive_logins.*?=.*?({.+?})/)?.[1];
            if (consecutiveLoginsText) {
              try {
                const consecutiveLogins = JSON.parse(consecutiveLoginsText);
                const rewardArp = $(`#streak-days .advent-calendar__day[data-day="${consecutiveLogins.count}"] .advent-calendar__reward h1`).text().trim();
                if (rewardArp) {
                  log(`${time()}${__('consecutiveLoginsAlert', chalk.yellow(consecutiveLogins.count), chalk.green(rewardArp))}`);
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
                  const rewardArp = $(`#monthly-days-${week} .advent-calendar__day[data-day="${monthlyLogins.count}"] .advent-calendar__reward h1`).text().trim();
                  const rewardItem = $(`#monthly-days-${week} .advent-calendar__day[data-day="${monthlyLogins.count}"] .advent-calendar__day-overlay`).eq(0).text()
                    .trim();
                  if (rewardArp) {
                    log(`${time()}${__('monthlyLoginsARPAlert', chalk.yellow(monthlyLogins.count), chalk.green(rewardArp))}`);
                  }
                  if (rewardItem) {
                    log(`${time()}${__('monthlyLoginsItemAlert', chalk.yellow(monthlyLogins.count), chalk.green(rewardItem))}`);
                  }
                } else {
                  log(`${time()}${__('monthlyLoginsARPAlert', chalk.yellow(monthlyLogins.count), chalk.green(monthlyLogins.extra_arp))}`);
                }
              } catch (e) {
                //
              }
            }
            // 活动奖励
            const getItemBtn = $('.promotional-calendar__day-claim').filter((i, e) => /GET[\s]*?ITEM/gi.test($(e).text().trim()));
            if (getItemBtn.length > 0) {
              log(`${time()}${chalk.green(__('promotionalAlert'))}`);
            }
          }
          /*
          // 美区任务
          const country = response.data.match(/user_country.*?=.*?([\w]+)/)?.[1];
          if (country === 'US') {
            this.USTaskInfo = $('div.quest-item').filter((i, e) => $(e).find('a[href^="/quests/"]').length > 0).toArray()
              .map((e) => ({
                url: new URL($(e).find('a[href^="/quests/"]').attr('href') as string, `https://${this.host}/`).href,
                progress: $(e).find('.quest-item-progress').toArray()
                  .map((e) => $(e).text().trim()
                    .toLowerCase())
              }));
          }
          */
          // 每日任务
          const [status, arp] = $('div.quest-item').filter((i, e) => !$(e).text().includes('ARP 6.0') && $(e).find('a[href^="/quests/"]').length === 0).find('.quest-item-progress')
            .map((i, e) => $(e).text().trim()
              .toLowerCase());
          this.dailyQuestName = $('div.quest-item').filter((i, e) => !$(e).text().includes('ARP 6.0') && $(e).find('a[href^="/quests/"]').length === 0).find('.quest-title')
            .text()
            .trim();
          this.questInfo.dailyQuest = {
            status, arp
          };
          this.dailyQuestNumber = $('div.quest-item').filter((i, e) => $(e).find('a[href^="/quests/"]').length === 0).find('.quest-item-progress')
            .map((i, e) => $(e).text().trim()
              .toLowerCase())
            .filter((i, e) => e === 'incomplete').length;
          if (verify && this.awaBoosterNotice && this.dailyQuestNumber > 1) {
            const userArpBoostText = response.data.match(/userArpBoost.*?=.*?({.+?})/)?.[1];
            let boostEnabled = false;
            if (userArpBoostText) {
              try {
                const userArpBoost = JSON.parse(userArpBoostText);
                if (new Date() < userArpBoost.end) {
                  boostEnabled = true;
                }
              } catch (e) {
              //
              }
            }
            if (!boostEnabled) {
              const answer = await ask(__('boosterAlert', chalk.blue(__('booster')), chalk.yellow(__('selfOpen')), chalk.yellow('1'), chalk.yellow('2')), ['1', '2']);
              if (answer === '2') {
                this.questStatus.dailyQuest = 'skip';
              }
            }

            this.clickQuestId = $('a.quest-title[data-award-on-click="true"][href]').filter((i, e) => !/^\/quests\//.test($(e).attr('href') as string)).attr('data-quest-id');
          }
          // AWA 在线任务
          const [maxArp, addedArp] = $('section.tutorial__um-community').filter((i, e) => $(e).text().includes('Time on Site')).find('center')
            .toArray()
            .map((e) => parseInt($(e).text().trim()
              .match(/[\d]+/)?.[0] || '0', 10));
          if (this.questInfo.timeOnSite) {
            this.questInfo.timeOnSite.addedArp = addedArp;
          } else if (maxArp !== 0) {
            this.questInfo.timeOnSite = {
              maxArp, addedArp
            };
          }
          // Twitch 在线任务
          const twitchArp = $('section.tutorial__um-community').filter((i, e) => $(e).text().includes('Watch Twitch')).find('center b')
            .last()
            .text()
            .trim();
          this.questInfo.watchTwitch = twitchArp;
          // Steam 挂机任务
          const steamArp = $('section.tutorial__um-community').filter((i, e) => $(e).text().includes('Steam Quests')).find('center b')
            .last()
            .text()
            .trim();
          this.questInfo.steamQuest = steamArp;
          if (!verify) log(`${time()}${__('taskInfo')}`);
          const formatQuestInfo = this.formatQuestInfo();
          fs.appendFileSync('log.txt', `${JSON.stringify(formatQuestInfo, null, 2)}\n`);
          if (!verify) console.table(formatQuestInfo);

          this.posts = $('.tile-slider__card a[href*="/ucf/show/"]').toArray()
            .map((e) => $(e).attr('href')?.match(/ucf\/show\/([\d]+)/)?.[1])
            .filter((e) => e) as Array<string>;
          if ($('a.quest-title').length > 0) {
            this.dailyQuestLink = new URL($('a.quest-title[href]').attr('href') as string, `https://${this.host}/`).href;
          }
          return 200;
        }
        log(chalk.red('Net Error'));
        return response.status;
      })
      .catch((error) => {
        log(chalk.red('Error') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return 0;
      });
  }
  async do(): Promise<void> {
    /*
    if (this.USTaskInfo?.length) {
      for (const { url, progress: [status] } of this.USTaskInfo) {
        if (status === 'complete') {
          continue;
        }
        await this.doUSTask(url);
      }
    }
    */
    if (this.questStatus.dailyQuest === 'skip') {
      return log(time() + chalk.yellow(__('dailyQuestSkipped')));
    }
    if (this.questInfo.dailyQuest?.status === 'complete') {
      this.questStatus.dailyQuest = 'complete';
      return log(time() + chalk.green(__('dailyQuestCompleted')));
    }
    if (this.awaDailyQuestType.includes('click') && this.clickQuestId) {
      await this.questAward(this.clickQuestId);
      await this.updateDailyQuests();
    }
    if (this.awaDailyQuestType.includes('visitLink') && this.dailyQuestLink) {
      await this.openLink(this.dailyQuestLink);
      const postId = this.dailyQuestLink.match(/ucf\/show\/([\d]+)/)?.[1];
      if (postId) {
        await this.viewPost(postId);
      }
      await this.updateDailyQuests();
    }
    if (this.questInfo.dailyQuest?.status === 'complete') {
      this.questStatus.dailyQuest = 'complete';
      if (this.dailyQuestNumber < 2) {
        return log(time() + chalk.green(__('dailyQuestCompleted')));
      }
    }
    for (const quest of this.matchQuest()) {
      // @ts-ignore
      if (this[quest]) {
        // @ts-ignore
        await this[quest]();
      } else if (quest === 'leaderboard') {
        await this.openLink(`https://${this.host}/rewards/leaderboard`);
      } else if (quest === 'marketplace') {
        await this.openLink(`https://${this.host}/marketplace/`);
      } else if (quest === 'rewards') {
        await this.openLink(`https://${this.host}/rewards`);
      } else if (quest === 'video') {
        await this.openLink(`https://${this.host}/ucf/Video`);
      }
      this.done.push(quest);
      await sleep(random(1, 2));
    }
    await this.updateDailyQuests();
    if (this.questInfo.dailyQuest?.status === 'complete') {
      this.questStatus.dailyQuest = 'complete';
      if (this.dailyQuestNumber < 2) {
        return log(time() + chalk.green(__('dailyQuestCompleted')));
      }
    }

    if (this.awaDailyQuestType.includes('changeBorder') && !this.done.includes('changeBorder')) await this.changeBorder();
    if (this.awaDailyQuestType.includes('changeBadge') && !this.done.includes('changeBadge')) await this.changeBadge();
    if (this.awaDailyQuestType.includes('changeAvatar') && !this.done.includes('changeAvatar')) await this.changeAvatar();
    // if (this.awaDailyQuestType.includes('viewPost') && !this.done.includes('viewPost')) await this.viewPosts();
    if (this.awaDailyQuestType.includes('viewNews') && !this.done.includes('viewNews')) await this.viewNews();
    if (this.awaDailyQuestType.includes('sharePost') && !this.done.includes('sharePosts')) await this.sharePosts();
    if (this.awaDailyQuestType.includes('openLink')) {
      if (!this.done.includes('leaderboard')) {
        await this.openLink(`https://${this.host}/rewards/leaderboard`);
        await sleep(random(1, 3));
      }
      if (!this.done.includes('rewards')) {
        await this.openLink(`https://${this.host}/rewards`);
        await sleep(random(1, 3));
      }
      if (!this.done.includes('marketplace')) {
        await this.openLink(`https://${this.host}/marketplace/`);
      }
    }
    await this.updateDailyQuests();
    if (this.questInfo.dailyQuest?.status === 'complete') {
      this.questStatus.dailyQuest = 'complete';
      if (this.dailyQuestNumber < 2) {
        return log(time() + chalk.green(__('dailyQuestCompleted')));
      }
    }
    if (this.awaDailyQuestType.includes('replyPost') && !this.done.includes('replyPost')) {
      await this.replyPost();
      await this.updateDailyQuests();
      if (this.questInfo.dailyQuest?.status === 'complete') {
        this.questStatus.dailyQuest = 'complete';
        if (this.dailyQuestNumber < 2) {
          return log(time() + chalk.green(__('dailyQuestCompleted')));
        }
      }
    }
    this.questStatus.dailyQuest = 'complete';
    return log(time() + chalk.red(__('dailyQuestNotCompleted')));
  }
  async changeBorder(): Promise<boolean> {
    log(`${time()}${__('changing', chalk.yellow('Border'))}`, false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/border/select`,
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${this.host}`,
        referer: `https://${this.host}/account/personalization`
      },
      data: { id: this.borderId }
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.data.success) {
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Error'));
        log(response.data?.message || response);
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return false;
      });
  }

  async changeBadge(): Promise<boolean> {
    log(`${time()}${__('changing', chalk.yellow('Badge'))}`, false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/badges/update/${this.userId}`,
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${this.host}`,
        referer: `https://${this.host}/account/personalization`
      },
      data: JSON.stringify(this.badgeIds.slice(0, 5))
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.data.success) {
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Error'));
        log(response.data?.message || response);
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return false;
      });
  }

  async changeAvatar(): Promise<boolean> {
    log(`${time()}${__('changing', chalk.yellow('Avatar'))}`, false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/ajax/user/avatar/save/${this.userId}`,
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${this.host}`,
        referer: `https://${this.host}/avatar/edit/hat`
      },
      data: this.avatar
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.data.success) {
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Error'));
        log(response.data?.message || response);
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return false;
      });
  }

  async sendViewTrack(link: string): Promise<boolean> {
    log(`${time()}${__('sendingViewTrack', chalk.yellow(link))}`, false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/tos/track`,
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${this.host}`,
        referer: link
      },
      data: JSON.stringify({ url: link })
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.data.success) {
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Error'));
        log(response.data?.message || response);
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return false;
      });
  }

  async track(): Promise<void> {
    if (this.trackTimes % 3 === 0) {
      if (!this.questInfo.timeOnSite) {
        return log(time() + chalk.yellow(__('noTimeOnSiteInfo')));
      }
      if (this.questInfo.timeOnSite.addedArp >= this.questInfo.timeOnSite.maxArp) {
        this.questStatus.timeOnSite = 'complete';
        return log(time() + chalk.green(__('timeOnSiteCompleted')));
      }
    }
    if (this.trackError >= 6) {
      return log(`${time()}${chalk.red(__('trackError', chalk.yellow('AWA')))}`);
    }
    log(`${time()}${__('sendingOnlineTrack', chalk.yellow('AWA'))}`, false);
    await this.sendTrack();
    await sleep(60);
    this.track();
  }

  async sendTrack(link?: string): Promise<boolean> {
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/tos/track`,
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${this.host}`,
        referer: link || `https://${this.host}/account/personalization`
      },
      data: JSON.stringify({ url: link || `https://${this.host}/account/personalization` })
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (!link) {
          if (response.data.success) {
            log(chalk.green('OK'));
            this.trackError = 0;
            this.trackTimes++;
            return true;
          }
          log(chalk.red('Error'));
          log(response.data?.message || response);
          this.trackError++;
          return false;
        }
        return true;
      })
      .catch((error) => {
        if (!link) {
          log(chalk.red('Error'));
          globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
          log(error);
          this.trackError++;
          return false;
        }
        return true;
      });
  }

  async viewPost(postId?: string): Promise<boolean> {
    await this.openLink(`https://${this.host}/ucf/show/${postId}`);
    log(`${time()}${__('sendingViewRecord', chalk.yellow(postId))}`, false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/ucf/increment-views/${postId}`,
      method: 'POST',
      headers: {
        ...this.headers,
        origin: `https://${this.host}`,
        referer: `https://${this.host}/ucf/show/${postId}`
      }
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then(async (response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.data === 'success') {
          await this.sendTrack(`https://${this.host}/ucf/show/${postId}`);
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Error'));
        log(response.data || response.statusText);
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
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
    log(`${time()}${__('gettingRelatedPosts')}`, false);
    const getOptions: AxiosRequestConfig = {
      url: `https://${this.host}/forums/board/113/awa-on-topic`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        referer: `https://${this.host}/`
      }
    };
    if (this.httpsAgent) getOptions.httpsAgent = this.httpsAgent;

    const post = postId || await axios(getOptions)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          const $ = load(response.data);
          const topicPost = $('.card-title a.forums__topic-link').toArray()
            .filter((e) => /Daily[\s]*?Quest/gi.test($(e).text()) && $(e).prev().attr('title') !== 'Locked')
            .map((e) => $(e).attr('href')?.match(/ucf\/show\/([\d]+)/)?.[1])
            .filter((e) => e);
          if (topicPost.length > 0) {
            log(chalk.green('OK'));
            return topicPost[0];
          }
          log(chalk.gray(__('noRelatedPosts')));
          return false;
        }
        log(chalk.red('Net Error'));
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return false;
      });

    if (!post) {
      return false;
    }

    log(`${time()}${__('replyingPost', chalk.yellow(post))}`, false);
    const form = new FormData();

    form.append('topic_post[content]', '<p>Thanks!</p>');
    form.append('topic_post[quotedPostIds]', '');
    form.append('topic_post[parentPost]', '');
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/comments/${post}/new/ucf`,
      method: 'POST',
      headers: {
        ...this.headers,
        origin: `https://${this.host}`,
        referer: `https://${this.host}/ucf/show/${post}`,
        ...form.getHeaders()
      },
      data: form
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.data.success) {
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Error'));
        log(response.data?.message || response);
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return false;
      });
  }

  async sharePost(postId: string): Promise<boolean> {
    log(`${time()}${__('sharingPost', chalk.yellow(postId))}`, false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/arp/quests/share/${postId}`,
      method: 'POST',
      headers: {
        ...this.headers,
        origin: `https://${this.host}`,
        referer: `https://${this.host}/ucf/show/${postId}`
      },
      responseType: 'json'
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        try {
          if (JSON.stringify(response.data) === '{}') {
            log(chalk.green('OK'));
            return true;
          }
          log(chalk.red('Error'));
          log(response.data);
          return false;
        } catch {
          log(chalk.red('Error'));
          log(response.data);
          return false;
        }
      })
      .catch((error) => {
        log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return false;
      });
  }
  async sharePosts(postIds?: Array<string>): Promise<boolean> {
    const posts = postIds || this.posts;
    if (!posts?.length) {
      return false;
    }
    for (const post of posts.slice(0, 3)) {
      await this.sharePost(post);
      await sleep(random(1, 5));
    }
    return true;
  }
  async viewNews(): Promise<void> {
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/ucf/show/2162951/boards/awa-information/News/arp-6-0`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      }
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    await axios(options)
      .then((response) => globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|'))
      .catch(() => { });
    await this.viewPost('2162951');
  }
  async openLink(link: string):Promise<void> {
    log(`${time()}${__('visitingPage', chalk.yellow(link))}`, false);
    const options: AxiosRequestConfig = {
      url: link,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      }
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          const $ = load(response.data);
          if ($('a.nav-link-login').length > 0) {
            log(chalk.red(__('tokenExpired')));
            return;
          }
          log(chalk.green('OK'));
          return;
        }
        log(chalk.red('Net Error'));
        return;
      })
      .catch((error) => {
        log(chalk.red('Error') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return;
      });
  }

  async questAward(questId: string): Promise<boolean> {
    log(`${time()}${__('doingTask', chalk.yellow(questId))}`, false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/ajax/user/quest-award/${questId}`,
      method: 'get',
      headers: {
        ...this.headers,
        referer: `https://${this.host}/`
      }
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then(async (response) => {
        if (response.status === 200) {
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Error'));
        log(response.data || response.statusText);
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return false;
      });
  }

  /*
  async getUSTaskInfo(url: string): Promise<string | false> {
    log(`${time()}正在获取美区任务[${chalk.yellow(url.match(/[\d]+/)?.[0] || url)}] render...`, false);
    const getOptions: AxiosRequestConfig = {
      url,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*\/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        referer: `https://${this.host}/`
      }
    };
    if (this.httpsAgent) getOptions.httpsAgent = this.httpsAgent;

    return axios(getOptions)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          const render = response.data.match(/https:\/\/www\.google\.com\/recaptcha\/enterprise\.js\?render=(.*?)'/)?.[1];
          if (render) {
            log(chalk.green('OK'));
            return render;
          }
          log(chalk.red('Error'));
          return false;
        }
        log(chalk.red('Net Error'));
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return false;
      });
  }
  async doUSTask(url: string) {
    const render = await this.getUSTaskInfo(url);
    if (!render) return false;
  }
  */
  async getPersonalization(): Promise<boolean> {
    log(`${time()}${__('gettingUserInfo', chalk.yellow('Personalization'))}`, false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/account/personalization`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      }
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          const $ = load(response.data);
          if ($('a.nav-link-login').length > 0) {
            log(chalk.red(__('tokenExpired')));
            return false;
          }
          const [, , awaUserId] = response.data.match(/(var|let)[\s]+?user_id[\s]*?=[\s]*?([\d]+);/);
          const [, , awaBorderId] = response.data.match(/(var|let)[\s]+?selectedBorder[\s]*?=[\s]*?([\d]+);/);
          const [, , awaBadgeIds] = response.data.match(/(var|let)[\s]+?selectedBadges[\s]*?=[\s]*?\[(([\d]+)(,[\d]+)*?)\];/);
          this.userId = awaUserId;
          this.borderId = awaBorderId;
          this.badgeIds = awaBadgeIds.split(',');
          fs.writeFileSync('awa-info.json', JSON.stringify({
            awaUserId: this.userId,
            awaBorderId: this.borderId,
            awaBadgeIds: this.badgeIds,
            awaAvatar: this.avatar
          }));
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Net Error'));
        log(response.data || response.statusText);
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return false;
      });
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getAvatar(): Promise<boolean> {
    log(`${time()}${__('gettingUserInfo', chalk.yellow('Avatar'))}`, false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/avatar/edit`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      }
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        if (response.status === 200) {
          const $ = load(response.data);
          if ($('a.nav-link-login').length > 0) {
            log(chalk.red(__('tokenExpired')));
            return false;
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
          log(chalk.green('OK'));
          this.avatar = awaAvatar;
          fs.writeFileSync('awa-info.json', JSON.stringify({
            awaUserId: this.userId,
            awaBorderId: this.borderId,
            awaBadgeIds: this.badgeIds,
            awaAvatar: this.avatar
          }));
          return true;
        }
        log(chalk.red('Net Error'));
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e: string) => e.split(';')[0].trim().split('=')[1]).filter((e: any) => e && e.length > 5)])].join('|');
        log(error);
        return false;
      });
  }
  matchQuest(): Array<string> {
    log(`${time()}${__('matchingDailyQuestDb')}`, false);
    if (!this.dailyQuestName) {
      log(chalk.yellow(__('notMatchedDailyQuest')));
      return [];
    }
    if (!fs.existsSync('dailyQuestDb.json')) {
      log(chalk.yellow(__('notMatchedDailyQuest')));
      return [];
    }
    const { quests } = JSON.parse(fs.readFileSync('dailyQuestDb.json').toString()) as dailyQuestDb;
    let matchedQuest = Object.entries(quests).map(([key, value]) => (value.includes(this.dailyQuestName) ? key : '')).filter((e) => e);
    if (matchedQuest.length > 0) {
      log(chalk.green(__('success')));
      return matchedQuest;
    }
    matchedQuest = Object.entries(quests).map(([key, value]) => (value.map((e) => e.toLowerCase()).includes(this.dailyQuestName.toLowerCase()) ? key : '')).filter((e) => e);
    if (matchedQuest.length > 0) {
      log(chalk.green(__('success')));
      return matchedQuest;
    }
    matchedQuest = Object.entries(quests).map(([key, value]) => (value.map((e) => e.toLowerCase().replace(/,|\.|\/|\\|'|"|:|;|!|#|\*|\?|<|>|\[|\]|\{|\}|\+|-|=|`|@|\$|%|\^|&|\(|~|\)|\||[\s]/g, '')).includes(this.dailyQuestName.toLowerCase().replace(/,|\.|\/|\\|'|"|:|;|!|#|\*|\?|<|>|\[|\]|\{|\}|\+|-|=|`|@|\$|%|\^|&|\(|~|\)|\||[\s]/g, '')) ? key : '')).filter((e) => e);
    if (matchedQuest.length > 0) {
      log(chalk.green(__('success')));
      return matchedQuest;
    }
    log(chalk.yellow(__('notMatchedDailyQuest')));
    return [];
  }
  formatQuestInfo() {
    return {
      [__('dailyTask')]: {
        // eslint-disable-next-line no-nested-ternary
        [__('status')]: this.questInfo.dailyQuest?.status === 'complete' ? __('done') : (this.questStatus.dailyQuest === 'skip' ? __('skipped') : __('undone')),
        [__('obtainedARP')]: parseInt(this.questInfo.dailyQuest?.arp || '0', 10),
        [__('maxAvailableARP')]: parseInt(this.questInfo.dailyQuest?.arp || '0', 10)
      },
      [__('timeOnSite')]: {
        [__('status')]: this.questInfo.timeOnSite?.addedArp === this.questInfo.timeOnSite?.maxArp ? __('done') : __('undone'),
        [__('obtainedARP')]: this.questInfo.timeOnSite?.addedArp,
        [__('maxAvailableARP')]: this.questInfo.timeOnSite?.maxArp
      },
      [__('watchTwitch')]: {
        [__('status')]: this.questInfo.watchTwitch === '15' ? __('done') : __('undone'),
        [__('obtainedARP')]: parseInt(this.questInfo.watchTwitch || '0', 10),
        [__('maxAvailableARP')]: 15
      },
      [__('steamQuest')]: {
        [__('status')]: '-',
        [__('obtainedARP')]: parseInt(this.questInfo.steamQuest || '0', 10),
        [__('maxAvailableARP')]: '-'
      }
    };
  }
}

export { DailyQuest };
