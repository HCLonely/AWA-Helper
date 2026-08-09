/** Typed facade over decomposed AWA APIs; business loops stay in Core. */
import type { Achievement, AvailableStreams, avatarIds, userAvatarInfo } from '../../types/achievement';
import { AWAContext, type AWAContextOptions } from './AWAContext';
import {
  claimQuestAward, completeGetStartedItem, getAchievements, getAvailableStreams, getAvatarItems, getControlCenter,
  getTwitchBonus, openPage, recordPostView, recordPromotionView, refreshSession, replyPost, saveAvatar,
  sendTimeOnSiteTrack, sendTwitchTrack, sharePost, verifySession
} from './APIs';
import type { TwitchTrackResult } from './APIs/twitch/sendTwitchTrack';
import { CommunityEventAPI, SteamQuestAPI } from './APIs/steam';
import { ArtifactAPI } from './APIs/artifacts';

export class AWAApiClient {
  readonly context: AWAContext;
  readonly steam: SteamQuestAPI;
  readonly artifacts: ArtifactAPI;
  readonly communityEvent: CommunityEventAPI;
  constructor(options: AWAContextOptions) {
    this.context = new AWAContext(options);
    this.steam = new SteamQuestAPI(this.context);
    this.artifacts = new ArtifactAPI(this.context);
    this.communityEvent = new CommunityEventAPI(this.context);
  }
  get newCookie(): string { return this.context.cookie.stringify(); }
  get session() {
    return { refresh: () => refreshSession(this.context), verify: () => verifySession(this.context) };
  }
  get quests() {
    return {
      getControlCenter: () => getControlCenter(this.context),
      claimAward: (questId: string) => claimQuestAward(this.context, questId),
      sendTimeOnSite: (link?: string) => sendTimeOnSiteTrack(this.context, link),
      completeGetStartedItem: (link: string) => completeGetStartedItem(this.context, link)
    };
  }
  get content() {
    return {
      openPage: (link: string) => openPage(this.context, link),
      recordPostView: (postId: string) => recordPostView(this.context, postId),
      replyPost: (postId?: string) => replyPost(this.context, postId),
      sharePost: (postId: string) => sharePost(this.context, postId),
      recordPromotionView: (id: string, token: string) => recordPromotionView(this.context, id, token)
    };
  }
  get personalization() {
    return {
      getAvatarItems: (type: 'avatar' | 'border') => getAvatarItems(this.context, type),
      saveAvatar: (avatar: userAvatarInfo) => saveAvatar(this.context, avatar)
    };
  }
  get twitch() {
    return {
      getAvailableStreams: () => getAvailableStreams(this.context),
      getBonus: (profilePath: string) => getTwitchBonus(this.context, profilePath),
      sendTrack: (payload: { channelId: string; jwt: string; extensionID?: string }) => sendTwitchTrack(this.context, payload)
    };
  }
  get achievement() { return { getAll: () => getAchievements(this.context) }; }
  async init(): Promise<boolean> { await this.session.refresh(); await this.session.verify(); return true; }
  getAvatarItems(type: 'avatar' | 'border'): Promise<avatarIds | null> { return this.personalization.getAvatarItems(type); }
  saveAvatar(avatar: userAvatarInfo): Promise<boolean> { return this.personalization.saveAvatar(avatar); }
  getAvailableStreams(): Promise<AvailableStreams> { return this.twitch.getAvailableStreams(); }
  getAchievements(): Promise<Achievement[]> { return this.achievement.getAll(); }
  sendTwitchTrack(payload: { channelId: string; jwt: string; extensionID?: string }): Promise<TwitchTrackResult> { return this.twitch.sendTrack(payload); }
}
