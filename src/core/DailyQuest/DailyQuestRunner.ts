/**
 * @file DailyQuestRunner
 * @description Runs one complete DailyQuest job under Manager lifecycle control.
 */
/* global config, __ */
import { AWAClient } from '../../client/AWA/AWAClient';
import { DailyTask } from './tasks/DailyTask';
import { LegacyDailyTask } from './tasks/LegacyDailyTask';
import { TimeOnSiteTask } from './tasks/TimeOnSiteTask';
import { TwitchClient } from '../../client/Twitch/TwitchClient';
import { SteamClient } from '../../client/Steam/SteamClient';
import * as fs from 'fs';
import { join, resolve } from 'path';
import { parse } from 'yaml';
import { sleep, Logger, time, checkUpdate, push, pushQuestInfoFormat } from '../../tools';
import chalk from 'chalk';
import * as yamlLint from 'yaml-lint';
import * as i18n from 'i18n';
// @ts-ignore
import CHANGELOG from '../../CHANGELOG.txt';
import { createConfigValidationError, updateYamlFieldsSync } from '../../tools/config/YamlConfig';
import { deepMerge, validateHelperConfig } from '../../tools/config/ConfigSchema';
import { setLogSecrets } from '../../tools/logging/sanitize';
import { cleanupExpiredLogs } from '../../tools/logging/retention';

// @ts-ignore
import * as zh from '../../locales/zh.json';
// @ts-ignore
import * as en from '../../locales/en.json';

interface DailyQuestRunnerOptions {
  signal?: AbortSignal
}

