/* eslint-disable max-len */
/* global questStatus, proxy */
import { AxiosRequestConfig, AxiosRequestHeaders } from 'axios';
import { load } from 'cheerio';
import * as chalk from 'chalk';
import * as FormData from 'form-data';
import * as tunnel from 'tunnel';
import { log, sleep, random, time, netError, ask, http as axios } from './tool';
import { TwitchTrack } from './TwitchTrack';
import { SteamQuest } from './SteamQuest';
import * as fs from 'fs';
import { SocksProxyAgent, SocksProxyAgentOptions } from 'socks-proxy-agent';

class DailyQuest {
  // eslint-disable-next-line no-undef
  questInfo: questInfo = {};
  posts!: Array<string>;
  trackError = 0;
  trackTimes = 0;
  headers: AxiosRequestHeaders;
  httpsAgent!: AxiosRequestConfig['httpsAgent'];
  userId: string;
  borderId: string;
  badgeIds: Array<string>;
  questStatus: questStatus = {};
  dailyQuestLink!: string;
  host: string;
  awaBoosterNotice: boolean;

  constructor({ awaCookie, awaHost, awaUserId, awaBorderId, awaBadgeIds, awaBoosterNotice, proxy }: { awaCookie: string, awaHost?: string, awaUserId: string, awaBorderId: string, awaBadgeIds: string, awaBoosterNotice:boolean, proxy?: proxy }) {
    this.host = awaHost || 'www.alienwarearena.com';
    this.userId = awaUserId;
    this.borderId = awaBorderId;
    this.awaBoosterNotice = awaBoosterNotice ?? true;
    this.badgeIds = awaBadgeIds.split(',');
    this.headers = {
      cookie: awaCookie,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36 Edg/100.0.1185.39',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6'
    };
    if (proxy?.enable?.includes('awa') && proxy.host && proxy.port) {
      const proxyOptions: tunnel.ProxyOptions & SocksProxyAgentOptions = {
        host: proxy.host,
        port: proxy.port
      };
      if (proxy.protocol === 'socks') {
        proxyOptions.hostname = proxy.host;
        if (proxy.username && proxy.password) {
          proxyOptions.userId = proxy.username;
          proxyOptions.password = proxy.password;
        }
        this.httpsAgent = new SocksProxyAgent(proxyOptions);
      } else {
        if (proxy.username && proxy.password) {
          proxyOptions.proxyAuth = `${proxy.username}:${proxy.password}`;
        }
        this.httpsAgent = tunnel.httpsOverHttp({
          proxy: proxyOptions
        });
      }
      this.httpsAgent.options.rejectUnauthorized = false;
    }
  }
  async init(): Promise<number> {
    const REMEMBERME = (this.headers.cookie as string).split(';').find((e) => e.includes('REMEMBERME'));
    if (REMEMBERME) {
      await this.updateCookie(REMEMBERME);
    } else {
      log(`${time()}检测到${chalk.yellow('awaCookie')}中没有${chalk.blue('REMEMBERME')}，可能会导致连续签到天数获取错误，不影响其他功能`);
    }
    return this.updateDailyQuests(true);
  }
  async listen(twitch: TwitchTrack | null, steamQuest: SteamQuest | null, check = false): Promise<void> {
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
        log(time() + chalk.green('今日所有任务已完成！'));
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
    log(`${time()}正在更新${chalk.yellow('AWA')} Cookie...`, false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/`,
      method: 'GET',
      headers: {
        ...this.headers,
        cookie: REMEMBERME,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      maxRedirects: 0,
      validateStatus: (status) => status === 302
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        if (response.headers['set-cookie']?.length) {
          this.headers.cookie = `${(this.headers.cookie as string).trim().replace(/;$/, '')};${response.headers['set-cookie'].map((e) => e.split(';')[0].trim()).join(';')}`;
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.green('Error'));
        console.error(response);
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error') + netError(error));
        console.error(error);
        return false;
      });
  }
  async updateDailyQuests(verify = false): Promise<number> {
    log(time() + (verify ? `正在验证${chalk.yellow('AWA')} Token...` : '正在获取任务信息...'), false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      maxRedirects: 0
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then(async (response) => {
        if (response.status === 200) {
          const $ = load(response.data);
          if ($('a.nav-link-login').length > 0) {
            log(chalk.red('Token已过期'));
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
                  log(`${time()}已连续登录${chalk.yellow(consecutiveLogins.count)}天，获得${chalk.green(rewardArp)}ARP`);
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
                    log(`${time()}本月已登录${chalk.yellow(monthlyLogins.count)}天，获得${chalk.green(rewardArp)}ARP`);
                  }
                  if (rewardItem) {
                    log(`${time()}本月已登录${chalk.yellow(monthlyLogins.count)}天，获得${chalk.green(rewardItem)}`);
                  }
                } else {
                  log(`${time()}本月已登录${chalk.yellow(monthlyLogins.count)}天，获得${chalk.green(monthlyLogins.extra_arp)}ARP`);
                }
              } catch (e) {
                //
              }
            }
          }
          // 每日任务
          const [status, arp] = $('div.quest-item').filter((i, e) => !$(e).text().includes('ARP 6.0')).find('.quest-item-progress')
            .map((i, e) => $(e).text().trim()
              .toLowerCase());
          this.questInfo.dailyQuest = {
            status, arp
          };
          if (verify && this.awaBoosterNotice && $('div.quest-item .quest-item-progress').map((i, e) => $(e).text().trim()
            .toLowerCase()).filter((i, e) => e === 'incomplete').length > 1) {
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
              const answer = await ask(`检测到未完成的每日任务大于1个，请确认是否要使用${chalk.blue('ARP 助推器')}(${chalk.yellow('需要自行开启！！！')})。\n输入 ${chalk.yellow('1')} 继续任务，输入 ${chalk.yellow('2')} 跳过每日任务。`, ['1', '2']);
              if (answer === '2') {
                this.questStatus.dailyQuest = 'skip';
              }
            }
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
          if (!verify) log(`${time()}当前任务信息:`);
          const formatQuestInfo = this.formatQuestInfo();
          fs.appendFileSync('log.txt', `${JSON.stringify(formatQuestInfo, null, 4)}\n`);
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
        console.error(error);
        return 0;
      });
  }
  async do(): Promise<void> {
    if (this.questStatus.dailyQuest === 'skip') {
      return log(time() + chalk.yellow('已跳过每日任务！'));
    }
    if (this.questInfo.dailyQuest?.status === 'complete') {
      this.questStatus.dailyQuest = 'complete';
      return log(time() + chalk.green('每日任务已完成！'));
    }
    await this.changeBorder();
    await this.changeBadge();
    await this.viewPosts();
    await this.viewNews();
    await this.sharePosts();
    if (this.dailyQuestLink) {
      await this.openLink(this.dailyQuestLink);
      const postId = this.dailyQuestLink.match(/ucf\/show\/([\d]+)/)?.[1];
      if (postId) {
        await this.viewPost(postId);
      }
    }
    await this.openLink(`https://${this.host}/rewards/leaderboard`);
    await this.updateDailyQuests();
    if (this.questInfo.dailyQuest?.status === 'complete') {
      this.questStatus.dailyQuest = 'complete';
      return log(time() + chalk.green('每日任务已完成！'));
    }
    await this.replyPost();
    await this.updateDailyQuests();
    if (this.questInfo.dailyQuest?.status === 'complete') {
      this.questStatus.dailyQuest = 'complete';
      return log(time() + chalk.green('每日任务已完成！'));
    }
    this.questStatus.dailyQuest = 'complete';
    return log(time() + chalk.red('每日任务未完成！'));
  }
  changeBorder(): Promise<boolean> {
    log(`${time()}正在更换${chalk.yellow('Border')}...`, false);
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
        if (response.data.success) {
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Error'));
        log(response.data?.message || response.statusText);
        return false;
      })
      .catch((e) => {
        log(chalk.red('Error'));
        console.error(e);
        return false;
      });
  }

