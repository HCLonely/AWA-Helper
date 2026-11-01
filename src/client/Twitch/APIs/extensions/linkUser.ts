/**
 * @file src/client/Twitch/APIs/extensions/linkUser.ts
 * @description 使用频道的实时扩展令牌，为当前 Twitch 用户授权 Arena Rewards Tracker。
 */
import { TwitchContext } from '../../TwitchContext';
import { TwitchError } from '../../TwitchError';
import { linkUserQuery } from '../../queries';
import type { TwitchExtensionInfo, TwitchGqlEnvelope } from '../../types';
import { withLogSecrets } from '../../../../tools/logging/sanitize';

interface LinkUserData {
  extensionLinkUser?: { token?: TwitchExtensionInfo };
}

/**
 * 授权指定频道的扩展；调用方须从 Arena Rewards Tracker 的查询结果传入令牌。
 * 只接受与请求扩展一致的非空返回令牌；GraphQL 错误或异常响应不能算授权成功。
 */
export const linkUser = async (context: TwitchContext, channelId: string, extension: TwitchExtensionInfo): Promise<TwitchExtensionInfo> => {
  const {
    extensionID, jwt
  } = extension;
  if (!context.clientId || !channelId || !extensionID || !jwt) {
    throw new TwitchError('linkUser', 'Missing Twitch client, channel or extension credentials');
  }
  try {
    return await withLogSecrets({
      token: jwt
    }, async () => {
      const response = await context.request<Array<TwitchGqlEnvelope<LinkUserData>>>({
        url: 'https://gql.twitch.tv/gql',
        method: 'POST',
        headers: {
          'Client-Id': context.clientId
        },
        data: linkUserQuery(channelId, extensionID, jwt)
      });
      const envelope = response.data?.[0];
      const token = envelope?.data?.extensionLinkUser?.token;
      if (envelope?.errors?.length || !token?.jwt || token.extensionID !== extensionID) {
        throw new TwitchError('linkUser', 'Twitch extension authorization was rejected or returned an invalid token');
      }
      return token;
    });
  } catch (error) {
    if (error instanceof TwitchError) {
      throw error;
    }
    throw new TwitchError('linkUser', 'Unable to authorize Twitch extension', true, undefined, {
      cause: error
    });
  }
};
