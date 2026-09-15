import { withLogSecrets, setLogSecrets } from '../logging/sanitize';
/** GitHub release discovery, caching and semantic version comparison. */
import chalk from 'chalk';
import { Cookie, http, netError } from '../http';
import { formatProxy } from '../proxy';
import { Logger } from '../logging';
import { time } from '../common';

const LATEST_RELEASE_API = 'https://api.github.com/repos/HCLonely/AWA-Helper/releases/latest';
const RELEASE_CACHE_TTL_MS = 15 * 60 * 1000;

interface ReleaseAsset {
  name: string
  size: number
  digest?: string | null
  browserDownloadUrl: string
}

interface ReleaseInfo {
  version: string
  releaseUrl: string
  assets: ReleaseAsset[]
}

interface ReleaseCheckResult extends ReleaseInfo {
  currentVersion: string
  updateAvailable: boolean
}

interface GitHubReleaseResponse {
  tag_name?: unknown
  html_url?: unknown
  assets?: Array<{
    name?: unknown
    size?: unknown
    digest?: unknown
    browser_download_url?: unknown
  }>
}

interface ParsedVersion {
  core: number[]
  prerelease: Array<string | number>
}

let cachedRelease: { expiresAt: number; value: ReleaseInfo } | undefined;
let pendingRelease: Promise<ReleaseInfo> | undefined;

const parseVersion = (value: string): ParsedVersion | undefined => {
  const match = value.trim().match(/^[vV]?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) {
    return undefined;
  }
  return {
    core: match[1].split('.').map(Number),
    prerelease: match[2]
      ? match[2].split('.').map((part) => {
        if (/^\d+$/.test(part)) {
          return Number(part);
        }
        return part;
      })
      : []
  };
};

const comparePrerelease = (current: ParsedVersion['prerelease'], latest: ParsedVersion['prerelease']): number => {
  if (current.length === 0 || latest.length === 0) {
    if (current.length === latest.length) {
      return 0;
    }
    return current.length === 0 ? 1 : -1;
  }
  for (let index = 0; index < Math.max(current.length, latest.length); index++) {
    const left = current[index];
    const right = latest[index];
    if (left === undefined || right === undefined) {
      if (left === right) {
        return 0;
      }
      return left === undefined ? -1 : 1;
    }
    if (left === right) {
      continue;
    }
    if (typeof left === 'number' && typeof right === 'number') {
      return left > right ? 1 : -1;
    }
    if (typeof left === 'number' || typeof right === 'number') {
      return typeof left === 'number' ? -1 : 1;
    }
    return left.localeCompare(right);
  }
  return 0;
};

export const isNewVersion = (currentVersion: string, latestVersion: string): boolean => {
  const current = parseVersion(currentVersion);
  const latest = parseVersion(latestVersion);
  if (!current || !latest) {
    return false;
  }
  for (let index = 0; index < Math.max(current.core.length, latest.core.length); index++) {
    const left = current.core[index] ?? 0;
    const right = latest.core[index] ?? 0;
    if (left !== right) {
      return right > left;
    }
  }
  return comparePrerelease(current.prerelease, latest.prerelease) < 0;
};

const releaseRequestOptions = (proxy?: proxy): myAxiosConfig => {
  const options: myAxiosConfig = {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'AWA-Helper' },
    timeout: 10 * 1000,
    retryTimes: 1
  };
  if (proxy?.enable?.includes('github') && proxy.host && proxy.port) {
    options.httpsAgent = formatProxy(proxy);
  }
  return options;
};

const parseRelease = (data: GitHubReleaseResponse): ReleaseInfo => {
  if (typeof data.tag_name !== 'string' || !parseVersion(data.tag_name) || typeof data.html_url !== 'string') {
    throw new Error('GitHub returned invalid release metadata');
  }
  return {
    version: data.tag_name.replace(/^[vV]/, ''),
    releaseUrl: data.html_url,
    assets: Array.isArray(data.assets) ? data.assets.flatMap((asset) => {
      if (typeof asset.name !== 'string' || typeof asset.size !== 'number' || typeof asset.browser_download_url !== 'string') {
        return [];
      }
      return [{
        name: asset.name,
        size: asset.size,
        digest: typeof asset.digest === 'string' ? asset.digest : undefined,
        browserDownloadUrl: asset.browser_download_url
      }];
    }) : []
  };
};

export const getLatestRelease = async (proxy?: proxy, force = false): Promise<ReleaseInfo> => withLogSecrets({ proxy }, async () => {
  if (!force && cachedRelease && cachedRelease.expiresAt > Date.now()) {
    return cachedRelease.value;
  }
  if (!force && pendingRelease) {
    return pendingRelease;
  }
  const request = http.get<GitHubReleaseResponse>(LATEST_RELEASE_API, releaseRequestOptions(proxy))
    .then((response) => {
      setLogSecrets(Object.values(Cookie.ToJson(response.headers?.['set-cookie'])).map((cookie) => ({ cookie })));
      const value = parseRelease(response.data);
      cachedRelease = { value, expiresAt: Date.now() + RELEASE_CACHE_TTL_MS };
      return value;
    })
    .finally(() => {
      pendingRelease = undefined;
    });
  pendingRelease = request;
  return request;
});

export const getLatestVersion = async (proxy?: proxy): Promise<string | undefined> => {
  try {
    return (await getLatestRelease(proxy)).version;
  } catch (_error) {
    return undefined;
  }
};

export const getReleaseCheck = async (currentVersion: string, proxy?: proxy, force = false): Promise<ReleaseCheckResult> => {
  const release = await getLatestRelease(proxy, force);
  return {
    ...release,
    currentVersion: currentVersion.replace(/^[vV]/, ''),
    updateAvailable: isNewVersion(currentVersion, release.version)
  };
};

export const checkUpdate = async (version: string, proxy?: proxy): Promise<ReleaseCheckResult | undefined> => withLogSecrets({ proxy }, async () => {
  const logger = new Logger(`${time()}${__('checkingUpdating')}`, false);
  try {
    const result = await getReleaseCheck(version, proxy);
    if (result.updateAvailable) {
      logger.log(chalk.green(__('newVersion', chalk.yellow(`V${result.version}`))));
      new Logger(`${time()}${__('downloadLink', chalk.yellow(result.releaseUrl))}`);
      globalThis.newVersionNotice = `\n\n${__('newVersion', `V${result.version}`)}\n${__('downloadLink', result.releaseUrl)}`;
    } else {
      logger.log(chalk.green(__('noUpdate')));
    }
    return result;
  } catch (error) {
    const requestError = error as Parameters<typeof netError>[0];
    logger.log(chalk.red(__('logStatusError')) + netError(requestError));
    setLogSecrets(Object.values(Cookie.ToJson(requestError.response?.headers?.['set-cookie'])).map((cookie) => ({ cookie })));
    new Logger(error);
    return undefined;
  }
});

export type { ReleaseAsset, ReleaseCheckResult, ReleaseInfo };
