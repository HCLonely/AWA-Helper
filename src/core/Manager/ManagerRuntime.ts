/**
 * @file src/core/Manager/ManagerRuntime.ts
 * @description 统一管理服务器、计划任务、业务作业以及应用关闭生命周期。
 */
import * as fs from 'fs';
import { execSync } from 'child_process';
import * as os from 'os';
import chalk from 'chalk';
import type { RuntimeMode } from '../../cli/Command';
import { UnifiedServer } from '../../server';
import { loadConfig } from '../../tools/config';
import { setLogSecrets } from '../../tools/logging/sanitize';
import { cleanupExpiredLogs } from '../../tools/logging/retention';
import { Logger, time } from '../../tools';
import { initializeI18n } from '../../tools/i18n';
import { JobCoordinator } from './JobCoordinator';
import { Scheduler } from './Scheduler';
import { AchievementJob, ArtifactJob, DailyQuestJob } from './jobs';
// @ts-ignore 由构建流程以文本形式导入。
import CHANGELOG from '../../CHANGELOG.txt';
// @ts-ignore 在构建期间由 YAML 生成。
import * as zh from '../../locales/zh.json';
// @ts-ignore 在构建期间由 YAML 生成。
import * as en from '../../locales/en.json';

class ManagerRuntime {
  readonly coordinator = new JobCoordinator();
  private readonly loaded = loadConfig();
  private readonly scheduler = new Scheduler(this.coordinator, this.loaded.manager);
  private readonly server: UnifiedServer;
  private stopping = false;
  private shutdownSignalled = false;
  private resolveShutdown!: () => void;
  private readonly shutdownRequested = new Promise<void>((resolve) => { this.resolveShutdown = resolve; });

  /**
   * 初始化 Manager Runtime 实例。
   * @param mode - 用于选择处理分支的类型，类型为 `RuntimeMode`。
   * @param version - 用于比较或展示的应用版本号，类型为 `string`。
   */
  constructor(private readonly mode: RuntimeMode, private readonly version: string) {
    this.server = new UnifiedServer(this.loaded, this.coordinator, version, () => this.requestShutdown());
    this.coordinator.register(new DailyQuestJob());
    this.coordinator.register(new AchievementJob(this.loaded.raw));
    this.coordinator.register(new ArtifactJob(this.loaded.path));
  }

  /**
   * 执行 run 相关数据。
   * @returns `Promise<number>`，run 计算或读取到的数值。
   */
  async run(): Promise<number> {
    this.initializeEnvironment();
    new Logger(`${time()}${__('managerEnvironmentInitialized', __(`managerMode_${this.mode}`), this.version)}`);
    this.printStartupInformation();
    const { webUI } = this.loaded.raw;
    new Logger(`${time()}${webUI?.enable === false
      ? __('managerWebUiDisabled')
      : __('managerWebUiStarting', webUI?.local === false ? '0.0.0.0' : '127.0.0.1', String(webUI?.port || 3456))}`);
    await this.server.start();
    new Logger(`${time()}${__('managerStarted', __(`managerMode_${this.mode}`), String(this.loaded.raw.webUI?.port || 3456))}`);
    if (this.mode === 'once') {
      new Logger(`${time()}${__('managerOneShotSelected')}`);
      const result = await this.coordinator.start('dailyQuest');
      await this.stop();
      return result.success ? 0 : 1;
    }
    new Logger(`${time()}${__('managerStartingScheduler')}`);
    this.scheduler.start();
    await this.shutdownRequested;
    await this.stop();
    return 0;
  }

  /**
   * 请求 request Shutdown 相关数据。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  requestShutdown(): void {
    if (this.shutdownSignalled) return;
    this.shutdownSignalled = true;
    new Logger(`${time()}${__('managerShutdownRequested')}`);
    this.resolveShutdown();
    if (this.mode === 'once') void this.coordinator.stopAll();
  }

  /**
   * 停止 stop 相关数据。
   * @returns `Promise<void>`，异步操作完成后兑现，不携带结果值。
   */
  async stop(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    new Logger(`${time()}${__('managerShutdownStarted')}`);
    this.scheduler.stop();
    await this.coordinator.stopAll();
    await this.server.stop();
    new Logger(`${time()}${__('managerShutdownCompleted')}`);
  }

