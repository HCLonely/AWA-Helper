/* eslint-disable no-underscore-dangle */
/* eslint-disable no-var, no-unused-vars */
/* global WebSocketServer */
import { AxiosRequestConfig } from 'axios';
import type { I18n } from 'i18n';
import type WebSocket from 'ws';
import type { DailyQuest } from './DailyQuest';
import { Logger } from './tool';

declare global {
  interface pusher {
    enable: boolean
    platform: string
    key: {
      [name: string]: any
    }
  }
  interface config {
    language: string
    timeout?: number
    logsExpire?: number
    TLSRejectUnauthorized?: boolean
    awaCookie?: string
    awaHost: string
    awaBoosterNotice?: boolean
    awaQuests: Array<string>
    awaDailyQuestType: Array<string>
    awaDailyQuestNumber1?: boolean
    awaSafeReply?: boolean,
    joinSteamCommunityEvent?: boolean
    boosterRule?: Array<string>
    boosterCorn?: string
    twitchCookie?: string
    steamUse?: 'ASF' | 'SU'
    asfProtocol: string
    asfHost?: string
    asfPort?: number
    asfPassword?: string
    asfBotname?: string
    steamAccountName?: string
    steamPassword?: string
    proxy?: proxy
    webUI?: {
      enable: boolean
      port?: number
      ssl?: {
        key?: string
        cert?: string
      }
    }
    pusher?: pusher
    autoLogin?: {
      enable: boolean
      username: string
      password: string
    },
    autoUpdateDailyQuestDb?: boolean
  }
  interface proxy {
    enable: Array<string>
    host: string
    port: number
    protocol?: string
    username?: string
    password?: string
  }
  interface dailyQuest {
    status: string
    arp: string
  }
  interface dailyQuestUS {
    link: string
    title: string
    arp: string
    extraArp?: string
  }
  interface questInfo {
    dailyQuest?: Array<dailyQuest>
    dailyQuestUS?: Array<dailyQuestUS>
    timeOnSite?: {
      maxArp: string
      addedArp: string
      addedArpExtra?: string
    }
    watchTwitch?: Array<string>
    steamQuest?: Array<string>
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
  interface dailyQuestDb {
    version: number
    quests: {
      changeBorder: Array<string>
      changeBadge: Array<string>
      changeAvatar: Array<string>
      viewNews: Array<string>
      sharePost: Array<string>
      replyPost: Array<string>
      other: Array<string>
      [name: string]: Array<string>
    }
  }
  interface retryAdapterOptions {
    times?: number
    delay?: number
  }
  interface myAxiosConfig extends AxiosRequestConfig {
    retryTimes?: number
    retryDelay?: number
    Logger?: Logger
  }
  interface logs {
    [name: string]: any
  }
  interface pushOptions {
    name: string
      config: {
        key: {
          [name: string]: any
        }
        proxy?: proxy
      }
  }
  interface cookies {
    [name: string]: string
  }
  interface boosters {
    id: string
    activateId: string
    ratio: string
    time: string
    rewardedTime: string
  }
  var secrets: Array<string>;
  var userAgent: string;
  var ws: WebSocket | null;
  var webUI: boolean;
  var logs: logs;
  var language: string;
  var pusher: pusher | undefined;
  var pusherProxy: proxy;
  var quest: DailyQuest;
  var initError: string;
  var awaHost: string;
  var __: I18n['__'];
  var newVersionNotice: string;
}
export {};
