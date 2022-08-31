/* eslint-disable no-var, no-unused-vars */
/* global WebSocketServer */
import { AxiosRequestConfig } from 'axios';
import type { I18n } from 'i18n';
import type WebSocket from 'ws';
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
    webUI?: {
      enable: boolean
      port?: number
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
  interface dailyQuestDb {
    version: string
    quests: {
      changeBorder: Array<string>
      changeBadge: Array<string>
      changeAvatar: Array<string>
      viewNews: Array<string>
      sharePost: Array<string>
      replyPost: Array<string>
      leaderboard: Array<string>
      marketplace: Array<string>
      rewards: Array<string>
      video: Array<string>
      other: Array<string>
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
  var secrets: string;
  var userAgent: string;
  var ws: WebSocket | null;
  var webUI: boolean;
  var logs: logs;
  var language: string;
  var pusher: pusher | undefined;
  var pusherProxy: proxy;
  // eslint-disable-next-line no-underscore-dangle
  var __: I18n['__'];
}
export {};
