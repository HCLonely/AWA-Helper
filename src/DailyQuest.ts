/* eslint-disable max-len */
/* global questStatus, proxy */
import axios, { AxiosRequestConfig, AxiosRequestHeaders } from 'axios';
import { load } from 'cheerio';
import * as chalk from 'chalk';
import * as FormData from 'form-data';
import * as tunnel from 'tunnel';
import { log, sleep, random, time } from './tool';
import { Agent } from 'http';
import { TwitchTrack } from './TwitchTrack';
import { SteamQuest } from './SteamQuest';

class DailyQuest {
  // eslint-disable-next-line no-undef
  questInfo: questInfo = {};
  posts!: Array<string>;
  trackError = 0;
  trackTimes = 0;
  headers: AxiosRequestHeaders;
  httpsAgent!: Agent;
  userId: string;
  borderId: string;
  badgeIds: Array<string>;
  questStatus: questStatus = {};
  dailyQuestLink!: string;

  constructor(awaCookie: string, awaUserId: string, awaBorderId: string, awaBadgeIds: string, proxy?: proxy) {
    this.userId = awaUserId;
    this.borderId = awaBorderId;
    this.badgeIds = awaBadgeIds.split(',');
    this.headers = {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      cookie: awaCookie,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36 Edg/100.0.1185.39'
    };
    if (proxy?.enable.includes('awa') && proxy.host && proxy.port) {
      this.httpsAgent = tunnel.httpsOverHttp({
        proxy: {
          host: proxy.host,
          port: proxy.port
        }
      });
    }
  }
  init(): Promise<number> {
    return this.updateDailyQuests(true);
  }
  async listen(twitch: TwitchTrack | null, steamQuest: SteamQuest | null): Promise<void> {
    if (await this.updateDailyQuests() === 200) {
      if (this.questInfo.steamQuest && steamQuest && parseInt(this.questInfo.steamQuest, 10) >= steamQuest.maxArp) {
        await steamQuest.resume();
        this.questStatus.steamQuest = 'complete';
      }
      if (steamQuest?.stopped || !steamQuest) {
        this.questStatus.steamQuest = 'complete';
      }
      if (twitch?.complete || !twitch) {
        this.questStatus.watchTwitch = 'complete';
      }
      if (this.questStatus.dailyQuest === 'complete' && this.questStatus.timeOnSite === 'complete' && this.questStatus.watchTwitch === 'complete' && this.questStatus.steamQuest === 'complete') {
        log(time() + chalk.green('今日所有任务已完成！'));
        log('按任意键退出...');
        process.stdin.setRawMode(true);
        process.stdin.on('data', () => process.exit(0));
        return;
      }
      await sleep(60 * 5);
      this.listen(twitch, steamQuest);
    }
  }
  updateDailyQuests(verify = false): Promise<number> {
    log(time() + (verify ? `正在验证 ${chalk.yellow('AWA')} Token...` : '正在获取任务信息...'), false);
    const options: AxiosRequestConfig = {
      url: 'https://www.alienwarearena.com/',
      method: 'GET',
      headers: this.headers
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response) => {
        if (response.status === 200) {
          const $ = load(response.data);
          if ($('a.nav-link-login').length > 0) {
            log(chalk.red('Token已过期'));
            return 401;
          }
          log(chalk.green('OK'));
          const [status, arp] = $('div.quest-item .quest-item-progress').map((i, e) => $(e).text().toLowerCase());
          this.questInfo.dailyQuest = {
            status, arp
          };
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
          const twitchArp = $('section.tutorial__um-community').filter((i, e) => $(e).text().includes('Watch Twitch')).find('center b')
            .last()
            .text()
            .trim();
          this.questInfo.watchTwitch = twitchArp;
          const steamArp = $('section.tutorial__um-community').filter((i, e) => $(e).text().includes('Steam Quests')).find('center b')
            .last()
            .text()
            .trim();
          this.questInfo.steamQuest = steamArp;
          log(`${time()}当前任务信息:`);
          console.table(this.formatQuestInfo());

          this.posts = $('.tile-slider__card a[href*="/ucf/show/"]').toArray()
            .map((e) => $(e).attr('href')?.match(/ucf\/show\/([\d]+)/)?.[1])
            .filter((e) => e) as Array<string>;
          if ($('a.quest-title').length > 0) {
            this.dailyQuestLink = new URL($('a.quest-title[href]').attr('href') as string, 'https://www.alienwarearena.com/').href;
          }
          return 200;
        }
        log(chalk.red('Net Error'));
        return response.status;
      })
      .catch((error) => {
        log(chalk.red('Error'));
        console.error(error);
        return 0;
      });
  }
  async do(): Promise<void> {
    if (this.questInfo.dailyQuest?.status === 'complete') {
      this.questStatus.dailyQuest = 'complete';
      return log(time() + chalk.green('每日任务已完成！'));
    }
    await this.changeBorder();
    await this.changeBadge();
    await this.viewPosts();
    if (this.dailyQuestLink) {
      await this.sendViewTrack(this.dailyQuestLink);
    }
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
      url: 'https://www.alienwarearena.com/border/select',
      method: 'POST',
      headers: {
        ...this.headers,
        origin: 'https://www.alienwarearena.com',
        referer: 'https://www.alienwarearena.com/account/personalization'
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
      url: `https://www.alienwarearena.com/badges/update/${this.userId}`,
      method: 'POST',
      headers: {
        ...this.headers,
        origin: 'https://www.alienwarearena.com',
        referer: 'https://www.alienwarearena.com/account/personalization'
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
      url: 'https://www.alienwarearena.com/tos/track',
      method: 'POST',
      headers: {
        ...this.headers,
        origin: 'https://www.alienwarearena.com',
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

  async sendTrack(): Promise<void> {
    if (this.trackTimes % 3 === 0) {
      // await this.updateDailyQuests();
      if (!this.questInfo.timeOnSite) {
        return log(time() + chalk.yellow('没有获取到在线任务信息，跳过此任务'));
      }
      if (this.questInfo.timeOnSite.addedArp >= this.questInfo.timeOnSite.maxArp) {
        this.questStatus.timeOnSite = 'complete';
        return log(time() + chalk.green('每日在线任务完成！'));
      }
      log(`${time()}当前每日在线任务进度：${chalk.blue(`${this.questInfo.timeOnSite.addedArp}/${this.questInfo.timeOnSite.maxArp}`)}`);
    }
    if (this.trackError >= 6) {
      return log(time() + chalk.red('发送') + chalk.yellow('[AWA]') + chalk.red('在线心跳连续失败超过6次，跳过此任务'));
    }
    log(`${time()}正在发送${chalk.yellow('AWA')}在线心跳...`, false);
    const options: AxiosRequestConfig = {
      url: 'https://www.alienwarearena.com/tos/track',
      method: 'POST',
      headers: {
        ...this.headers,
        origin: 'https://www.alienwarearena.com',
        referer: 'https://www.alienwarearena.com/account/personalization'
      },
      data: JSON.stringify({ url: 'https://www.alienwarearena.com/account/personalization' })
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    await axios(options)
      .then((response) => {
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
      })
      .catch((e) => {
        log(chalk.red('Error'));
        console.error(e);
        this.trackError++;
        return false;
      });
    await sleep(60);
    this.sendTrack();
  }

  viewPost(postId?: string): Promise<boolean> {
    log(`${time()}正在浏览帖子${chalk.yellow(postId)}...`, false);
    const options: AxiosRequestConfig = {
      url: `https://www.alienwarearena.com/ucf/increment-views/${postId}`,
      method: 'POST',
      headers: {
        ...this.headers,
        origin: 'https://www.alienwarearena.com',
        referer: `https://www.alienwarearena.com/ucf/show/${postId}`
      }
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        if (response.data === 'success') {
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
    for (const post of posts) {
      await this.viewPost(post);
      await sleep(random(1, 5));
    }
    return true;
  }
  async replyPost(postId?: string): Promise<boolean> {
    log(`${time()}正在获取每日任务相关帖子...`, false);
    const getOptions: AxiosRequestConfig = {
      url: 'https://www.alienwarearena.com/forums/board/113/awa-on-topic',
      method: 'GET',
      headers: this.headers
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
        log(chalk.red('Error'));
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
      url: `https://www.alienwarearena.com/comments/${postId}/new/ucf`,
      method: 'POST',
      headers: {
        ...this.headers,
        origin: 'https://www.alienwarearena.com',
        referer: `https://www.alienwarearena.com/ucf/show/${postId}`,
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

  sharePost(postId?: string): Promise<boolean> {
    log(`${time()}正在分享帖子${chalk.yellow(postId)}...`, false);
    const options: AxiosRequestConfig = {
      url: `https://www.alienwarearena.com/arp/quests/share/${postId}`,
      method: 'POST',
      headers: {
        ...this.headers,
        origin: 'https://www.alienwarearena.com',
        referer: `https://www.alienwarearena.com/ucf/show/${postId}`
      },
      responseType: 'text'
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response) => {
        if (response.data === '{}') {
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
  async sharePosts(postIds?: Array<string>): Promise<boolean> {
    const posts = (postIds || this.posts).slice(0, 3);
    if (!posts?.length) {
      return false;
    }
    for (const post of posts) {
      await this.sharePost(post);
      await sleep(random(1, 5));
    }
    return true;
  }
  formatQuestInfo() {
    return {
      ['每日任务']: {
        ['状态']: this.questInfo.dailyQuest?.status === 'complete' ? '已完成' : '未完成',
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
