/**
 * @file src/global.d.ts
 * @description 声明配置、日志、国际化、推送和服务器等由应用运行环境注入的全局类型。
 */
/* eslint-disable no-underscore-dangle */

import { AxiosRequestConfig } from 'axios';
import type { I18n } from 'i18n';
import type WebSocket from 'ws';
import { Logger } from './tools';

declare global {
  interface Array<T> {
        /**
         * 查找最后一条匹配记录。
         * @param predicate - 用于判断数组元素是否匹配的回调函数，类型为 `(value: T, index: number, obj: T[]) => unknown`。
         * @param thisArg - 执行回调函数时绑定的 this 值，类型为 `any`。
         * @returns `T`，findLast 获取到的数据。
         */
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
    local?: boolean
    port?: number
    ssl?: {
      key?: string
      cert?: string
    }
    corn?: string
    cron?: string
    artifacts?: Array<{
      corn?: string
      cron?: string
      ids: string | number[]
    }>
  }
  interface config {
    language: string
    timeout?: number
    logsExpire?: number
    logsMaxMB?: number
    debug?: {
      http?: boolean
    }
    TLSRejectUnauthorized?: boolean
    autoUpdate?: boolean
    UA?: string
    managerServer?: managerServer
    manager?: {
      timezone?: string
      historyLimit?: number
      secret?: string
      dailyQuest?: {
        cron?: string
      }
      achievement?: {
        enable?: boolean;
        cron?: string
      }
      artifacts?: Array<{
        cron: string;
        ids: number[]
      }>
    }
    awaCookie?: string
    awaHost: string
    awaBoosterNotice?: boolean
    awaQuests: Array<'getStarted' | 'dailyQuest' | 'dailyQuestOld' | 'battlePass' | 'timeOnSite' | 'watchTwitch' | 'steamQuest'>
    awaDailyQuestType: Array<'click' | 'visitLink' | 'openLink' | 'changeBorder' | 'changeAvatar' | 'viewNews' | 'sharePost' | 'replyPost'>
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
    enable: Array<'github' | 'twitch' | 'awa' | 'asf' | 'steam' | 'pusher'>
    host: string
    port: number
    protocol?: string
    username?: string
    password?: string
  }
  interface dailyQuest {
    name: string
    id: string | undefined
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
    retryCount?: number
    retryTimes?: number
    retryDelay?: number
    Logger?: Logger
  }
  interface webLogEntry {
    id: number
    data: unknown
    type: 'log' | 'questInfo'
    scope: 'manager' | 'dailyQuest' | 'achievement' | 'artifact'
  }
  interface logs {
    type: 'logs'
    [name: string]: webLogEntry | 'logs'
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
  var wsClients: Set<WebSocket>;
  var webUI: boolean;
  var logs: logs;
  var language: string;
  var pusher: pusher | undefined;
  var pusherProxy: proxy;
  var initError: string;
  var __: I18n['__'];
  var newVersionNotice: string;
  var log: boolean;
  var version: string;
}
export {};