const runDailyQuest = async ({ signal }: DailyQuestRunnerOptions = {}): Promise<boolean | void> => {
  globalThis.log = true;
  const shutdownController = new AbortController();
  const abortFromManager = (): void => shutdownController.abort(signal?.reason);
  if (signal?.aborted) abortFromManager();
  else signal?.addEventListener('abort', abortFromManager, { once: true });
  let activeTaskCompletion: Promise<Array<PromiseSettledResult<unknown>>> = Promise.resolve([]);
  const waitForTaskCleanup = async (): Promise<void> => {
    await Promise.race([
      activeTaskCompletion,
      new Promise((resolve) => setTimeout(resolve, 15 * 1000))
    ]);
  };

  // 国际化
  i18n.configure({
    locales: ['zh', 'en'],
    staticCatalog: {
      zh,
      en
    },
    defaultLocale: 'zh',
    register: globalThis
  });
  // Manager owns project-level startup information and the shared server lifecycle.
  const { version } = globalThis;

  // 获取配置文件路径
  let configPath = 'config.yml';
  if (/dist$/.test(process.cwd()) || /output$/.test(process.cwd())) {
    if (!fs.existsSync(configPath) && fs.existsSync(join('../', configPath))) {
      configPath = join('../', configPath);
    }
  }
  if (!fs.existsSync(configPath)) {
    configPath = 'config/config.yml';
    if (/dist$/.test(process.cwd()) || /output$/.test(process.cwd())) {
      if (!fs.existsSync(configPath) && fs.existsSync(join('../', configPath))) {
        configPath = join('../', configPath);
      }
    }
  }
  if (!fs.existsSync(configPath)) {
    new Logger(chalk.red(`${__('configFileNotFound')}[${chalk.yellow(resolve(configPath))}]!`));
    return;
  }

  globalThis.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.134 Safari/537.36 Edg/103.0.1264.77';

  // 默认配置
  const defaultConfig: config = {
    language: 'zh',
    timeout: 86400,
    logsExpire: 30,
    webUI: {
      enable: false,
      port: 3456,
      local: true,
      reverseProxyPort: 0
    },
    awaHost: 'www.alienwarearena.com',
    awaBoosterNotice: true,
    awaQuests: ['getStarted', 'dailyQuest', 'timeOnSite', 'watchTwitch', 'steamQuest'],
    awaDailyQuestType: [
      'click',
      'visitLink',
      'openLink',
      'changeBorder',
      'changeAvatar',
      'viewNews'
    ],
    asfProtocol: 'http'
  };
  // 读取配置文件
  const configString = fs.readFileSync(configPath).toString();
  let config: config | null = null;
  await yamlLint
    .lint(configString)
    .then(() => {
      const parsedConfig = deepMerge(defaultConfig, parse(configString));
      const validationErrors = validateHelperConfig(parsedConfig);
      if (validationErrors.length > 0) {
        throw createConfigValidationError(configString, validationErrors);
      }
      config = parsedConfig;
      setLogSecrets(parsedConfig);
    })
    .catch((error) => {
      const errorLine = Number.isInteger(error.mark?.line) ? chalk.blue(error.mark.line + 1) : '???';
      new Logger(time() + chalk.red(__('configFileErrorAlter', errorLine, chalk.yellow(__('configFileErrorLocation')))));
      new Logger(error.message);
    });
  if (!config) {
    return;
  }
  const {
    language,
    timeout,
    logsExpire,
    autoUpdate,
    awaCookie,
    awaHost,
    awaQuests,
    awaDailyQuestType,
    twitchCookie,
    steamUse,
    asfProtocol,
    asfHost,
    asfPort,
    asfPassword,
    asfBotname,
    proxy,
    webUI,
    pusher,
    joinSteamCommunityEvent,
    TLSRejectUnauthorized,
    managerServer
  }: config = config;
  if (TLSRejectUnauthorized === false) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  globalThis.webUI = !!webUI?.enable;
  globalThis.language = language || 'zh';
  globalThis.pusher = pusher;
  globalThis.awaHost = awaHost || 'www.alienwarearena.com';
  i18n.setLocale(language);

  // 清理日志
  if (fs.existsSync('logs')) {
    if (logsExpire) {
      const logger = new Logger(`${time()}${__('clearingLogs')}`, false);
      cleanupExpiredLogs('logs', logsExpire);
      logger.log(chalk.green('OK'));
    }
  }
  // 设置推送代理
  if (pusher?.enable && proxy?.enable?.includes('pusher')) {
    globalThis.pusherProxy = proxy;
  }

  // 设置超时
  if (timeout && typeof timeout === 'number' && timeout > 0) {
    const timeoutHandle = setTimeout(async () => {
      shutdownController.abort(new Error('Process timeout'));
      new Logger(chalk.yellow(__('processTimeout')));
      await push(`${__('pushTitle')}:\n${__('processTimeout')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
      await waitForTaskCleanup();
    }, timeout * 1000);
    timeoutHandle.unref();
  }

  // 检查AWA参数
  const missingAwaParams = Object.entries({
    awaCookie
  }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
  if (missingAwaParams.length > 0) {
    new Logger(chalk.red(__('missingAwaParams')));
    new Logger(missingAwaParams);
    return;
  }

  // 检查更新
  globalThis.newVersionNotice = '';
  await checkUpdate(version, managerServer, !!autoUpdate || process.argv.includes('--update'), CHANGELOG, proxy);
  if (process.argv.includes('--update')) {
    return true;
  }

  // 初始化AWA
  const awa = new AWAClient({
    awaCookie: awaCookie as string,
    proxy,
    joinSteamCommunityEvent,
    // awaDailyQuestNumber1,
    getStarted: awaQuests.includes('getStarted')
  });

  const initResult = await awa.init();
  if (initResult !== 200) {
    const errorMap = {
      0: __('netError'),
      602: __('tokenExpired'),
      603: __('noBorderAndBadges'),
      604: __('noBorder'),
      605: __('noBadges'),
      610: __('ipBanned')
    };
    const initError = errorMap[initResult as keyof typeof errorMap] || __('unknownError');
    try {
      await push(`${__('pushTitle')}:\n${__('processInitError')}\n\n${initError}, ${__('checkLog')}${globalThis.newVersionNotice}`);
    } catch (_e) {
      await push(`${__('pushTitle')}:\n${__('processInitError')}${globalThis.newVersionNotice}`);
    }
    shutdownController.abort(new Error('DailyQuest initialization failed'));
    return false;
  }
  updateYamlFieldsSync(configPath, { awaCookie: awa.newCookie });
  globalThis.quest = awa;

  // 每日任务
  if (awaQuests.includes('dailyQuest') && (awa.questInfo.dailyQuest || []).filter((e: { status: string; }) => e.status === 'complete').length !== (awa.questInfo.dailyQuest || []).length) {
    const dailyQuest = new DailyTask();
    await dailyQuest.do();
  }
  // 每日任务(旧版)
  if (awaQuests.includes('dailyQuestOld') && (awa.questInfo.dailyQuest || []).filter((e: { status: string; }) => e.status === 'complete').length !== (awa.questInfo.dailyQuest || []).length) {
    const dailyQuestOld = new LegacyDailyTask({
      awaDailyQuestType
    });
    await dailyQuestOld.do();
  }

  const quests: Array<{ name: string, promise: Promise<unknown> }> = [];

  // AWA在线时长
  if (awaQuests.includes('timeOnSite') && awa.questInfo.timeOnSite?.addedArp !== awa.questInfo.timeOnSite?.maxArp) {
    quests.push({ name: 'AWA TimeOnSite', promise: TimeOnSiteTask.do(shutdownController.signal) });
  }
  await sleep(10);

  // Twitch直播心跳
  // let twitch: TwitchTrack | null = null;
  if (awaQuests.includes('watchTwitch')) {
    await awa.getTwitchTech();
    if (awa.questInfo.watchTwitch?.[0] !== '15' || parseFloat(awa.questInfo.watchTwitch?.[1] || '0') < awa.additionalTwitchARP) {
      if (twitchCookie) {
        const twitch = new TwitchClient({ cookie: twitchCookie, proxy });
        if (await twitch.init() === true) {
          quests.push({ name: 'Twitch', promise: twitch.do(shutdownController.signal) });
          await sleep(10);
        }
      } else {
        new Logger(time() + chalk.yellow(__('missingTwitchParams', chalk.blue('["twitchCookie"]'))));
      }
    } else {
      new Logger(time() + chalk.green(__('twitchTaskCompleted')));
    }
  }

  // Steam任务
  // let steamQuest: SteamQuestASF | null = null;
  if (!steamUse || steamUse === 'ASF') {
    const missingAsfParams = Object.entries({
      asfProtocol,
      asfHost,
      asfPort,
      asfBotname
    }).filter(([name, value]) => name !== 'proxy' && !value).map(([name]) => name);
    if (awaQuests.includes('steamQuest')) {
      if (missingAsfParams.length > 0) {
        new Logger(time() + chalk.yellow(__('missingSteamParams', chalk.blue(JSON.stringify(missingAsfParams)))));
      } else {
        const steamQuest = new SteamClient({
          asfProtocol,
          asfHost: asfHost as string,
          asfPort: asfPort as number,
          asfPassword,
          asfBotname: asfBotname as string,
          proxy
        });
        if (await steamQuest.init()) {
          quests.push({ name: 'Steam ASF', promise: steamQuest.do(shutdownController.signal) });
          await sleep(30);
        }
      }
    }
  }

  void awa.listen(shutdownController.signal).catch((error) => {
    new Logger(`${time()}AWA listener failed: ${error instanceof Error ? error.message : String(error)}`);
  });
  activeTaskCompletion = Promise.allSettled(quests.map(({ promise }) => promise));
  const questResults = await activeTaskCompletion;
  const failedQuests = questResults.flatMap((result, index) => {
    if (result.status === 'rejected' || result.value === false) {
      return [quests[index]?.name || `Task ${index + 1}`];
    }
    return [];
  });
  if (failedQuests.length > 0) {
    const errorMessage = `${__('processError')}: ${failedQuests.join(', ')}`;
    new Logger(time() + chalk.red(errorMessage));
    await push(`${__('pushTitle')}:\n${errorMessage}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
    shutdownController.abort(new Error('DailyQuest failed'));
    signal?.removeEventListener('abort', abortFromManager);
    return false;
  }
  new Logger(time() + chalk.green(__('allTaskCompleted')));
  await push(`${__('pushTitle')}:\n${__('allTaskCompleted')}\n\n${pushQuestInfoFormat()}${globalThis.newVersionNotice}`);
  shutdownController.abort(new Error('DailyQuest completed'));
  signal?.removeEventListener('abort', abortFromManager);
  return true;
};

export { runDailyQuest, DailyQuestRunnerOptions };
