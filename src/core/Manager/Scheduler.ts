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

  /**
   * 初始化 Scheduler 实例。
   * @param coordinator - 负责协调作业启动与停止的协调器，类型为 `JobCoordinator`。
   * @param config - 控制当前操作行为的配置，类型为 `NormalizedManagerConfig`。
   */
  constructor(private readonly coordinator: JobCoordinator, private readonly config: NormalizedManagerConfig) {}

  /**
   * 执行 start 相关数据。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  start(): void {
    if (this.config.dailyQuestCron) {
      this.schedule(this.config.dailyQuestCron, () => this.restart('dailyQuest'));
    }
    if (this.config.achievement.enable) {
      this.schedule(this.config.achievement.cron, () => this.restart('achievement'));
    }
    this.config.artifacts.forEach(({ cron: expression, ids }) => {
      this.schedule(expression, () => this.restart('artifact', ids));
    });
  }

  /**
   * 停止 stop 相关数据。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  stop(): void {
    this.tasks.forEach((task) => task.stop());
    this.tasks.length = 0;
  }

  /**
   * 处理 schedule 相关逻辑。
   * @param expression - 定义任务执行时间的 Cron 表达式，类型为 `string`。
   * @param action - 满足条件时调用的处理函数，类型为 `() => Promise<unknown>`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  private schedule(expression: string, action: () => Promise<unknown>): void {
    if (!cron.validate(expression)) {
      new Logger(`${time()}${__('invalidCronExpression', expression)}`);
      return;
    }
    this.tasks.push(cron.schedule(expression, () => {
      void action().catch((error) => new Logger(error));
    }));
  }

  /**
   * 处理 restart 相关逻辑。
   * @param name - 用于定位目标对象的名称，类型为 `"dailyQuest" | "achievement" | "artifact"`。
   * @param payload - 当前请求或操作使用的数据内容，类型为 `unknown`。
   * @returns `Promise<unknown>`，目标作业重新启动后产生的异步结果。
   */
  private async restart(name: 'dailyQuest' | 'achievement' | 'artifact', payload?: unknown): Promise<unknown> {
    await this.coordinator.stop(name);
    return this.coordinator.start(name, payload);
  }
}

export { Scheduler };