  /**
   * 初始化 initialize Environment 相关数据。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  private initializeEnvironment(): void {
    fs.mkdirSync('logs', { recursive: true });
    fs.mkdirSync('data', { recursive: true });
    initializeI18n(this.loaded.raw.language, { zh, en });
    globalThis.language = this.loaded.raw.language;
    globalThis.version = this.version;
    globalThis.webUI = this.loaded.raw.webUI?.enable !== false;
    globalThis.pusher = this.loaded.raw.pusher;
    globalThis.log = true;
    globalThis.newVersionNotice = '';
    setLogSecrets(this.loaded.raw);
    if (this.loaded.raw.pusher?.enable && this.loaded.raw.proxy?.enable?.includes('pusher')) {
      globalThis.pusherProxy = this.loaded.raw.proxy;
    }
    if (this.loaded.raw.TLSRejectUnauthorized === false) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    if (this.loaded.raw.logsExpire) cleanupExpiredLogs('logs', this.loaded.raw.logsExpire);
  }

  /**
   * 处理 print Startup Information 相关逻辑。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  private printStartupInformation(): void {
    const displayVersion = `V${this.version.replace(/^v/i, '')}`;
    const logArr = '  ______   __       __   ______           __    __            __\n /      \\ /  |  _  /  | /      \\         /  |  /  |          /  |\n/$$$$$$  |$$ | / \\ $$ |/$$$$$$  |        $$ |  $$ |  ______  $$ |  ______    ______    ______\n$$ |__$$ |$$ |/$  \\$$ |$$ |__$$ | ______ $$ |__$$ | /      \\ $$ | /      \\  /      \\  /      \\\n$$    $$ |$$ /$$$  $$ |$$    $$ |/      |$$    $$ |/$$$$$$  |$$ |/$$$$$$  |/$$$$$$  |/$$$$$$  |\n$$$$$$$$ |$$ $$/$$ $$ |$$$$$$$$ |$$$$$$/ $$$$$$$$ |$$    $$ |$$ |$$ |  $$ |$$    $$ |$$ |  $$/\n$$ |  $$ |$$$$/  $$$$ |$$ |  $$ |        $$ |  $$ |$$$$$$$$/ $$ |$$ |__$$ |$$$$$$$$/ $$ |\n$$ |  $$ |$$$/    $$$ |$$ |  $$ |        $$ |  $$ |$$       |$$ |$$    $$/ $$       |$$ |\n$$/   $$/ $$/      $$/ $$/   $$/         $$/   $$/  $$$$$$$/ $$/ $$$$$$$/   $$$$$$$/ $$/\n                                                                 $$ |\n                                                                 $$ |\n                                                                 $$/               by HCLonely '.split('\n');
    logArr[logArr.length - 2] = `${logArr[logArr.length - 2]}              ${displayVersion}`;
    new Logger(logArr.join('\n'));
    new Logger(chalk.red.bold(`\n${__('codSafetyNotice')}\n`));

    if (!fs.existsSync('.version') || fs.readFileSync('.version', 'utf8').trim() !== displayVersion) {
      new Logger(chalk.green(__('updateContent')));
      console.table(CHANGELOG.trim().split('\n').map((entry: string) => entry.trim().replace('- ', '')));
      if (os.type() === 'Windows_NT') {
        try { execSync('attrib -h .version'); } catch (_error) { /* File may not exist yet. */ }
      }
      fs.writeFileSync('.version', displayVersion);
      if (os.type() === 'Windows_NT') {
        try { execSync('attrib +h .version'); } catch (_error) { /* Hidden attribute is optional. */ }
      }
    }
  }
}

export { ManagerRuntime };
