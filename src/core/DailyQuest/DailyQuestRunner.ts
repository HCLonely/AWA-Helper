import { trackRunStep } from '../Manager/RunHistory';
import type { TaskOutcome } from '../TaskOutcome';
import { logWriter } from '../../tools/logging/LogWriter';
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
import { BattlePassTask } from './tasks/BattlePassTask';
import { formatQuestReport } from './QuestReporter';
import { SteamClient } from '../../client/Steam/SteamClient';
import { formatQuestFailure } from './QuestFailure';
import * as fs from 'fs';
import { sleep, configureWebUiColors, Logger, time, checkUpdate, push, pushQuestInfoFormat } from '../../tools';
import chalk from 'chalk';
import * as i18n from 'i18n';
import { hasRunConfiguration, getRunConfiguration as loadConfig, createSessionCommit as createCookieCommit } from '../../tools/config/RunConfiguration';
import { runWithRequestSignal } from '../../tools/http/RequestContext';
import { setLogSecrets } from '../../tools/logging/sanitize';
import { maintainLogs } from '../../tools/logging/retention';
import { DEFAULT_AWA_HOST, DEFAULT_USER_AGENT } from '../../client/shared';

// @ts-ignore 在构建期间由 YAML 生成。
import * as zh from '../../locales/zh.json';
// @ts-ignore 在构建期间由 YAML 生成。
import * as en from '../../locales/en.json';

interface DailyQuestRunnerOptions {
  signal?: AbortSignal
  onOutcome?: (outcome: TaskOutcome) => void
}

type TerminalOutcome = 'timeout' | 'failed' | 'completed';

/**
 * 执行 run Daily Quest 相关数据。
 * @param options - 创建实例或执行操作所需的配置选项，类型为 `DailyQuestRunnerOptions`。
 * @returns `Promise<boolean>`，明确表示每日任务是否成功完成。
 */
