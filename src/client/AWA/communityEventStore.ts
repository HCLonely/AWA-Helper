import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteFileSync } from '../../tools/config/YamlConfig';
import { communityEventEntries, parseCommunityEventMetadata, validateCommunityEventSource, type CommunityEventMetadata, type CommunityEventSource } from './communityEventMetadata';

export interface CommunityEventData {
  sourceUrl: CommunityEventSource;
  games: CommunityEventMetadata[];
}

/** 将数据保存在所选配置文件所在目录中，使用 --config 时也遵循此规则。 */
export const communityEventFilePath = (configPath: string): string => path.join(path.dirname(path.resolve(configPath)), 'community-event.json');

export const readCommunityEventData = (filename: string): CommunityEventData => {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error('communityEventReadFailed', {
        cause: error
      });
    }
    data = {};
  }
  if (!data || typeof data !== 'object' || (data.games !== undefined && !Array.isArray(data.games))) {
    throw new Error('communityEventReadFailed');
  }
  return {
    sourceUrl: validateCommunityEventSource(data.sourceUrl ?? 'github'),
    games: communityEventEntries(data).map((entry) => {
      if (!entry || typeof entry !== 'object') {
        throw new Error('communityEventReadFailed');
      }
      return entry as CommunityEventMetadata;
    })
  };
};

export const saveCommunityEventData = (filename: string, source: unknown, metadata: unknown): CommunityEventData => {
  const sourceUrl = validateCommunityEventSource(source);
  const entries = communityEventEntries(metadata);
  const games = entries.map((entry) => parseCommunityEventMetadata(entry));
  if ((!Array.isArray(metadata) && !entries.length) || games.some((game) => !game) ||
    new Set(games.map((game) => game?.gameId)).size !== games.length ||
    new Set(games.filter((game) => game?.eventPath).map((game) => game?.eventPath)).size !== games.filter((game) => game?.eventPath).length) {
    throw new Error('communityEventDataRequired');
  }
  const data: CommunityEventData = {
    sourceUrl,
    games: games as CommunityEventMetadata[]
  };
  atomicWriteFileSync(filename, `${JSON.stringify(data, null, 2)}\n`);
  return data;
};
