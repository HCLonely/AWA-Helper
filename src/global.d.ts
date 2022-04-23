/* eslint-disable no-unused-vars */
declare global {
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
    dailyQuest?: 'complete' | 'incomplete'
    timeOnSite?: 'complete' | 'incomplete'
    watchTwitch?: 'complete' | 'incomplete'
    steamQuest?: 'complete' | 'incomplete'
  }
}
export {};
