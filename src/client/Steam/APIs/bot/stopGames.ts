/**
 * @file src/client/Steam/APIs/bot/stopGames.ts
 * @description 停止任务专用挂时并让 ASF 返回正常运行状态。
 */
import { ASFContext } from '../../ASFContext';
import { resumeBot } from './resumeBot';

/**
 * 停止 stop Games 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `ASFContext`。
 * @returns `Promise<boolean>`，表示 stopGames 检查是否通过。
 */
export const stopGames = (context: ASFContext): Promise<boolean> => resumeBot(context);
