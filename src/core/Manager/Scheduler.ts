/**
 * @file Scheduler
 * @description Converts normalized cron configuration into Manager job requests.
 */
import * as cron from 'node-cron';
import type { NormalizedManagerConfig } from '../../tools/config/types';
import { Logger, time } from '../../tools';
import type { JobCoordinator } from './JobCoordinator';

class Scheduler {
  private readonly tasks: cron.ScheduledTask[] = [];

  constructor(private readonly coordinator: JobCoordinator, private readonly config: NormalizedManagerConfig) {}

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

  stop(): void {
    this.tasks.forEach((task) => task.stop());
    this.tasks.length = 0;
  }

  private schedule(expression: string, action: () => Promise<unknown>): void {
    if (!cron.validate(expression)) {
      new Logger(`${time()}${__('invalidCronExpression', expression)}`);
      return;
    }
    this.tasks.push(cron.schedule(expression, () => {
      void action().catch((error) => new Logger(error));
    }));
  }

  /** Ensures a scheduled run never overlaps a previous run of the same job. */
  private async restart(name: 'dailyQuest' | 'achievement' | 'artifact', payload?: unknown): Promise<unknown> {
    await this.coordinator.stop(name);
    return this.coordinator.start(name, payload);
  }
}

export { Scheduler };
