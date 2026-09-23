/**
 * @file src/client/Steam/types/games.ts
 * @description 定义 AWA Steam 任务与 ASF 之间传递的应用标识。
 */
export type SteamAppId = string;
export interface ASFOwnedGamesResult {
  appIds: SteamAppId[]
}