  changeBadge(): Promise<boolean> {
    log(`${time()}正在更换${chalk.yellow('Badge')}...`, false);
    const options: AxiosRequestConfig = {
      url: `https://${this.host}/badges/update/${this.userId}`,
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${this.host}`,
        referer: `https://${this.host}/account/personalization`
      },
      data: JSON.stringify(this.badgeIds)
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        if (response.data.success) {
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Error'));
        log(response.data?.message || response.statusText);
        return false;
      })
      .catch((e) => {
        log(chalk.red('Error'));
        console.error(e);
        return false;
      });
  }

  async sendViewTrack(link: string): Promise<boolean> {
    log(`${time()}正在发送浏览${chalk.yellow(link)}心跳...`, false);
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

    return await axios(options)
      .then((response) => {
        if (response.data.success) {
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Error'));
        log(response.data?.message || response.statusText);
        return false;
      })
      .catch((e) => {
        log(chalk.red('Error'));
        console.error(e);
        return false;
      });
  }

  async track(): Promise<void> {
    if (this.trackTimes % 3 === 0) {
      // await this.updateDailyQuests();
      if (!this.questInfo.timeOnSite) {
        return log(time() + chalk.yellow('没有获取到在线任务信息，跳过此任务'));
      }
      if (this.questInfo.timeOnSite.addedArp >= this.questInfo.timeOnSite.maxArp) {
        this.questStatus.timeOnSite = 'complete';
        return log(time() + chalk.green('每日在线任务完成！'));
      }
      // log(`${time()}当前每日在线任务进度：${chalk.blue(`${this.questInfo.timeOnSite.addedArp}/${this.questInfo.timeOnSite.maxArp}`)}`);
    }
    if (this.trackError >= 6) {
      return log(time() + chalk.red('发送') + chalk.yellow('[AWA]') + chalk.red('在线心跳连续失败超过6次，跳过此任务'));
    }
    log(`${time()}正在发送${chalk.yellow('AWA')}在线心跳...`, false);
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

    return await axios(options)
      .then((response) => {
        if (!link) {
          if (response.data.success) {
            log(chalk.green('OK'));
            this.trackError = 0;
            this.trackTimes++;
            return true;
          }
          log(chalk.red('Error'));
          log(response.data?.message || response.statusText);
          this.trackError++;
          return false;
        }
        return true;
      })
      .catch((e) => {
        if (!link) {
          log(chalk.red('Error'));
          console.error(e);
          this.trackError++;
          return false;
        }
        return true;
      });
  }

  async viewPost(postId?: string): Promise<boolean> {
    await this.openLink(`https://${this.host}/ucf/show/${postId}`);
    log(`${time()}正在发送浏览帖子${chalk.yellow(postId)}记录...`, false);
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

    return await axios(options)
      .then(async (response) => {
        if (response.data === 'success') {
          await this.sendTrack(`https://${this.host}/ucf/show/${postId}`);
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Error'));
        log(response.data || response.statusText);
        return false;
      })
      .catch((e) => {
        log(chalk.red('Error'));
        console.error(e);
        return false;
      });
  }
  async viewPosts(postIds?: Array<string>): Promise<boolean> {
    const posts = postIds || this.posts;
    if (!posts?.length) {
      return false;
    }
    for (const post of posts.slice(0, 5)) {
      await this.viewPost(post);
      await sleep(random(1, 5));
    }
    return true;
  }
  async replyPost(postId?: string): Promise<boolean> {
    log(`${time()}正在获取每日任务相关帖子...`, false);
    const getOptions: AxiosRequestConfig = {
      url: `https://${this.host}/forums/board/113/awa-on-topic`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        referer: 'https://www.alienwarearena.com/'
      }
    };
    if (this.httpsAgent) getOptions.httpsAgent = this.httpsAgent;

    const post = postId || await axios(getOptions)
      .then((response) => {
        if (response.status === 200) {
          const $ = load(response.data);
          const topicPost = $('.card-title a.forums__topic-link').toArray()
            .filter((e) => /Daily[\s]*?Quest/gi.test($(e).text()))
            .map((e) => $(e).attr('href')?.match(/ucf\/show\/([\d]+)/)?.[1])
            .filter((e) => e);
          if (topicPost.length > 0) {
            log(chalk.green('OK'));
            return topicPost[0];
          }
          log(chalk.gray('没有找到相关帖子，跳过此步骤！'));
          return false;
        }
        log(chalk.red('Net Error'));
        return false;
      })
      .catch((error) => {
        log(chalk.red('Error') + netError(error));
        console.error(error);
        return false;
      });

    if (!post) {
      return false;
    }

    log(`${time()}正在回复帖子${chalk.yellow(post)}...`, false);
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
        if (response.data.success) {
          log(chalk.green('OK'));
          return true;
        }
        log(chalk.red('Error'));
        log(response.data?.message || response.statusText);
        return false;
      })
      .catch((e) => {
        log(chalk.red('Error'));
        console.error(e);
        return false;
      });
  }

  sharePost(postId: string): Promise<boolean> {
    log(`${time()}正在分享帖子${chalk.yellow(postId)}...`, false);
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
        try {
          if (JSON.stringify(response.data) === '{}') {
            log(chalk.green('OK'));
            return true;
          }
          log(chalk.red('Error'));
          log(response.data);
          return false;
        } catch (e) {
          log(chalk.red('Error'));
          log(response.data);
          return false;
        }
      })
      .catch((e) => {
        log(chalk.red('Error'));
        console.error(e);
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
      .then(() => { })
      .catch(() => { });
    await this.viewPost('2162951');
  }
  async openLink(link: string):Promise<void> {
    log(`${time()}正在浏览页面[${chalk.yellow(link)}]...`, false);
    const options: AxiosRequestConfig = {
      url: link,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      }
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return await axios(options)
      .then((response) => {
        if (response.status === 200) {
          const $ = load(response.data);
          if ($('a.nav-link-login').length > 0) {
            log(chalk.red('Token已过期'));
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
        console.error(error);
        return;
      });
  }
  formatQuestInfo() {
    return {
      ['每日任务']: {
        // eslint-disable-next-line no-nested-ternary
        ['状态']: this.questInfo.dailyQuest?.status === 'complete' ? '已完成' : (this.questStatus.dailyQuest === 'skip' ? '已跳过' : '未完成'),
        ['已获得ARP']: parseInt(this.questInfo.dailyQuest?.arp || '0', 10),
        ['最大可获得ARP']: parseInt(this.questInfo.dailyQuest?.arp || '0', 10)
      },
      ['AWA在线任务']: {
        ['状态']: this.questInfo.timeOnSite?.addedArp === this.questInfo.timeOnSite?.maxArp ? '已完成' : '未完成',
        ['已获得ARP']: this.questInfo.timeOnSite?.addedArp,
        ['最大可获得ARP']: this.questInfo.timeOnSite?.maxArp
      },
      ['Twitch在线任务']: {
        ['状态']: this.questInfo.watchTwitch === '15' ? '已完成' : '未完成',
        ['已获得ARP']: parseInt(this.questInfo.watchTwitch || '0', 10),
        ['最大可获得ARP']: 15
      },
      ['Steam任务']: {
        ['状态']: '-',
        ['已获得ARP']: parseInt(this.questInfo.steamQuest || '0', 10),
        ['最大可获得ARP']: '-'
      }
    };
  }
}

export { DailyQuest };
