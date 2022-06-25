/* eslint-disable no-var */
/* eslint-disable no-unused-vars */
declare global {
  interface config {
    awaCookie?: string
    awaHost: string,
    awaUserId?: string,
    awaBorderId?: string,
    awaBadgeIds?: string,
    awaAvatar?: string,
    awaBoosterNotice?: boolean,
    awaQuests: Array<string>,
    twitchCookie?: string,
    asfProtocol: string,
    asfHost?: string,
    asfPort?: number,
    asfPassword?: string,
    asfBotname?: string,
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

  var secrets: string;
}
export {};
