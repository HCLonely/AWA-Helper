"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatProxy = exports.http = exports.ask = exports.netError = exports.checkUpdate = exports.time = exports.random = exports.sleep = exports.log = void 0;
/* eslint-disable max-len */
/* global __, proxy */
const chalk = require("chalk");
const dayjs = require("dayjs");
const fs = require("fs");
const axios_1 = require("axios");
const tunnel = require("tunnel");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const yaml_1 = require("yaml");
const util_1 = require("util");
const getSecertValue = () => {
    if (!fs.existsSync('config.yml')) {
        return '__________';
    }
    try {
        const { awaCookie = '__________', twitchCookie = '__________', asfPassword = '__________', proxy: { host = '__________', username = '__________', password = '__________' }, asfHost = '__________' } = (0, yaml_1.parse)(fs.readFileSync('config.yml').toString());
        const secrets = [];
        secrets.push(...awaCookie.split(';').map((e) => e.split('=')[1]).filter((e) => e));
        secrets.push(...twitchCookie.split(';').map((e) => e.split('=')[1]).filter((e) => e));
        secrets.push(asfPassword, host, username, password, asfHost);
        return [...new Set(secrets)].join('|');
    }
    catch {
        return '__________';
    }
};
globalThis.secrets = getSecertValue();
const toJSON = (e) => {
    if (typeof e === 'string') {
        // eslint-disable-next-line no-control-regex
        return e.replace(/\x1B\[[\d]*?m/g, '');
    }
    return (0, util_1.format)(e);
};
const log = (text, newLine = true) => {
    fs.appendFileSync('log.txt', toJSON(text).replace(new RegExp(globalThis.secrets, 'gi'), '********')
        .replace(/(PHPSESSID|REMEMBERME|sc=)=[\w\d%.-]*/g, '********') + (newLine ? '\n' : ''));
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
        return `: ${chalk.yellow(__('timeout'))}`;
    }
    if (error.message.includes('ECONNREFUSED')) {
        return `: ${chalk.yellow(__('connRefused'))}`;
    }
    if (error.message.includes('hang up') || error.message.includes('ECONNRESET')) {
        return `: ${chalk.yellow(__('connReset'))}`;
    }
    if (error.message.includes('certificate') || error.message.includes('TLS') || error.message.includes('SSL')) {
        return `: ${chalk.yellow(__('certificateError'))}`;
    }
    return '';
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
                log(`${time()}${chalk.yellow(__('retrying', chalk.blue(retryCount)))}`, false);
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
    log(`${time()}${__('checkingUpdating')}`, false);
    const options = {
        validateStatus: (status) => status === 302,
        maxRedirects: 0
    };
    if (proxy?.enable?.includes('github') && proxy.host && proxy.port) {
        options.httpsAgent = formatProxy(proxy);
    }
    return await http.head('https://github.com/HCLonely/AWA-Helper/releases/latest', options)
        .then((response) => {
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(response.headers['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
        const latestVersion = response.headers.location.match(/tag\/v([\d.]+)/)?.[1];
        if (latestVersion) {
            const currentVersionArr = version.replace('V', '').split('.').map((e) => parseInt(e, 10));
            const latestVersionArr = latestVersion.split('.').map((e) => parseInt(e, 10));
            if (latestVersionArr[0] > currentVersionArr[0] ||
                (latestVersionArr[0] === currentVersionArr[0] && latestVersionArr[1] > currentVersionArr[1]) ||
                (latestVersionArr[0] === currentVersionArr[0] && latestVersionArr[1] === currentVersionArr[1] && latestVersionArr[2] > currentVersionArr[2])) {
                log(chalk.green(__('newVersion', chalk.yellow(`V${latestVersion}`))));
                log(`${time()}${__('downloadLink', chalk.yellow(response.headers.location))}`);
                return;
            }
            log(chalk.green(__('noUpdate')));
            return;
        }
        log(chalk.red('Failed'));
        return;
    })
        .catch((error) => {
        log(chalk.red('Error') + netError(error));
        globalThis.secrets = [...new Set([...globalThis.secrets.split('|'), ...(error.response?.headers?.['set-cookie'] || []).map((e) => e.split(';')[0].trim().split('=')[1]).filter((e) => e && e.length > 5)])].join('|');
        log(error);
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
