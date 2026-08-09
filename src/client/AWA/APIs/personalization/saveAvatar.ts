/**
 * @file src/client/AWA/APIs/personalization/saveAvatar.ts
 * @description 向 AWA 保存完整的用户头像与边框配置。
 */
import { AWAContext } from '../../AWAContext';
import { AWAError } from '../../AWAError';
import type { userAvatarInfo } from '../../../../types/achievement';

/**
 * 保存 save Avatar 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param avatar - 需要保存的用户头像配置，类型为 `userAvatarInfo`。
 * @returns `Promise<boolean>`，表示 saveAvatar 检查是否通过。
 */
export const saveAvatar = async (context: AWAContext, avatar: userAvatarInfo): Promise<boolean> => {
  if (!context.userId) throw new AWAError('saveAvatar', 'AWA user id is not initialized');
  const options: myAxiosConfig = {
    url: `${context.baseURL}/ajax/user/avatar/save/${context.userId}`, method: 'POST',
    headers: { ...context.headers, 'content-type': 'application/json', origin: context.baseURL, referer: `${context.baseURL}/account/personalization` },
    data: avatar
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await context.request<{ success?: boolean }>(options);
  return response.data?.success === true;
};
