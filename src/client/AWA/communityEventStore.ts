import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteFileSync } from '../../tools/config/YamlConfig';
import { parseCommunityEventMetadata, validateCommunityEventSource, type CommunityEventMetadata, type CommunityEventSource } from './communityEventMetadata';

export interface CommunityEventData {
  sourceUrl: CommunityEventSource;
  gameId: string;
  gameName: string;
  updateTime: string;
}

/** Keep the data beside the selected config, including when --config is used. */
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
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('communityEventReadFailed');
  }
  return {
    sourceUrl: validateCommunityEventSource(data.sourceUrl ?? 'github'),
    gameId: typeof data.gameId === 'string' ? data.gameId : '',
    gameName: typeof data.gameName === 'string' ? data.gameName : '',
    updateTime: typeof data.updateTime === 'string' ? data.updateTime : ''
  };
};

export const saveCommunityEventData = (filename: string, source: unknown, metadata: CommunityEventMetadata): CommunityEventData => {
  const sourceUrl = validateCommunityEventSource(source);
  const valid = parseCommunityEventMetadata(metadata);
  if (!valid) {
    throw new Error('communityEventDataRequired');
  }
  const data: CommunityEventData = {
    sourceUrl,
    gameId: valid.gameId,
    gameName: valid.gameName || '',
    updateTime: valid.updateTime
  };
  atomicWriteFileSync(filename, `${JSON.stringify(data, null, 2)}\n`);
  return data;
};
