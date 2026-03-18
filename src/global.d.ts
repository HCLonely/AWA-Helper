/* eslint-disable no-underscore-dangle */
/* eslint-disable no-var, no-unused-vars */
/* global WebSocketServer */
import { AxiosRequestConfig } from 'axios';
import type { I18n } from 'i18n';
import type WebSocket from 'ws';
import type { AWA } from './AWA';
import { Logger } from './tool';

declare global {
  interface Array<T> {
    findLast(
      predicate: (value: T, index: number, obj: T[]) => unknown,
      thisArg?: any
    ): T
  }
  interface pusher {
    enable: boolean
    platform: string
    key: {
      [name: string]: any
    }
    options?: {
      [name: string]: any
    }
  }
  interface managerServer {
    enable: boolean
    secret: string
    port?: number
    ssl?: {
      key?: string
      cert?: string
    }
    corn?: string
  }
  interface config {
    language: string
    timeout?: number
    logsExpire?: number
    TLSRejectUnauthorized?: boolean
    autoUpdate?: boolean
    managerServer?: managerServer
    awaCookie?: string
    awaHost: string
    awaBoosterNotice?: boolean
    awaQuests: Array<string>
    awaDailyQuestType: Array<string>
    awaDailyQuestNumber1?: boolean
    awaSafeReply?: boolean,
    joinSteamCommunityEvent?: boolean
    twitchCookie?: string
    steamUse?: 'ASF'
    asfProtocol: string
    asfHost?: string
    asfPort?: number
    asfPassword?: string
    asfBotname?: string
    proxy?: proxy
    webUI?: {
      enable: boolean
      port?: number
      local?: boolean
      reverseProxyPort?: number
      ssl?: {
        key?: string
        cert?: string
      }
    }
    pusher?: pusher
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
    steamQuest?: Array<{
      name: string
      status: string
      maxAvailableARP: string
    }>
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
        options?: {
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
  var quest: AWA;
  var initError: string;
  var awaHost: string;
  var __: I18n['__'];
  var newVersionNotice: string;
  var steamEventGameId: string;
  var log: boolean;
  var version: string;
}
export {};
