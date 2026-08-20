/** Configured push delivery and DailyQuest report formatting. */
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
    config: { key: globalThis.pusher.key }
  };
  if (globalThis.pusher.options) {
    options.config.options = globalThis.pusher.options;
  }
  if (globalThis.pusherProxy) {
    options.config.proxy = globalThis.pusherProxy;
  }
  const [result] = await new PushApi([options]).send({ message, title: __('pushTitle'), type: 'text' });
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
  signArp: { daily?: string; monthly?: string };
  battlePass?: {
    status: 'unknown' | 'not-started' | 'active' | 'completed' | 'ended';
    tokenCount: number;
    tokenTotal: number;
    claimed: Array<{ name: string; index: number; total: number; milestoneId: number }>;
    failed: Array<{ name: string; milestoneId: number; reason: string }>;
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
      other[0] = [name, value];
    } else {
      daily.push([name, value]);
    }
  });
  const rows = [...daily, ...online, ...steam, ...other].filter((row): row is [string, ReportValue] => !!row);
  const body = rows.map(([name, value]) => {
    const status = value[__('status')];
    const obtained = value[__('obtainedARP')];
    const extra = value[__('extraARP')];
    if (name === __('steamCommunityEvent')) {
      const complete = parseInt(String(obtained), 10) >= parseInt(String(value[__('maxAvailableARP')]), 10);
      return `---\n${complete ? '✔️' : '⚠️'}${name}:  ${obtained}/${value[__('maxAvailableARP')]}\n---`;
    }
    if (name.includes(__('promotionalCalendar'))) {
      return `---\n${status === __('done') ? '✔️' : '⚠️'}${name}:  ${status === __('done') ? obtained : status}`;
    }
    const separator = name === __('timeOnSite') ? '---\n' : '';
    const suffix = name === __('watchTwitch') ? '\n---' : '';
    const obtainedArp = normalizeArpValue(obtained);
    const extraArp = normalizeArpValue(extra);
    return `${separator}${status === __('done') ? '✔️' : '❌'}${name}:  ${obtainedArp}${extraArp && extraArp !== '0' ? ` + ${extraArp}` : ''} ARP${suffix}`;
  }).join('\n');
  const battlePassRows: string[] = [];
  if (quest.battlePass && quest.battlePass.status !== 'unknown') {
    if (quest.battlePass.status !== 'active' && quest.battlePass.claimed.length === 0 && quest.battlePass.failed.length === 0) {
      battlePassRows.push(`${__('battlePass')}: ${__(`battlePassStatus_${quest.battlePass.status}`)}`);
    }
    quest.battlePass.claimed.forEach((reward) => {
      battlePassRows.push(`${__('battlePass')}: ${__('battlePassClaimed', reward.name, String(reward.index), String(reward.total))}`);
    });
    quest.battlePass.failed.forEach((reward) => {
      battlePassRows.push(`${__('battlePass')}: ${__('battlePassClaimFailed', reward.name)}`);
    });
  }
  const battlePass = battlePassRows.length > 0 ? `\n---\n${battlePassRows.join('\n')}` : '';
  return `👉${__('dailyArp', quest.dailyArp)}\n\n${quest.signArp.daily ? `✔️${__('dailySign', quest.signArp.daily)}` : `⚠️${__('dailySign', '-')}`}${quest.signArp.monthly ? `✔️${__('monthlySign', quest.signArp.monthly)}` : `⚠️${__('dailySign', '-')}`}---\n${body}${battlePass}`;
};
