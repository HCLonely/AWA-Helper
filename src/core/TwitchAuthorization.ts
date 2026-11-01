/**
 * @file src/core/TwitchAuthorization.ts
 * @description 观看任务共享的扩展授权流程；连接诊断继续保持只读。
 */
import chalk from 'chalk';
import type { AWAApiClient } from '../client/AWA/AWAApiClient';
import type { TwitchClient } from '../client/Twitch/TwitchClient';
import { getRequestSignal } from '../tools/http/RequestContext';
import { Logger, time } from '../tools';

/**
 * 已授权时直接返回；否则发现 AWA 可用频道，动态取令牌并授权，再查询确认。
 * 不固定频道、用户或 JWT。无可用扩展和授权未生效时返回 false，请求异常交给任务处理。
 */
export const ensureTwitchAuthorization = async (twitch: TwitchClient, awa: AWAApiClient): Promise<boolean> => {
  const logger = new Logger(`${time()}${__('checkAuthorization', chalk.yellow('Twitch'))}`, false);
  const linked = (await twitch.extensions.checkLinked()).ok;
  logger.log(linked ? chalk.green(__('authorized')) : chalk.yellow(__('notAuthorized')));
  if (linked) {
    return true;
  }
  getRequestSignal()?.throwIfAborted();
  new Logger(`${time()}${__('twitchAutoAuthorizing')}`);
  const streams = await awa.twitch.getAvailableStreams();
  const candidates = [...new Set([...streams.Hive, ...streams.Nexus, ...streams.Other])];
  const tracking = await twitch.channels.findTracking(candidates);
  if (!tracking.found || !tracking.value.extensionID) {
    new Logger(`${time()}${chalk.yellow(__('twitchAutoAuthorizationNoChannel'))}`);
    return false;
  }
  getRequestSignal()?.throwIfAborted();
  await twitch.extensions.link(tracking.value.channelId, tracking.value);
  // 不以 HTTP 200 或返回 JWT 代替授权状态，防止请求被拒绝后继续发送无效心跳。
  getRequestSignal()?.throwIfAborted();
  const authorized = (await twitch.extensions.checkLinked()).ok;
  new Logger(`${time()}${authorized ? chalk.green(__('twitchAutoAuthorizationSucceeded')) : chalk.red(__('twitchAutoAuthorizationFailed'))}`);
  return authorized;
};
