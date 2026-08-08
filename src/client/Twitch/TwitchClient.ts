/** Twitch-only facade. Cross-platform heartbeat loops are implemented by Core. */
import { TwitchContext } from './TwitchContext';
import { checkLinkedExtension, getChannelInfo, getChannelsInfo, getExtensionInfo, verifySession } from './APIs';
import type { TwitchChannelTrackingInfo } from './types';

export class TwitchClient {
  readonly context: TwitchContext;
  constructor(options: { cookie: string; proxy?: proxy; userAgent?: string }) { this.context = new TwitchContext(options); }
  async init(): Promise<boolean> {
    try { await verifySession(this.context); return await checkLinkedExtension(this.context); } catch (_error) { return false; }
  }
  getChannelId(channelLogin: string): Promise<string | null> { return getChannelInfo(this.context, channelLogin); }
  findTrackingChannel(channelLogins: string[]): Promise<TwitchChannelTrackingInfo | null> { return getChannelsInfo(this.context, channelLogins); }
  async getTrackingInfo(channelLogin: string): Promise<TwitchChannelTrackingInfo | null> {
    const channelId = await getChannelInfo(this.context, channelLogin);
    if (!channelId) return null;
    const extension = await getExtensionInfo(this.context, channelId);
    return extension ? { channelId, streamerName: channelLogin, ...extension } : null;
  }
}
