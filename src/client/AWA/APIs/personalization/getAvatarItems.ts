/**
 * @file src/client/AWA/APIs/personalization/getAvatarItems.ts
 * @description 获取并解析 AWA 可用头像、边框及当前装备配置。
 */
import { AWAContext } from '../../AWAContext';
import type { avatarIds } from '../../../../types/achievement';
import { parsePersonalization } from '../../parsers';

/**
 * 获取 get Avatar Items 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param type - 用于选择处理分支的类型，类型为 `"avatar" | "border"`。
 * @returns `Promise<avatarIds | null>`，getAvatarItems 获取到的数据。
 */
export const getAvatarItems = async (context: AWAContext, type: 'avatar' | 'border'): Promise<avatarIds | null> => {
  const options: myAxiosConfig = { url: `${context.baseURL}/account/personalization`, method: 'GET', headers: context.headers };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await context.request<string>(options);
  const { userId, selection } = parsePersonalization(response.data, type);
  if (userId) context.userId = userId;
  return selection;
};
