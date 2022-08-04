/* eslint-disable no-var */
/* eslint-disable no-unused-vars */
import type { I18n } from 'i18n';
declare global {
  interface config {
    language: string
    awaCookie?: string
    awaHost: string,
    awaBoosterNotice?: boolean,
    awaQuests: Array<string>,
    awaDailyQuestType: Array<string>,
    twitchCookie?: string,
    steamUse?: 'ASF' | 'SU'
    asfProtocol: string,
    asfHost?: string,
    asfPort?: number,
    asfPassword?: string,
    asfBotname?: string,
    steamAccountName?: string,
    steamPassword?: string,
    proxy?: proxy
  }
  interface proxy {
    enable: Array<string>
    host: string
    port: number
    protocol?: string
    username?: string
    password?: string
  }
  interface questInfo {
    dailyQuest?: {
      status: string
      arp: string
    }
    timeOnSite?: {
      maxArp: number
      addedArp: number
    }
    watchTwitch?: string
    steamQuest?: string
  }
  interface steamGameInfo {
    id: string
    time: number
    arp: number
    link: string
    progress?: string
  }

  interface questStatus {
    dailyQuest?: 'complete' | 'incomplete' | 'skip'
    timeOnSite?: 'complete' | 'incomplete'
    watchTwitch?: 'complete' | 'incomplete'
    steamQuest?: 'complete' | 'incomplete'
  }

  interface awaInfo {
    awaUserId: string
    awaBorderId: string
    awaBadgeIds: Array<string>
    awaAvatar: string
  }
  var secrets: string;
  var userAgent: string;
  // eslint-disable-next-line no-underscore-dangle
  var __: I18n['__'];
}
export {};
