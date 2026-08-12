/**
 * @file src/core/DailyQuest/QuestReporter.ts
 * @description 将每日任务状态整理为本地化表格、积分摘要和推送报告。
 */
import type { DailyQuestState } from './DailyQuestState';

export type QuestReport = Record<string, Record<string, string | number>>;

/**
 * 格式化 format Quest Report 相关数据。
 * @param state - 当前对象或任务的状态，类型为 `DailyQuestState`。
 * @returns `QuestReport`，formatQuestReport 生成的格式化结果。
 */
export const formatQuestReport = (state: DailyQuestState): QuestReport => {
  const info = state.questInfo;
  const report: QuestReport = {
    [__('timeOnSite')]: {
      [__('status')]: info.timeOnSite?.addedArp === info.timeOnSite?.maxArp ? __('done') : __('undone'),
      [__('obtainedARP')]: info.timeOnSite?.addedArp || '0',
      [__('extraARP')]: info.timeOnSite?.addedArpExtra || '0',
      [__('maxAvailableARP')]: info.timeOnSite?.maxArp || '0'
    },
    [__('watchTwitch')]: {
      [__('status')]: parseInt(info.watchTwitch?.[0] || '0', 10) + parseFloat(info.watchTwitch?.[1] || '0') >= 15 + state.additionalTwitchARP ? __('done') : __('undone'),
      [__('obtainedARP')]: info.watchTwitch?.[0] || '0',
      [__('extraARP')]: info.watchTwitch?.[1] || '0',
      [__('maxAvailableARP')]: 15 + state.additionalTwitchARP
    }
  };
  info.steamQuest?.forEach((quest) => {
    report[`${__('steamQuest')}([${quest.name}])`] = {
      [__('status')]: quest.status === 'complete' ? __('done') : __('undone'),
      [__('obtainedARP')]: quest.status === 'complete' ? quest.maxAvailableARP : '0',
      [__('extraARP')]: '0',
      [__('maxAvailableARP')]: quest.maxAvailableARP
    };
  });
  info.dailyQuest?.forEach((quest) => {
    const arp = quest.arp?.split('+').map((value) => value.trim()) || [];
    report[`${__('dailyTask', '')}[${quest.name}]`] = {
      [__('status')]: quest.status === 'complete' ? __('done') : __('undone'),
      [__('obtainedARP')]: arp[0] || '0',
      [__('extraARP')]: arp[1] || '0',
      [__('maxAvailableARP')]: arp.reduce((sum, value) => sum + parseInt(value, 10), 0)
    };
  });
  info.dailyQuestUS?.forEach((quest) => {
    report[`${__('dailyTask', '')}[${quest.title}]`] = {
      [__('status')]: parseInt(quest.arp, 10) > 0 ? __('done') : __('undone'),
      [__('obtainedARP')]: quest.arp,
      [__('extraARP')]: quest.extraArp || '0',
      [__('maxAvailableARP')]: parseInt(quest.arp, 10) + parseInt(quest.extraArp || '0', 10)
    };
  });
  state.promotionalCalendarInfo?.forEach((promo) => {
    report[`${__('promotionalCalendar')}[${promo.day}]`] = {
      [__('status')]: promo.finished ? __('done') : __('undone'),
      [__('obtainedARP')]: promo.name,
      [__('extraARP')]: '0', [__('maxAvailableARP')]: '0'
    };
  });
  if (state.communityEvent) {
    report[__('steamCommunityEvent')] = {
      [__('status')]: state.communityEvent.status, [__('obtainedARP')]: state.communityEvent.playedTime,
      [__('extraARP')]: '0', [__('maxAvailableARP')]: state.communityEvent.totalTime
    };
  }
  return report;
};
