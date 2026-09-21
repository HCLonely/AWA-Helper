/**
 * @file src/tools/notification/push.ts
 * @description 根据配置发送推送，并格式化每日任务报告。
 */
import { PushApi } from 'all-pusher-api';
import chalk from 'chalk';
import { Logger } from '../logging';
import { time } from '../common';

export const push = async (message: string): Promise<void> => {
  if (!globalThis.pusher?.enable) {
    return;
  }
  const logger = new Logger(`${time()}${__('pushing')}`, false);
  const options: pushOptions = {
    name: globalThis.pusher.platform,
    config: {
      key: globalThis.pusher.key
    }
  };
  if (globalThis.pusher.options) {
    options.config.options = globalThis.pusher.options;
  }
  if (globalThis.pusherProxy) {
    options.config.proxy = globalThis.pusherProxy;
  }
  const [result] = await new PushApi([options]).send({
    message,
    title: __('pushTitle'),
    type: 'text'
  });
  if ((result.result?.status || 0) >= 200 && result.result.status < 300) {
    logger.log(chalk.green(__('pushSuccess')));
    return;
  }
  logger.log(chalk.red(__('pushFailed')));
  new Logger(result.result);
};

type ReportValue = Record<string, string | number>;
interface PushQuestInfo {
  report: Record<string, ReportValue>;
  dailyArp: string;
  signArp: {
    daily?: string;
    monthly?: string
  };
  battlePass?: {
    status: 'unknown' | 'not-started' | 'active' | 'completed' | 'ended';
    claimedCount: number;
    rewardTotal: number;
    claimed: Array<{
      name: string;
      milestoneId: number
    }>;
    failed: Array<{
      name: string;
      milestoneId: number;
      reason: string
    }>;
  };
}

const normalizeArpValue = (value: string | number | undefined): string => String(value ?? '')
  .replace(/\s*ARP\s*$/i, '')
  .trim();

export const pushQuestInfoFormat = (quest?: PushQuestInfo): string => {
  if (!quest) {
    return '';
  }
  const other: Array<[string, ReportValue] | undefined> = new Array(1);
  const daily: Array<[string, ReportValue]> = [];
  const online: Array<[string, ReportValue] | undefined> = new Array(2);
  const steam: Array<[string, ReportValue]> = [];
  Object.entries(quest.report).forEach(([name, value]) => {
    if (name === __('timeOnSite')) {
      online[0] = [name, value];
    } else if (name === __('watchTwitch')) {
      online[1] = [name, value];
    } else if (name.includes(__('steamQuest'))) {
      steam.push([name, value]);
    } else if (name.includes(__('promotionalCalendar'))) {
      other.push([name, value]);
    } else if (name === __('battlePass')) {
      return;
    } else if (name === __('steamCommunityEvent')) {
      const status = value[__('status')];
      if (status === __('logStatusFinished') || status === __('logStatusClosed') ||
        status === __('battlePassStatus_ended') || status === __('battlePassStatus_not-started') ||
        parseInt(String(value[__('maxAvailableARP')]), 10) <= 0) {
        return;
      }
      other[0] = [name, value];
    } else {
      daily.push([name, value]);
    }
  });
  const formatRows = (rows: Array<[string, ReportValue] | undefined>): string => rows
    .filter((row): row is [string, ReportValue] => !!row)
    .map(([name, value]) => {
      const status = value[__('status')];
      const obtained = value[__('obtainedARP')];
      const extra = value[__('extraARP')];
      if (name === __('steamCommunityEvent')) {
        const complete = parseInt(String(obtained), 10) >= parseInt(String(value[__('maxAvailableARP')]), 10);
        return `${complete ? '✔️' : '⚠️'}${name}:  ${obtained}/${value[__('maxAvailableARP')]}`;
      }
      if (name.includes(__('promotionalCalendar'))) {
        return `${status === __('done') ? '✔️' : '⚠️'}${name}:  ${status === __('done') ? obtained : status}`;
      }
      const obtainedArp = normalizeArpValue(obtained);
      const extraArp = normalizeArpValue(extra);
      return `${status === __('done') ? '✔️' : '❌'}${name}:  ${obtainedArp}${extraArp && extraArp !== '0' ? ` + ${extraArp}` : ''} ARP`;
    }).join('\n');
  const battlePassRows: string[] = [];
  if (quest.battlePass) {
    const statusOnly = quest.battlePass.status === 'not-started' || quest.battlePass.status === 'ended';
    const statusIcon = quest.battlePass.status === 'completed' ? '✔️' : '⚠️';
    if (statusOnly) {
      battlePassRows.push(`${statusIcon}${__('battlePass')}: ${__(`battlePassStatus_${quest.battlePass.status}`)}`);
    } else if (quest.battlePass.claimed.length > 0) {
      const rewardNames = quest.battlePass.claimed.map((reward) => reward.name)
        .join(__('battlePassRewardSeparator'));
      battlePassRows.push(`✔️${__('battlePass')}: ${__('battlePassClaimed', rewardNames, String(quest.battlePass.claimedCount), String(quest.battlePass.rewardTotal))}`);
    } else if (quest.battlePass.status === 'active') {
      battlePassRows.push(`⚠️${__('battlePass')}: ${__('battlePassProgress', String(quest.battlePass.claimedCount), String(quest.battlePass.rewardTotal))}`);
    } else {
      battlePassRows.push(`${statusIcon}${__('battlePass')}: ${__('battlePassStatusProgress', __(`battlePassStatus_${quest.battlePass.status}`), String(quest.battlePass.claimedCount), String(quest.battlePass.rewardTotal))}`);
    }
    quest.battlePass.failed.forEach((reward) => {
      battlePassRows.push(`❌${__('battlePass')}: ${__('battlePassClaimFailed', reward.name)}`);
    });
  }
  const sections = [
    formatRows(daily),
    formatRows(online),
    formatRows(steam),
    formatRows(other.slice(0, 1)),
    formatRows(other.slice(1)),
    battlePassRows.join('\n')
  ].filter(Boolean);
  const body = sections.join('\n---\n');
  return `👉${__('dailyArp', quest.dailyArp)}\n\n${quest.signArp.daily ? `✔️${__('dailySign', quest.signArp.daily)}` : `⚠️${__('dailySign', '-')}`}${quest.signArp.monthly ? `✔️${__('monthlySign', quest.signArp.monthly)}` : `⚠️${__('dailySign', '-')}`}---${body ? `\n${body}` : ''}`;
};
