"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyQuest = void 0;
/* eslint-disable max-len */
/* global questStatus, proxy */
const axios_1 = require("axios");
const cheerio_1 = require("cheerio");
const chalk = require("chalk");
const FormData = require("form-data");
const tunnel = require("tunnel");
const tool_1 = require("./tool");
const fs = require("fs");
class DailyQuest {
    constructor(awaCookie, awaUserId, awaBorderId, awaBadgeIds, proxy) {
        // eslint-disable-next-line no-undef
        this.questInfo = {};
        this.trackError = 0;
        this.trackTimes = 0;
        this.questStatus = {};
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
    init() {
        return this.updateDailyQuests(true);
    }
    async listen(twitch, steamQuest, check = false) {
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
            if ((this.questStatus.dailyQuest === 'complete' || this.questInfo.dailyQuest?.status === 'complete') && (this.questStatus.timeOnSite === 'complete' || this.questInfo.timeOnSite?.addedArp === this.questInfo.timeOnSite?.maxArp) && this.questStatus.watchTwitch === 'complete' && this.questStatus.steamQuest === 'complete') {
                (0, tool_1.log)((0, tool_1.time)() + chalk.green('今日所有任务已完成！'));
                (0, tool_1.log)('按任意键退出...');
                process.stdin.setRawMode(true);
                process.stdin.on('data', () => process.exit(0));
                return;
            }
            if (check)
                return;
            await (0, tool_1.sleep)(60 * 5);
            this.listen(twitch, steamQuest);
        }
    }
    updateDailyQuests(verify = false) {
        (0, tool_1.log)((0, tool_1.time)() + (verify ? `正在验证 ${chalk.yellow('AWA')} Token...` : '正在获取任务信息...'), false);
        const options = {
            url: 'https://www.alienwarearena.com/',
            method: 'GET',
            headers: this.headers
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return (0, axios_1.default)(options)
            .then((response) => {
            if (response.status === 200) {
                const $ = (0, cheerio_1.load)(response.data);
                if ($('a.nav-link-login').length > 0) {
                    (0, tool_1.log)(chalk.red('Token已过期'));
                    return 401;
                }
                (0, tool_1.log)(chalk.green('OK'));
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
                }
                else if (maxArp !== 0) {
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
                if (!verify)
                    (0, tool_1.log)(`${(0, tool_1.time)()}当前任务信息:`);
                const formatQuestInfo = this.formatQuestInfo();
                fs.appendFileSync('log.txt', `${JSON.stringify(formatQuestInfo, null, 4)}\n`);
                if (!verify)
                    console.table(formatQuestInfo);
                this.posts = $('.tile-slider__card a[href*="/ucf/show/"]').toArray()
                    .map((e) => $(e).attr('href')?.match(/ucf\/show\/([\d]+)/)?.[1])
                    .filter((e) => e);
                if ($('a.quest-title').length > 0) {
                    this.dailyQuestLink = new URL($('a.quest-title[href]').attr('href'), 'https://www.alienwarearena.com/').href;
                }
                return 200;
            }
            (0, tool_1.log)(chalk.red('Net Error'));
            return response.status;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error'));
            console.error(error);
            return 0;
        });
    }
    async do() {
        if (this.questInfo.dailyQuest?.status === 'complete') {
            this.questStatus.dailyQuest = 'complete';
            return (0, tool_1.log)((0, tool_1.time)() + chalk.green('每日任务已完成！'));
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
            return (0, tool_1.log)((0, tool_1.time)() + chalk.green('每日任务已完成！'));
        }
        await this.replyPost();
        await this.updateDailyQuests();
        if (this.questInfo.dailyQuest?.status === 'complete') {
            this.questStatus.dailyQuest = 'complete';
            return (0, tool_1.log)((0, tool_1.time)() + chalk.green('每日任务已完成！'));
        }
        this.questStatus.dailyQuest = 'complete';
        return (0, tool_1.log)((0, tool_1.time)() + chalk.red('每日任务未完成！'));
    }
    changeBorder() {
        (0, tool_1.log)(`${(0, tool_1.time)()}正在更换${chalk.yellow('Border')}...`, false);
        const options = {
            url: 'https://www.alienwarearena.com/border/select',
            method: 'POST',
            headers: {
                ...this.headers,
                origin: 'https://www.alienwarearena.com',
                referer: 'https://www.alienwarearena.com/account/personalization'
            },
            data: { id: this.borderId }
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return (0, axios_1.default)(options)
            .then((response) => {
            if (response.data.success) {
                (0, tool_1.log)(chalk.green('OK'));
                return true;
            }
            (0, tool_1.log)(chalk.red('Error'));
            (0, tool_1.log)(response.data?.message || response.statusText);
            return false;
        })
            .catch((e) => {
            (0, tool_1.log)(chalk.red('Error'));
            console.error(e);
            return false;
        });
    }
    changeBadge() {
        (0, tool_1.log)(`${(0, tool_1.time)()}正在更换${chalk.yellow('Badge')}...`, false);
        const options = {
            url: `https://www.alienwarearena.com/badges/update/${this.userId}`,
            method: 'POST',
            headers: {
                ...this.headers,
                origin: 'https://www.alienwarearena.com',
                referer: 'https://www.alienwarearena.com/account/personalization'
            },
            data: JSON.stringify(this.badgeIds)
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return (0, axios_1.default)(options)
            .then((response) => {
            if (response.data.success) {
                (0, tool_1.log)(chalk.green('OK'));
                return true;
            }
            (0, tool_1.log)(chalk.red('Error'));
            (0, tool_1.log)(response.data?.message || response.statusText);
            return false;
        })
            .catch((e) => {
            (0, tool_1.log)(chalk.red('Error'));
            console.error(e);
            return false;
        });
    }
    async sendViewTrack(link) {
        (0, tool_1.log)(`${(0, tool_1.time)()}正在发送浏览${chalk.yellow(link)}心跳...`, false);
        const options = {
            url: 'https://www.alienwarearena.com/tos/track',
            method: 'POST',
            headers: {
                ...this.headers,
                origin: 'https://www.alienwarearena.com',
                referer: link
            },
            data: JSON.stringify({ url: link })
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return await (0, axios_1.default)(options)
            .then((response) => {
            if (response.data.success) {
                (0, tool_1.log)(chalk.green('OK'));
                return true;
            }
            (0, tool_1.log)(chalk.red('Error'));
            (0, tool_1.log)(response.data?.message || response.statusText);
            return false;
        })
            .catch((e) => {
            (0, tool_1.log)(chalk.red('Error'));
            console.error(e);
            return false;
        });
    }
    async sendTrack() {
        if (this.trackTimes % 3 === 0) {
            // await this.updateDailyQuests();
            if (!this.questInfo.timeOnSite) {
                return (0, tool_1.log)((0, tool_1.time)() + chalk.yellow('没有获取到在线任务信息，跳过此任务'));
            }
            if (this.questInfo.timeOnSite.addedArp >= this.questInfo.timeOnSite.maxArp) {
                this.questStatus.timeOnSite = 'complete';
                return (0, tool_1.log)((0, tool_1.time)() + chalk.green('每日在线任务完成！'));
            }
            (0, tool_1.log)(`${(0, tool_1.time)()}当前每日在线任务进度：${chalk.blue(`${this.questInfo.timeOnSite.addedArp}/${this.questInfo.timeOnSite.maxArp}`)}`);
        }
        if (this.trackError >= 6) {
            return (0, tool_1.log)((0, tool_1.time)() + chalk.red('发送') + chalk.yellow('[AWA]') + chalk.red('在线心跳连续失败超过6次，跳过此任务'));
        }
        (0, tool_1.log)(`${(0, tool_1.time)()}正在发送${chalk.yellow('AWA')}在线心跳...`, false);
        const options = {
            url: 'https://www.alienwarearena.com/tos/track',
            method: 'POST',
            headers: {
                ...this.headers,
                origin: 'https://www.alienwarearena.com',
                referer: 'https://www.alienwarearena.com/account/personalization'
            },
            data: JSON.stringify({ url: 'https://www.alienwarearena.com/account/personalization' })
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        await (0, axios_1.default)(options)
            .then((response) => {
            if (response.data.success) {
                (0, tool_1.log)(chalk.green('OK'));
                this.trackError = 0;
                this.trackTimes++;
                return true;
            }
            (0, tool_1.log)(chalk.red('Error'));
            (0, tool_1.log)(response.data?.message || response.statusText);
            this.trackError++;
            return false;
        })
            .catch((e) => {
            (0, tool_1.log)(chalk.red('Error'));
            console.error(e);
            this.trackError++;
            return false;
        });
        await (0, tool_1.sleep)(60);
        this.sendTrack();
    }
    viewPost(postId) {
        (0, tool_1.log)(`${(0, tool_1.time)()}正在浏览帖子${chalk.yellow(postId)}...`, false);
        const options = {
            url: `https://www.alienwarearena.com/ucf/increment-views/${postId}`,
            method: 'POST',
            headers: {
                ...this.headers,
                origin: 'https://www.alienwarearena.com',
                referer: `https://www.alienwarearena.com/ucf/show/${postId}`
            }
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return (0, axios_1.default)(options)
            .then((response) => {
            if (response.data === 'success') {
                (0, tool_1.log)(chalk.green('OK'));
                return true;
            }
            (0, tool_1.log)(chalk.red('Error'));
            (0, tool_1.log)(response.data || response.statusText);
            return false;
        })
            .catch((e) => {
            (0, tool_1.log)(chalk.red('Error'));
            console.error(e);
            return false;
        });
    }
    async viewPosts(postIds) {
        const posts = postIds || this.posts;
        if (!posts?.length) {
            return false;
        }
        for (const post of posts) {
            await this.viewPost(post);
            await (0, tool_1.sleep)((0, tool_1.random)(1, 5));
        }
        return true;
    }
    async replyPost(postId) {
        (0, tool_1.log)(`${(0, tool_1.time)()}正在获取每日任务相关帖子...`, false);
        const getOptions = {
            url: 'https://www.alienwarearena.com/forums/board/113/awa-on-topic',
            method: 'GET',
            headers: this.headers
        };
        if (this.httpsAgent)
            getOptions.httpsAgent = this.httpsAgent;
        const post = postId || await (0, axios_1.default)(getOptions)
            .then((response) => {
            if (response.status === 200) {
                const $ = (0, cheerio_1.load)(response.data);
                const topicPost = $('.card-title a.forums__topic-link').toArray()
                    .filter((e) => /Daily[\s]*?Quest/gi.test($(e).text()))
                    .map((e) => $(e).attr('href')?.match(/ucf\/show\/([\d]+)/)?.[1])
                    .filter((e) => e);
                if (topicPost.length > 0) {
                    (0, tool_1.log)(chalk.green('OK'));
                    return topicPost[0];
                }
                (0, tool_1.log)(chalk.gray('没有找到相关帖子，跳过此步骤！'));
                return false;
            }
            (0, tool_1.log)(chalk.red('Net Error'));
            return false;
        })
            .catch((error) => {
            (0, tool_1.log)(chalk.red('Error'));
            console.error(error);
            return false;
        });
        if (!post) {
            return false;
        }
        (0, tool_1.log)(`${(0, tool_1.time)()}正在回复帖子${chalk.yellow(post)}...`, false);
        const form = new FormData();
        form.append('topic_post[content]', '<p>Thanks!</p>');
        form.append('topic_post[quotedPostIds]', '');
        form.append('topic_post[parentPost]', '');
        const options = {
            url: `https://www.alienwarearena.com/comments/${post}/new/ucf`,
            method: 'POST',
            headers: {
                ...this.headers,
                origin: 'https://www.alienwarearena.com',
                referer: `https://www.alienwarearena.com/ucf/show/${post}`,
                ...form.getHeaders()
            },
            data: form
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return (0, axios_1.default)(options)
            .then((response) => {
            if (response.data.success) {
                (0, tool_1.log)(chalk.green('OK'));
                return true;
            }
            (0, tool_1.log)(chalk.red('Error'));
            (0, tool_1.log)(response.data?.message || response.statusText);
            return false;
        })
            .catch((e) => {
            (0, tool_1.log)(chalk.red('Error'));
            console.error(e);
            return false;
        });
    }
    sharePost(postId) {
        (0, tool_1.log)(`${(0, tool_1.time)()}正在分享帖子${chalk.yellow(postId)}...`, false);
        const options = {
            url: `https://www.alienwarearena.com/arp/quests/share/${postId}`,
            method: 'POST',
            headers: {
                ...this.headers,
                origin: 'https://www.alienwarearena.com',
                referer: `https://www.alienwarearena.com/ucf/show/${postId}`
            },
            responseType: 'text'
        };
        if (this.httpsAgent)
            options.httpsAgent = this.httpsAgent;
        return (0, axios_1.default)(options)
            .then((response) => {
            if (response.data === '{}') {
                (0, tool_1.log)(chalk.green('OK'));
                return true;
            }
            (0, tool_1.log)(chalk.red('Error'));
            (0, tool_1.log)(response.data || response.statusText);
            return false;
        })
            .catch((e) => {
            (0, tool_1.log)(chalk.red('Error'));
            console.error(e);
            return false;
        });
    }
    async sharePosts(postIds) {
        const posts = (postIds || this.posts).slice(0, 3);
        if (!posts?.length) {
            return false;
        }
        for (const post of posts) {
            await this.sharePost(post);
            await (0, tool_1.sleep)((0, tool_1.random)(1, 5));
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
exports.DailyQuest = DailyQuest;
