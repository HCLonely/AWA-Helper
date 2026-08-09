/** Twitch extension installation and tracking token models. */
export interface TwitchExtensionInfo { extensionID?: string; jwt: string }
export interface TwitchInstalledExtension {
  installation?: { extension?: { name?: string } };
  token?: TwitchExtensionInfo;
}
