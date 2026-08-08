/** Typed facade over decomposed AWA APIs; business loops stay in Core. */
import type { Achievement, AvailableStreams, avatarIds, userAvatarInfo } from '../../types/achievement';
import { AWAContext, type AWAContextOptions } from './AWAContext';
import { getAchievements, getAvailableStreams, getAvatarItems, refreshSession, saveAvatar, sendTwitchTrack, verifySession } from './APIs';
import type { TwitchTrackResult } from './APIs/twitch/sendTwitchTrack';
import { SteamQuestAPI } from './APIs/steam';
import { ArtifactAPI } from './APIs/artifacts';

export class AWAApiClient {
  readonly context: AWAContext;
  readonly steam: SteamQuestAPI;
  readonly artifacts: ArtifactAPI;
  constructor(options: AWAContextOptions) {
    this.context = new AWAContext(options);
    this.steam = new SteamQuestAPI(this.context);
    this.artifacts = new ArtifactAPI(this.context);
  }
  get newCookie(): string { return this.context.cookie.stringify(); }
  async init(): Promise<boolean> { await refreshSession(this.context); await verifySession(this.context); return true; }
  getAvatarItems(type: 'avatar' | 'border'): Promise<avatarIds | null> { return getAvatarItems(this.context, type); }
  saveAvatar(avatar: userAvatarInfo): Promise<boolean> { return saveAvatar(this.context, avatar); }
  getAvailableStreams(): Promise<AvailableStreams> { return getAvailableStreams(this.context); }
  getAchievements(): Promise<Achievement[]> { return getAchievements(this.context); }
  sendTwitchTrack(payload: { channelId: string; jwt: string; extensionID?: string }): Promise<TwitchTrackResult> { return sendTwitchTrack(this.context, payload); }
}
