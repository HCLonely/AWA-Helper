/** Twitch-only facade. Cross-platform heartbeat loops are implemented by Core. */
import { TwitchContext } from './TwitchContext';
import { checkLinkedExtension, getChannelInfo, getChannelsInfo, getExtensionInfo, verifySession } from './APIs';
import type { TwitchChannelTrackingInfo } from './types';
import chalk from 'chalk';
import { Logger, time } from '../../tools';

export class TwitchClient {
  readonly context: TwitchContext;
  constructor(options: { cookie: string; proxy?: proxy; userAgent?: string }) { this.context = new TwitchContext(options); }
  async init(): Promise<boolean> {
    const sessionLogger = new Logger(`${time()}${__('initing', chalk.yellow('TwitchTrack'))}`, false);
    try {
      await verifySession(this.context);
      sessionLogger.log(chalk.green('OK'));
      const authorizationLogger = new Logger(`${time()}${__('checkAuthorization', chalk.yellow('Twitch'))}`, false);
      const linked = await checkLinkedExtension(this.context);
      authorizationLogger.log(linked ? chalk.green(__('authorized')) : chalk.red(__('notAuthorized')));
      return linked;
    } catch (error) {
      sessionLogger.log(chalk.red('Error'));
      new Logger(error);
      return false;
    }
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
