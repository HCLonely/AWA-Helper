/**
 * @file src/core/DailyQuest/DailyQuestRunner.ts
 * @description 创建每日任务运行环境，依次执行配置加载、任务处理、报告推送和资源清理。
 */
/* global config, __ */
import { DailyQuestRuntime } from './DailyQuestRuntime';
import { DailyTask } from './tasks/DailyTask';
import { LegacyDailyTask } from './tasks/LegacyDailyTask';
import { TimeOnSiteTask } from './tasks/TimeOnSiteTask';
import { TwitchClient } from '../../client/Twitch/TwitchClient';
import { TwitchQuestTask } from './tasks/TwitchQuestTask';
import { SteamQuestTask } from './tasks/SteamQuestTask';
import { formatQuestReport } from './QuestReporter';
import { SteamClient } from '../../client/Steam/SteamClient';
import * as fs from 'fs';
import { join, resolve } from 'path';
import { parse } from 'yaml';
import { sleep, configureWebUiColors, Logger, time, checkUpdate, push, pushQuestInfoFormat } from '../../tools';
import chalk from 'chalk';
import * as yamlLint from 'yaml-lint';
import * as i18n from 'i18n';
// @ts-ignore 由构建流程以文本形式导入。
import { createConfigValidationError, updateYamlFieldsSync } from '../../tools/config/YamlConfig';
import { deepMerge, validateHelperConfig } from '../../tools/config/ConfigSchema';
import { setLogSecrets } from '../../tools/logging/sanitize';
import { cleanupExpiredLogs } from '../../tools/logging/retention';
import { DEFAULT_AWA_HOST, DEFAULT_USER_AGENT } from '../../client/shared';

// @ts-ignore 在构建期间由 YAML 生成。
import * as zh from '../../locales/zh.json';
// @ts-ignore 在构建期间由 YAML 生成。
import * as en from '../../locales/en.json';

interface DailyQuestRunnerOptions {
  signal?: AbortSignal
}

type TerminalOutcome = 'timeout' | 'failed' | 'completed';

/**
 * 执行 run Daily Quest 相关数据。
 * @param options - 创建实例或执行操作所需的配置选项，类型为 `DailyQuestRunnerOptions`。
 * @returns `Promise<boolean | void>`，runDailyQuest 执行完成后的结果。
 */
