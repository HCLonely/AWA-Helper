/**
 * @file src/client/AWA/APIs/twitch/getAvailableStreams.ts
 * @description 从 AWA 控制中心读取可用于观看任务的直播频道。
 */
import { getControlCenter } from '../quests/getControlCenter';
import { AWAContext } from '../../AWAContext';
import type { AvailableStreams } from '../../../../types/achievement';
import { parseAvailableStreams } from '../../parsers';

/**
 * 获取 get Available Streams 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @returns `Promise<AvailableStreams>`，getAvailableStreams 获取到的数据。
 */
export const getAvailableStreams = async (context: AWAContext): Promise<AvailableStreams> => parseAvailableStreams(await getControlCenter(context));
