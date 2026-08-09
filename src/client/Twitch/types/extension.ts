/**
 * @file src/client/Twitch/types/extension.ts
 * @description 定义 Twitch 扩展安装状态与跟踪令牌数据。
 */
export interface TwitchExtensionInfo { extensionID?: string; jwt: string }
export interface TwitchInstalledExtension {
  installation?: { extension?: { name?: string } };
  token?: TwitchExtensionInfo;
}
