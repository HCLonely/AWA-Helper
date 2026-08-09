/**
 * @file src/client/AWA/APIs/twitch/getTwitchBonus.ts
 * @description 读取当前 AWA 遗物提供的额外 Twitch ARP 加成。
 */
import { AWAContext } from '../../AWAContext';
import { parseTwitchArtifactBonus } from '../../parsers';

/**
 * 获取 get Twitch Bonus 相关数据。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param userProfilePath - 待读取或写入文件的路径，类型为 `string`。
 * @returns `Promise<number>`，getTwitchBonus 计算或读取到的数值。
 */
export const getTwitchBonus = async (context: AWAContext, userProfilePath: string): Promise<number> => {
  const options: myAxiosConfig = {
    url: `${context.baseURL}${userProfilePath}/artifacts`, method: 'GET',
    headers: { ...context.headers, referer: context.baseURL }
  };
  if (context.httpsAgent) {
    options.httpsAgent = context.httpsAgent;
  }
  const response = await context.request<string>(options);
  return parseTwitchArtifactBonus(response.data);
};
