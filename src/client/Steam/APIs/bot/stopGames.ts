/**
 * @file src/client/Steam/APIs/bot/stopGames.ts
 * @description 停止任务专用挂时并让 ASF 返回正常运行状态。
 */
import { ASFContext } from '../../ASFContext';
import { resumeBot } from './resumeBot';

/**
 * 停止游戏挂时长。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `ASFContext`。
 * @returns ASF Bot 停止当前挂时并恢复计划后的 `resumed` 结果。
 */
export const stopGames = (context: ASFContext) => resumeBot(context);
