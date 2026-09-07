/**
 * @file src/core/Manager/Scheduler.ts
 * @description 将 Cron 配置转换为 Manager 作业请求，并管理计划任务的启停。
 */
import * as cron from 'node-cron';
import type { NormalizedManagerConfig } from '../../tools/config/types';
import { Logger, time } from '../../tools';
import type { JobCoordinator } from './JobCoordinator';

class Scheduler {
  private readonly tasks: cron.ScheduledTask[] = [];
  private started = false;
  private generation = 0;
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly restartVersions = new Map<string, number>();

  /**
   * 初始化 Scheduler 实例。
   * @param coordinator - 负责协调作业启动与停止的协调器，类型为 `JobCoordinator`。
   * @param config - 控制当前操作行为的配置，类型为 `NormalizedManagerConfig`。
   */
  constructor(private readonly coordinator: JobCoordinator, private config: NormalizedManagerConfig) {}

  /**
   * 执行 start 相关数据。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  start(): void {
    if (this.started || this.coordinator.isClosing) {
      return;
    }
    this.started = true;
    if (this.config.dailyQuestCron) {
      this.schedule('dailyQuest', this.config.dailyQuestCron, () => this.restart('dailyQuest'));
    }
    if (this.config.achievement.enable) {
      this.schedule('achievement', this.config.achievement.cron, () => this.restart('achievement'));
    }
    this.config.artifacts.forEach(({ cron: expression, ids }, index) => {
      this.schedule(`artifact#${index + 1}`, expression, () => this.restart('artifact', ids));
    });
    new Logger(`${time()}${__('schedulerStarted', String(this.tasks.length))}`);
  }

  /**
   * 停止 stop 相关数据。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  stop(): void {
    this.generation++;
    if (this.tasks.length > 0) {
      new Logger(`${time()}${__('schedulerStopping', String(this.tasks.length))}`);
    }
    this.tasks.forEach((task) => task.destroy());
    this.tasks.length = 0;
    this.started = false;
  }

  /**
   * 用新配置替换当前调度计划；仅在调度器已经启动时重新注册任务。
   * @param config - 最新的标准 Manager 配置。
   */
  reload(config: NormalizedManagerConfig): void {
    const shouldRestart = this.started;
    this.stop();
    this.config = config;
    if (shouldRestart) {
      this.start();
    }
  }

  /**
   * 处理 schedule 相关逻辑。
   * @param expression - 定义任务执行时间的 Cron 表达式，类型为 `string`。
   * @param action - 满足条件时调用的处理函数，类型为 `() => Promise<unknown>`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  private schedule(name: string, expression: string, action: () => Promise<unknown>): void {
    if (!cron.validate(expression)) {
      new Logger(`${time()}${__('invalidCronExpression', expression)}`);
      return;
    }
    this.tasks.push(cron.schedule(expression, () => {
      new Logger(`${time()}${__('schedulerTriggered', name)}`);
      void action()
        .then(() => new Logger(`${time()}${__('schedulerTriggerCompleted', name)}`))
        .catch((error) => new Logger(`${time()}${__('schedulerTriggerFailed', name, error instanceof Error ? error.message : String(error))}`));
    }));
    new Logger(`${time()}${__('schedulerRegistered', name, expression)}`);
  }

  /**
   * 处理 restart 相关逻辑。
   * @param name - 用于定位目标对象的名称，类型为 `"dailyQuest" | "achievement" | "artifact"`。
   * @param payload - 当前请求或操作使用的数据内容，类型为 `unknown`。
   * @returns `Promise<unknown>`，目标作业重新启动后产生的异步结果。
   */
  private restart(name: 'dailyQuest' | 'achievement' | 'artifact', payload?: unknown): Promise<unknown> {
    const { generation } = this;
    const version = (this.restartVersions.get(name) || 0) + 1;
    this.restartVersions.set(name, version);
    const current = (): boolean => this.started && generation === this.generation && !this.coordinator.isClosing &&
      (name === 'artifact' || this.restartVersions.get(name) === version);
    const previous = name === 'artifact' ? this.pending.get(name) : undefined;
    const completion = (previous ?? Promise.resolve()).catch(() => undefined).then(async () => {
      if (!current()) {
        return;
      }
      new Logger(`${time()}${__('schedulerRestarting', name)}`);
      await this.coordinator.stop(name);
      if (current()) {
        return this.coordinator.start(name, payload);
      }
    }).finally(() => {
      if (this.pending.get(name) === completion) {
        this.pending.delete(name);
      }
    });
    this.pending.set(name, completion);
    return completion;
  }
}

export { Scheduler };
