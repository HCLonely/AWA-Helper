"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatProxy = exports.http = exports.ask = exports.netError = exports.checkUpdate = exports.time = exports.random = exports.sleep = exports.log = void 0;
/* global proxy */
const chalk = require("chalk");
const dayjs = require("dayjs");
const fs = require("fs");
const axios_1 = require("axios");
const tunnel = require("tunnel");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const log = (text, newLine = true) => {
    // eslint-disable-next-line no-control-regex
    fs.appendFileSync('log.txt', text.toString().replace(/\x1B\[[\d]*?m/g, '') + (newLine ? '\n' : ''));
    if (newLine)
        console.log(text);
    else
        process.stdout.write(text);
};
exports.log = log;
const sleep = (time) => new Promise((resolve) => {
    const timeout = setTimeout(() => {
        clearTimeout(timeout);
        resolve(true);
    }, time * 1000);
});
exports.sleep = sleep;
const random = (minNum, maxNum) => Math.floor((Math.random() * (maxNum - minNum + 1)) + minNum);
exports.random = random;
const time = () => chalk.gray(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] `);
exports.time = time;
// eslint-disable-next-line
const netError = (error) => {
    if (error.message.includes('ETIMEDOUT')) {
        return `: ${chalk.yellow('连接超时，请尝试更换代理！')}`;
    }
    if (error.message.includes('ECONNREFUSED')) {
        return `: ${chalk.yellow('连接被拒绝，请尝试更换代理！')}`;
    }
    if (error.message.includes('hang up') || error.message.includes('ECONNRESET')) {
        return `: ${chalk.yellow('连接被重置，请尝试更换代理！')}`;
    }
};
exports.netError = netError;
const formatProxy = (proxy) => {
    let agent;
    const proxyOptions = {
        host: proxy.host,
        port: proxy.port
    };
    if (proxy.protocol?.includes('socks')) {
        proxyOptions.hostname = proxy.host;
        if (proxy.username && proxy.password) {
            proxyOptions.userId = proxy.username;
            proxyOptions.password = proxy.password;
        }
        agent = new socks_proxy_agent_1.SocksProxyAgent(proxyOptions);
    }
    else if (proxy.protocol === 'http') {
        if (proxy.username && proxy.password) {
            proxyOptions.proxyAuth = `${proxy.username}:${proxy.password}`;
        }
        agent = tunnel.httpsOverHttp({
            proxy: proxyOptions
        });
    }
    else if (proxy.protocol === 'https') {
        if (proxy.username && proxy.password) {
            proxyOptions.proxyAuth = `${proxy.username}:${proxy.password}`;
        }
        agent = tunnel.httpsOverHttps({
            proxy: proxyOptions
        });
    }
    if (agent.options) {
        agent.options.rejectUnauthorized = false;
    }
    return agent;
};
exports.formatProxy = formatProxy;
const retryAdapterEnhancer = (adapter, options) => {
    const { times = 0, delay = 300 } = options;
    return async (config) => {
        const { retryTimes = times, retryDelay = delay } = config;
        let retryCount = 0;
        const request = async () => {
            try {
                return await adapter(config);
            }
            catch (err) {
                if (!retryTimes || retryCount >= retryTimes) {
                    return Promise.reject(err);
                }
                retryCount++;
                log(chalk.red('Error'));
                log(`${time()}${chalk.yellow(`正在重试第 ${chalk.blue(retryCount)} 次...`)}`, false);
                const delay = new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(true);
                    }, retryDelay);
                });
                return delay.then(() => request());
            }
        };
        return request();
    };
};
const http = axios_1.default.create({
    adapter: retryAdapterEnhancer(axios_1.default.defaults.adapter, {
        delay: 1000,
        times: 3
    })
});
exports.http = http;
const checkUpdate = async (version, proxy) => {
    log(`${time()}正在检测更新...`, false);
    const options = {
        validateStatus: (status) => status === 302,
        maxRedirects: 0
    };
    if (proxy?.enable?.includes('github') && proxy.host && proxy.port) {
        options.httpsAgent = formatProxy(proxy);
    }
    return await http.head('https://github.com/HCLonely/AWA-Helper/releases/latest', options)
        .then((response) => {
        const latestVersion = response.headers.location.match(/tag\/v([\d.]+)/)?.[1];
        if (latestVersion) {
            const currentVersionArr = version.replace('V', '').split('.').map((e) => parseInt(e, 10));
            const latestVersionArr = latestVersion.split('.').map((e) => parseInt(e, 10));
            if (latestVersionArr[0] > currentVersionArr[0] ||
                (latestVersionArr[0] === currentVersionArr[0] && latestVersionArr[1] > currentVersionArr[1]) ||
                (latestVersionArr[0] === currentVersionArr[0] && latestVersionArr[1] === currentVersionArr[1] && latestVersionArr[2] > currentVersionArr[2])) {
                log(chalk.green('检测到最新版 ') + chalk.yellow(`V${latestVersion}`));
                log(`${time()}最新版下载地址: ${chalk.yellow(response.headers.location)}`);
                return;
            }
            log(chalk.green('当前为最新版！'));
            return;
        }
        log(chalk.red('Failed'));
        return;
    })
        .catch((error) => {
        log(chalk.red('Error') + netError(error));
        console.error(error);
        return;
    });
};
exports.checkUpdate = checkUpdate;
const ask = (question, answers) => new Promise((resolve) => {
    process.stdout.write(`${question}\n`);
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', async (chunk) => {
        const answer = chunk.toString().trim();
        if (answers) {
            if (!answers.includes(answer)) {
                return resolve(await ask(question, answers));
            }
        }
        return resolve(answer);
    });
});
exports.ask = ask;