const runDailyQuest = async ({ signal, onOutcome }: DailyQuestRunnerOptions = {}): Promise<boolean> => {
  const managed = hasRunConfiguration();
  if (!managed) {
    globalThis.log = true;
  }
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
  const quests: Array<{ name: string, promise: Promise<PromiseSettledResult<unknown>> }> = [];
  const children: Array<Promise<unknown>> = [];
  const trackChild = (promise: Promise<unknown>): void => {
    children.push(Promise.allSettled([promise]));
  };
  const trackQuest = (name: string, promise: Promise<unknown>): void => {
    const settled = promise.then<PromiseSettledResult<unknown>, PromiseSettledResult<unknown>>(
      (value) => ({ status: 'fulfilled', value }), (reason: unknown) => {
        if (!shutdownController.signal.aborted) {
          new Logger(time() + chalk.red(formatQuestFailure(name, reason)));
        }
        return { status: 'rejected', reason };
      }
    );
    quests.push({ name, promise: settled });
    children.push(settled);
  };
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
  let commitCookie: ((cookie: string) => boolean) | undefined;
  let awaInitialized = false;
  let partialOutcome = false;
  /**
   * 处理 current Push Info 相关逻辑。
   * @returns `{ report: QuestReport; dailyArp: string; signArp: { daily?: string; monthly?: string; }; } | undefined`，当前可推送的任务报告与积分信息；尚未生成报告时返回 `undefined`。
   */
  const currentPushInfo = () => (runtimeHolder.current ? {
    report: formatQuestReport(runtimeHolder.current.state), dailyArp: runtimeHolder.current.state.dailyArp,
    signArp: runtimeHolder.current.state.signArp, battlePass: runtimeHolder.current.state.battlePass
  } : undefined);
  return runWithRequestSignal(shutdownController.signal, async () => {
    try {
    // 国际化
      if (!managed) {
        i18n.configure({
          locales: ['zh', 'en'],
          staticCatalog: {
            zh,
            en
          },
          defaultLocale: 'zh',
          register: globalThis
        });
      }
      // Manager 统一管理项目级启动信息和共享服务器的生命周期。
      const { version } = globalThis;

      let loadedConfig: ReturnType<typeof loadConfig>;
      try {
        loadedConfig = loadConfig();
      } catch (error) {
        const locatedError = error as Error & { mark?: { line: number } };
        const errorLine = Number.isInteger(locatedError.mark?.line) ? chalk.blue((locatedError.mark?.line || 0) + 1) : '???';
        new Logger(time() + chalk.red(__('configFileErrorAlter', errorLine, chalk.yellow(__('configFileErrorLocation')))));
        new Logger(locatedError.message);
        return false;
      }
      const { path: configPath, raw: config } = loadedConfig;
      commitCookie = createCookieCommit(configPath, config.awaCookie || '');
      setLogSecrets(config);
      const {
        language,
        timeout,
        logsExpire,
        debug,
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
        UA
      }: config = config;
      if (!managed && TLSRejectUnauthorized === false) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      }
      if (!managed) {
        globalThis.webUI = !!webUI?.enable;
        configureWebUiColors(globalThis.webUI);
        globalThis.language = language || 'zh';
        globalThis.pusher = pusher;
      }
      const resolvedAwaHost = awaHost || DEFAULT_AWA_HOST;
      const userAgent = UA || DEFAULT_USER_AGENT;
      if (!managed) {
        i18n.setLocale(language);
      }

      // 清理日志
      if (!managed && fs.existsSync('logs')) {
        if (logsExpire) {
          const logger = new Logger(`${time()}${__('clearingLogs')}`, false);
          await maintainLogs('logs', logsExpire, 0, (file) => logWriter.isActive(file));
          logger.log(chalk.green(__('logStatusOk')));
        }
      }
      // 设置推送代理
      if (!managed && pusher?.enable && proxy?.enable?.includes('pusher')) {
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
          trackChild(runWithRequestSignal(AbortSignal.timeout(15_000), () => push(`${__('pushTitle')}:\n${__('processTimeout')}\n\n${pushQuestInfoFormat(currentPushInfo())}${globalThis.newVersionNotice}`)
            .catch((error) => new Logger(error))));
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
        return false;
      }

      // 检查更新
      globalThis.newVersionNotice = '';
      await checkUpdate(version, proxy);
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

      const initResult = await trackRunStep('AWA initialization', () => runtime.init());
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
      awaInitialized = true;
      commitCookie(runtime.newCookie);
      const awaAPIs = runtime.awa;

      if (awaQuests.includes('battlePass')) {
        await BattlePassTask.inspect(runtime, shutdownController.signal);
        if (shutdownController.signal.aborted) {
          return false;
        }
        new Logger({ type: 'questInfo', data: formatQuestReport(runtime.state) });
      }

      const failedSequentialTasks: string[] = [];

      // 每日任务
      if (awaQuests.includes('dailyQuest') && (runtime.state.questInfo.dailyQuest || []).filter((e: { status: string; }) => e.status === 'complete').length !== (runtime.state.questInfo.dailyQuest || []).length) {
        const dailyQuest = new DailyTask(runtime);
        if (!await trackRunStep('AWA DailyQuest', () => dailyQuest.do(shutdownController.signal))) {
          failedSequentialTasks.push('AWA DailyQuest');
        }
        if (shutdownController.signal.aborted) {
          return false;
        }
      }
      // 每日任务(旧版)
      if (awaQuests.includes('dailyQuestOld') && (runtime.state.questInfo.dailyQuest || []).filter((e: { status: string; }) => e.status === 'complete').length !== (runtime.state.questInfo.dailyQuest || []).length) {
        const dailyQuestOld = new LegacyDailyTask(runtime, {
          awaDailyQuestType
        });
        if (!await trackRunStep('AWA Legacy DailyQuest', () => dailyQuestOld.do(shutdownController.signal))) {
          failedSequentialTasks.push('AWA Legacy DailyQuest');
        }
        if (shutdownController.signal.aborted) {
          return false;
        }
      }

      // AWA在线时长
      if (awaQuests.includes('timeOnSite') && runtime.state.questInfo.timeOnSite?.addedArp !== runtime.state.questInfo.timeOnSite?.maxArp) {
        trackQuest('AWA TimeOnSite', trackRunStep('AWA TimeOnSite', () => TimeOnSiteTask.do(runtime, shutdownController.signal)));
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
              await trackRunStep('Twitch session', () => twitch.session.verify());
              twitchLogger.log(chalk.green(__('logStatusOk')));
              const authorizationLogger = new Logger(`${time()}${__('checkAuthorization', chalk.yellow('Twitch'))}`, false);
              twitchReady = (await trackRunStep('Twitch authorization', () => twitch.extensions.checkLinked())).ok;
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
              trackQuest('Twitch', trackRunStep('Twitch', () => twitchTask.run(shutdownController.signal)));
              if (!await sleep(10, shutdownController.signal)) {
                return false;
              }
            } else {
              failedSequentialTasks.push('Twitch initialization');
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
              asfReady = (await trackRunStep('ASF connection', () => steamQuest.session.verify())).ok;
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
              trackQuest('Steam ASF', trackRunStep('Steam ASF', () => steamTask.run(shutdownController.signal)));
              if (!await sleep(30, shutdownController.signal)) {
                return false;
              }
            } else {
              failedSequentialTasks.push('Steam ASF initialization');
            }
          }
        }
      }

      if (shutdownController.signal.aborted) {
        return false;
      }
      trackChild(runtime.monitor(shutdownController.signal).catch((error) => {
        new Logger(`${time()}${__('awaListenerFailed', error instanceof Error ? error.message : String(error))}`);
      }));
      const questResults = await Promise.all(quests.map(({ promise }) => promise));
      if (shutdownController.signal.aborted) {
        return false;
      }
      if (awaQuests.includes('battlePass')) {
        const outcome = await trackRunStep('Battle Pass', () => BattlePassTask.runDetailed(runtime, shutdownController.signal));
        partialOutcome ||= outcome.status === 'partial';
        onOutcome?.(outcome);
        if (outcome.status === 'failed') {
          failedSequentialTasks.push('Battle Pass');
        }
        if (shutdownController.signal.aborted) {
          return false;
        }
        new Logger({ type: 'questInfo', data: formatQuestReport(runtime.state) });
      }
      const failedQuests = [...failedSequentialTasks, ...questResults.flatMap((result, index) => {
        if (result.status === 'rejected' || result.value === false) {
          return [formatQuestFailure(quests[index]?.name || `Task ${index + 1}`, result.status === 'rejected' ? result.reason : undefined)];
        }
        return [];
      })];
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
      new Logger(time() + chalk.green(__(partialOutcome ? 'taskPartiallyCompleted' : 'allTaskCompleted')));
      await push(`${__('pushTitle')}:\n${__(partialOutcome ? 'taskPartiallyCompleted' : 'allTaskCompleted')}\n\n${pushQuestInfoFormat(currentPushInfo())}${globalThis.newVersionNotice}`);
      shutdownController.abort(new Error('DailyQuest completed'));
      return true;
    } finally {
      shutdownController.abort(new Error('DailyQuest cleanup'));
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      signal?.removeEventListener('abort', abortFromManager);
      await Promise.allSettled(children);
      if (awaInitialized && runtimeHolder.current) {
        commitCookie?.(runtimeHolder.current.newCookie);
      }
    }
  });
};

export const runDailyQuestOutcome = async (signal?: AbortSignal): Promise<TaskOutcome> => {
  let partial: TaskOutcome | undefined;
  const ok = await runDailyQuest({ signal, onOutcome: (outcome) => {
    if (outcome.status === 'partial') {
      partial = outcome;
    }
  } });
  if (signal?.aborted) {
    return { status: 'cancelled' };
  }
  if (!ok) {
    return { status: 'failed' };
  }
  return partial ?? { status: 'completed' };
};

export { runDailyQuest, DailyQuestRunnerOptions };
