/**
 * @file ManagerRuntime
 * @description Owns the unified server, scheduler, jobs, and application shutdown lifecycle.
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
// @ts-ignore imported as text by the build pipeline.
import CHANGELOG from '../../CHANGELOG.txt';
// @ts-ignore generated from YAML during build.
import * as zh from '../../locales/zh.json';
// @ts-ignore generated from YAML during build.
import * as en from '../../locales/en.json';

class ManagerRuntime {
  readonly coordinator = new JobCoordinator();
  private readonly loaded = loadConfig();
  private readonly scheduler = new Scheduler(this.coordinator, this.loaded.manager);
  private readonly server: UnifiedServer;
  private stopping = false;
  private resolveShutdown!: () => void;
  private readonly shutdownRequested = new Promise<void>((resolve) => { this.resolveShutdown = resolve; });

  constructor(private readonly mode: RuntimeMode, private readonly version: string) {
    this.server = new UnifiedServer(this.loaded, this.coordinator, version, () => this.requestShutdown());
    this.coordinator.register(new DailyQuestJob());
    this.coordinator.register(new AchievementJob(this.loaded.raw));
    this.coordinator.register(new ArtifactJob(this.loaded.path));
  }

  async run(): Promise<number> {
    this.initializeEnvironment();
    this.printStartupInformation();
    await this.server.start();
    new Logger(`${time()}${__('managerStarted', __(`managerMode_${this.mode}`), String(this.loaded.raw.webUI?.port || 3456))}`);
    if (this.mode === 'once') {
      const result = await this.coordinator.start('dailyQuest');
      await this.stop();
      return result.success ? 0 : 1;
    }
    this.scheduler.start();
    await this.shutdownRequested;
    await this.stop();
    return 0;
  }

  requestShutdown(): void {
    this.resolveShutdown();
    if (this.mode === 'once') void this.coordinator.stopAll();
  }

  async stop(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    this.scheduler.stop();
    await this.coordinator.stopAll();
    await this.server.stop();
  }

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

  /** Prints project-level information exactly once for each Manager process. */
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