const runDailyQuest = async ({ signal }: DailyQuestRunnerOptions = {}): Promise<boolean | void> => {
  globalThis.log = true;
  const shutdownController = new AbortController();
  /**
   * 处理 abort From Manager 相关逻辑。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  const abortFromManager = (): void => shutdownController.abort(signal?.reason);
  if (signal?.aborted) {
    abortFromManager();
  } else {
    signal?.addEventListener('abort', abortFromManager, { once: true });
  }
  let activeTaskCompletion: Promise<Array<PromiseSettledResult<unknown>>> = Promise.resolve([]);
  let timeoutHandle: NodeJS.Timeout | undefined;
  let terminalOutcome: TerminalOutcome | undefined;
  const claimTerminalOutcome = (outcome: TerminalOutcome): boolean => {
    if (terminalOutcome) {
      return false;
    }
    terminalOutcome = outcome;
    return true;
  };
  const runtimeHolder: { current?: DailyQuestRuntime } = {};
  /**
   * 处理 current Push Info 相关逻辑。
   * @returns `{ report: QuestReport; dailyArp: string; signArp: { daily?: string; monthly?: string; }; } | undefined`，当前可推送的任务报告与积分信息；尚未生成报告时返回 `undefined`。
   */
  const currentPushInfo = () => (runtimeHolder.current ? {
    report: formatQuestReport(runtimeHolder.current.state), dailyArp: runtimeHolder.current.state.dailyArp,
    signArp: runtimeHolder.current.state.signArp
  } : undefined);
    /**
     * 等待 wait For Task Cleanup 相关数据。
     * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
     */
  const waitForTaskCleanup = async (): Promise<void> => {
    await Promise.race([
      activeTaskCompletion,
      new Promise((resolve) => setTimeout(resolve, 15 * 1000))
    ]);
  };

  try {
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
    // Manager 统一管理项目级启动信息和共享服务器的生命周期。
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

    // 默认配置
    const defaultConfig: config = {
      language: 'zh',
      timeout: 86400,
      logsExpire: 30,
      debug: { http: false },
      webUI: {
        enable: false,
        port: 2345,
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
      debug,
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
      managerServer,
      UA
    }: config = config;
    if (TLSRejectUnauthorized === false) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    globalThis.webUI = !!webUI?.enable;
    configureWebUiColors(globalThis.webUI);
    globalThis.language = language || 'zh';
    globalThis.pusher = pusher;
    const resolvedAwaHost = awaHost || DEFAULT_AWA_HOST;
    const userAgent = UA || DEFAULT_USER_AGENT;
    i18n.setLocale(language);

    // 清理日志
    if (fs.existsSync('logs')) {
      if (logsExpire) {
        const logger = new Logger(`${time()}${__('clearingLogs')}`, false);
        cleanupExpiredLogs('logs', logsExpire);
        logger.log(chalk.green(__('logStatusOk')));
      }
    }
    // 设置推送代理
    if (pusher?.enable && proxy?.enable?.includes('pusher')) {
      globalThis.pusherProxy = proxy;
    }

    // 设置超时
    if (timeout && typeof timeout === 'number' && timeout > 0) {
      timeoutHandle = setTimeout(() => {
        if (!claimTerminalOutcome('timeout')) {
          return;
        }
        shutdownController.abort(new Error('Process timeout'));
        new Logger(chalk.yellow(__('processTimeout')));
        void push(`${__('pushTitle')}:\n${__('processTimeout')}\n\n${pushQuestInfoFormat(currentPushInfo())}${globalThis.newVersionNotice}`)
          .catch((error) => new Logger(error))
          .then(waitForTaskCleanup);
      }, timeout * 1000);
      timeoutHandle.unref();
    }

    if (shutdownController.signal.aborted) {
      return false;
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
    await checkUpdate(version, managerServer, !!autoUpdate || process.argv.includes('--update'), proxy);
    if (shutdownController.signal.aborted) {
      return false;
    }
    if (process.argv.includes('--update')) {
      return true;
    }

    // 初始化AWA
    const runtime = new DailyQuestRuntime({
      awaCookie: awaCookie as string,
      host: resolvedAwaHost,
      proxy,
      joinSteamCommunityEvent,
      getStarted: awaQuests.includes('getStarted'),
      userAgent,
      logRequests: debug?.http === true
    });
    runtimeHolder.current = runtime;

    const initResult = await runtime.init();
    if (shutdownController.signal.aborted) {
      return false;
    }
    if (!initResult.ok) {
      if (!claimTerminalOutcome('failed')) {
        return false;
      }
      const errorMap = {
        'request-failed': __('netError'),
        'session-expired': __('tokenExpired'),
        'network-rejected': __('ipBanned')
      };
      const initError = errorMap[initResult.reason];
      try {
        await push(`${__('pushTitle')}:\n${__('processInitError')}\n\n${initError}, ${__('checkLog')}${globalThis.newVersionNotice}`);
      } catch (_e) {
        await push(`${__('pushTitle')}:\n${__('processInitError')}${globalThis.newVersionNotice}`);
      }
      shutdownController.abort(new Error('DailyQuest initialization failed'));
      return false;
    }
    updateYamlFieldsSync(configPath, { awaCookie: runtime.newCookie });
    const awaAPIs = runtime.awa;

    // 每日任务
    if (awaQuests.includes('dailyQuest') && (runtime.state.questInfo.dailyQuest || []).filter((e: { status: string; }) => e.status === 'complete').length !== (runtime.state.questInfo.dailyQuest || []).length) {
      const dailyQuest = new DailyTask(runtime);
      await dailyQuest.do(shutdownController.signal);
      if (shutdownController.signal.aborted) {
        return false;
      }
    }
    // 每日任务(旧版)
    if (awaQuests.includes('dailyQuestOld') && (runtime.state.questInfo.dailyQuest || []).filter((e: { status: string; }) => e.status === 'complete').length !== (runtime.state.questInfo.dailyQuest || []).length) {
      const dailyQuestOld = new LegacyDailyTask(runtime, {
        awaDailyQuestType
      });
      await dailyQuestOld.do(shutdownController.signal);
      if (shutdownController.signal.aborted) {
        return false;
      }
    }

    const quests: Array<{ name: string, promise: Promise<unknown> }> = [];

    // AWA在线时长
    if (awaQuests.includes('timeOnSite') && runtime.state.questInfo.timeOnSite?.addedArp !== runtime.state.questInfo.timeOnSite?.maxArp) {
      quests.push({ name: 'AWA TimeOnSite', promise: TimeOnSiteTask.do(runtime, shutdownController.signal) });
    }
    if (!await sleep(10, shutdownController.signal)) {
      return false;
    }

    // Twitch直播心跳
    // let twitch: TwitchTrack | null = null;
    if (awaQuests.includes('watchTwitch')) {
      await runtime.loadTwitchBonus();
      if (shutdownController.signal.aborted) {
        return false;
      }
      if (runtime.state.questInfo.watchTwitch?.[0] !== '15' || parseFloat(runtime.state.questInfo.watchTwitch?.[1] || '0') < runtime.state.additionalTwitchARP) {
        if (twitchCookie) {
          const twitch = new TwitchClient({ cookie: twitchCookie, proxy, logRequests: debug?.http === true });
          const twitchLogger = new Logger(`${time()}${__('initing', chalk.yellow('TwitchTrack'))}`, false);
          let twitchReady = false;
          try {
            await twitch.session.verify();
            twitchLogger.log(chalk.green(__('logStatusOk')));
            const authorizationLogger = new Logger(`${time()}${__('checkAuthorization', chalk.yellow('Twitch'))}`, false);
            twitchReady = (await twitch.extensions.checkLinked()).ok;
            authorizationLogger.log(twitchReady ? chalk.green(__('authorized')) : chalk.red(__('notAuthorized')));
          } catch (error) {
            twitchLogger.log(chalk.red(__('logStatusError')));
            new Logger(error);
          }
          if (shutdownController.signal.aborted) {
            return false;
          }
          if (twitchReady) {
            const twitchTask = new TwitchQuestTask(runtime, awaAPIs, twitch);
            quests.push({ name: 'Twitch', promise: twitchTask.run(shutdownController.signal) });
            if (!await sleep(10, shutdownController.signal)) {
              return false;
            }
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
            proxy,
            logRequests: debug?.http === true
          });
          const asfLogger = new Logger(`${time()}${__('initing', chalk.yellow('ASF'))}`, false);
          let asfReady = false;
          try {
            asfReady = (await steamQuest.session.verify()).ok;
            asfLogger.log(asfReady ? chalk.green(__('logStatusOk')) : chalk.red(__('logStatusError')));
          } catch (error) {
            asfLogger.log(chalk.red(__('logStatusError')));
            new Logger(error);
          }
          if (shutdownController.signal.aborted) {
            return false;
          }
          if (asfReady) {
            const steamTask = new SteamQuestTask(awaAPIs, steamQuest, () => runtime.state.communityEvent?.gameId);
            quests.push({ name: 'Steam ASF', promise: steamTask.run(shutdownController.signal) });
            if (!await sleep(30, shutdownController.signal)) {
              return false;
            }
          }
        }
      }
    }

    if (shutdownController.signal.aborted) {
      return false;
    }
    void runtime.monitor(shutdownController.signal).catch((error) => {
      new Logger(`${time()}${__('awaListenerFailed', error instanceof Error ? error.message : String(error))}`);
    });
    activeTaskCompletion = Promise.allSettled(quests.map(({ promise }) => promise));
    const questResults = await activeTaskCompletion;
    if (shutdownController.signal.aborted) {
      return false;
    }
    const failedQuests = questResults.flatMap((result, index) => {
      if (result.status === 'rejected' || result.value === false) {
        return [quests[index]?.name || `Task ${index + 1}`];
      }
      return [];
    });
    if (failedQuests.length > 0) {
      if (!claimTerminalOutcome('failed')) {
        return false;
      }
      const errorMessage = `${__('processError')}: ${failedQuests.join(', ')}`;
      new Logger(time() + chalk.red(errorMessage));
      await push(`${__('pushTitle')}:\n${errorMessage}\n\n${pushQuestInfoFormat(currentPushInfo())}${globalThis.newVersionNotice}`);
      shutdownController.abort(new Error('DailyQuest failed'));
      return false;
    }
    if (!claimTerminalOutcome('completed')) {
      return false;
    }
    new Logger(time() + chalk.green(__('allTaskCompleted')));
    await push(`${__('pushTitle')}:\n${__('allTaskCompleted')}\n\n${pushQuestInfoFormat(currentPushInfo())}${globalThis.newVersionNotice}`);
    shutdownController.abort(new Error('DailyQuest completed'));
    return true;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    signal?.removeEventListener('abort', abortFromManager);
  }
};

export { runDailyQuest, DailyQuestRunnerOptions };
