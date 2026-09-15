/**
 * @file src/tools/config/ConfigSchema.ts
 * @description 合并默认配置，并校验端口、任务开关、密钥和嵌套配置字段。
 */
import * as cron from 'node-cron';

const allowedAwaQuests = new Set(['getStarted', 'dailyQuest', 'dailyQuestOld', 'battlePass', 'timeOnSite', 'watchTwitch', 'steamQuest']);
const allowedDailyQuestTypes = new Set(['click', 'visitLink', 'openLink', 'changeBorder', 'changeAvatar', 'viewNews', 'sharePost', 'replyPost']);
// `steam` is retained for one compatibility cycle, but no longer owns a distinct request path.
const allowedProxyTargets = new Set(['github', 'twitch', 'awa', 'asf', 'steam', 'pusher']);

/**
 * 检查 is Record 相关数据。
 * @param value - 需要写入或参与计算的值，类型为 `unknown`。
 * @returns `boolean`，表示 isRecord 检查是否通过。
 */
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * 处理 deep Merge 相关逻辑。
 * @param defaults - 输入缺失时使用的默认配置值，类型为 `T`。
 * @param input - 需要合并、解析或校验的输入值，类型为 `unknown`。
 * @returns `T`，以默认值补齐输入内容后得到的完整配置对象。
 */
const deepMerge = <T>(defaults: T, input: unknown): T => {
  if (!isRecord(defaults) || !isRecord(input)) {
    return (input === undefined ? defaults : input) as T;
  }

  const result: Record<string, unknown> = { ...defaults };
  Object.entries(input).forEach(([key, value]) => {
    const defaultValue = (defaults as Record<string, unknown>)[key];
    result[key] = isRecord(defaultValue) && isRecord(value)
      ? deepMerge(defaultValue, value)
      : value;
  });
  return result as T;
};

/**
 * 检查 validate Helper Config 相关数据。
 * @param value - 需要写入或参与计算的值，类型为 `unknown`。
 * @returns `string[]`，validateHelperConfig 收集或筛选得到的数据列表。
 */
const validateHelperConfig = (value: unknown): Array<string> => {
  if (!isRecord(value)) {
    return ['config must be an object'];
  }
  const errors: Array<string> = [];
  if (!['zh', 'en'].includes(value.language as string)) {
    errors.push('language must be zh or en');
  }
  if (typeof value.awaHost !== 'string' || !value.awaHost.trim()) {
    errors.push('awaHost must be a non-empty string');
  }
  if (typeof value.awaHost === 'string' && !/^[a-z\d.-]+(?::\d+)?$/i.test(value.awaHost)) {
    errors.push('awaHost must be a hostname with an optional port');
  }
  if (value.awaQuests !== undefined && (!Array.isArray(value.awaQuests) || value.awaQuests.some((item) => typeof item !== 'string'))) {
    errors.push('awaQuests must be an array of strings');
  } else if (Array.isArray(value.awaQuests)) {
    value.awaQuests.forEach((item, index) => {
      if (!allowedAwaQuests.has(item)) {
        errors.push(`awaQuests[${index}] contains unsupported value: ${item}`);
      }
    });
  }
  if (value.awaDailyQuestType !== undefined && (!Array.isArray(value.awaDailyQuestType) || value.awaDailyQuestType.some((item) => typeof item !== 'string'))) {
    errors.push('awaDailyQuestType must be an array of strings');
  } else if (Array.isArray(value.awaDailyQuestType)) {
    value.awaDailyQuestType.forEach((item, index) => {
      if (!allowedDailyQuestTypes.has(item)) {
        errors.push(`awaDailyQuestType[${index}] contains unsupported value: ${item}`);
      }
    });
  }

  /**
   * 检查 validate Boolean 相关数据。
   * @param name - 用于定位目标对象的名称，类型为 `string`。
   * @param field - 需要读取、校验或更新的字段，类型为 `unknown`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  const validateBoolean = (name: string, field: unknown): void => {
    if (field !== undefined && typeof field !== 'boolean') {
      errors.push(`${name} must be a boolean`);
    }
  };
  validateBoolean('TLSRejectUnauthorized', value.TLSRejectUnauthorized);
  validateBoolean('autoUpdate', value.autoUpdate);
  validateBoolean('joinSteamCommunityEvent', value.joinSteamCommunityEvent);
  if (value.debug !== undefined) {
    if (!isRecord(value.debug)) {
      errors.push('debug must be an object');
    } else {
      validateBoolean('debug.http', value.debug.http);
    }
  }

  /**
   * 检查 validate Non Negative Number 相关数据。
   * @param name - 用于定位目标对象的名称，类型为 `string`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  const validateNonNegativeNumber = (name: string): void => {
    const field = value[name];
    if (field !== undefined && (typeof field !== 'number' || !Number.isFinite(field) || field < 0)) {
      errors.push(`${name} must be a non-negative number`);
    }
  };
  validateNonNegativeNumber('timeout');
  validateNonNegativeNumber('logsExpire');
  validateNonNegativeNumber('logsMaxMB');

  /**
   * 检查 validate Port 相关数据。
   * @param name - 用于定位目标对象的名称，类型为 `string`。
   * @param port - 目标服务监听的端口号，类型为 `unknown`。
   * @returns `void`，该函数仅执行副作用，不返回值。
   */
  const validatePort = (name: string, port: unknown): void => {
    if (port !== undefined && (!Number.isInteger(port) || (port as number) < 1 || (port as number) > 65535)) {
      errors.push(`${name} must be an integer between 1 and 65535`);
    }
  };
  if (!isRecord(value.webUI)) {
    errors.push('webUI must be an object');
  } else {
    validateBoolean('webUI.enable', value.webUI.enable);
    if (value.webUI.enable === true) {
      validateBoolean('webUI.local', value.webUI.local);
      validatePort('webUI.port', value.webUI.port);
      if (value.webUI.reverseProxyPort !== undefined && value.webUI.reverseProxyPort !== 0) {
        validatePort('webUI.reverseProxyPort', value.webUI.reverseProxyPort);
      }
      if (value.webUI.ssl !== undefined) {
        if (!isRecord(value.webUI.ssl)) {
          errors.push('webUI.ssl must be an object');
        } else {
          const hasKey = typeof value.webUI.ssl.key === 'string' && value.webUI.ssl.key.trim().length > 0;
          const hasCert = typeof value.webUI.ssl.cert === 'string' && value.webUI.ssl.cert.trim().length > 0;
          if (hasKey !== hasCert) {
            errors.push('webUI.ssl.key and webUI.ssl.cert must be configured together');
          }
        }
      }
    }
  }
  if (value.managerServer !== undefined) {
    if (!isRecord(value.managerServer)) {
      errors.push('managerServer must be an object');
    } else {
      validateBoolean('managerServer.enable', value.managerServer.enable);
      if (value.managerServer.enable === true) {
        validateBoolean('managerServer.local', value.managerServer.local);
        validatePort('managerServer.port', value.managerServer.port);
        if (typeof value.managerServer.secret !== 'string' || value.managerServer.secret.length < 16) {
          errors.push('managerServer.secret must contain at least 16 characters when enabled');
        }
        if (value.managerServer.corn !== undefined && value.managerServer.corn !== null && value.managerServer.corn !== '' && typeof value.managerServer.corn !== 'string') {
          errors.push('managerServer.corn must be a string');
        }
        let legacyCron: string | undefined;
        if (typeof value.managerServer.cron === 'string') {
          legacyCron = value.managerServer.cron;
        } else if (typeof value.managerServer.corn === 'string') {
          legacyCron = value.managerServer.corn;
        }
        if (legacyCron && !cron.validate(legacyCron)) {
          errors.push('managerServer.cron must be a valid cron expression');
        }
        if (value.managerServer.artifacts !== undefined && value.managerServer.artifacts !== null && (!Array.isArray(value.managerServer.artifacts) || value.managerServer.artifacts.some((item) => !isRecord(item) || typeof item.corn !== 'string' || typeof item.ids !== 'string'))) {
          errors.push('managerServer.artifacts must contain corn and ids strings');
        }
      }
    }
  }
  if (value.manager !== undefined) {
    if (!isRecord(value.manager)) {
      errors.push('manager must be an object');
    } else {
      if (value.manager.secret !== undefined && typeof value.manager.secret !== 'string') {
        errors.push('manager.secret must be a string');
      }
      if (value.manager.dailyQuest !== undefined && (!isRecord(value.manager.dailyQuest) || (value.manager.dailyQuest.cron !== undefined && typeof value.manager.dailyQuest.cron !== 'string'))) {
        errors.push('manager.dailyQuest.cron must be a string');
      } else if (isRecord(value.manager.dailyQuest) && typeof value.manager.dailyQuest.cron === 'string' && value.manager.dailyQuest.cron.trim() && !cron.validate(value.manager.dailyQuest.cron)) {
        errors.push('manager.dailyQuest.cron must be a valid cron expression');
      }
      if (value.manager.achievement !== undefined) {
        if (!isRecord(value.manager.achievement)) {
          errors.push('manager.achievement must be an object');
        } else {
          validateBoolean('manager.achievement.enable', value.manager.achievement.enable);
          if (value.manager.achievement.cron !== undefined && typeof value.manager.achievement.cron !== 'string') {
            errors.push('manager.achievement.cron must be a string');
          } else if (value.manager.achievement.enable === true && (typeof value.manager.achievement.cron !== 'string' || !cron.validate(value.manager.achievement.cron))) {
            errors.push('manager.achievement.cron must be a valid cron expression');
          }
        }
      }
      if (value.manager.artifacts !== undefined && (!Array.isArray(value.manager.artifacts) || value.manager.artifacts.some((item) => !isRecord(item) || typeof item.cron !== 'string' || !Array.isArray(item.ids) || item.ids.length !== 3 || new Set(item.ids).size !== 3 || item.ids.some((id) => !Number.isSafeInteger(id) || (id as number) <= 0)))) {
        errors.push('manager.artifacts must contain cron strings and exactly three distinct positive integer ids');
      } else if (Array.isArray(value.manager.artifacts)) {
        value.manager.artifacts.forEach((item, index) => {
          if (isRecord(item) && typeof item.cron === 'string' && !cron.validate(item.cron)) {
            errors.push(`manager.artifacts[${index}].cron must be a valid cron expression`);
          }
        });
      }
    }
  }
  if (value.proxy !== undefined) {
    if (!isRecord(value.proxy)) {
      errors.push('proxy must be an object');
    } else {
      const proxyEnabled = Array.isArray(value.proxy.enable) && value.proxy.enable.length > 0;
      if (value.proxy.enable !== undefined && value.proxy.enable !== null && !Array.isArray(value.proxy.enable)) {
        errors.push('proxy.enable must be an array of strings');
      }
      if (Array.isArray(value.proxy.enable) && value.proxy.enable.some((item) => typeof item !== 'string')) {
        errors.push('proxy.enable must be an array of strings');
      } else if (Array.isArray(value.proxy.enable)) {
        value.proxy.enable.forEach((item, index) => {
          if (!allowedProxyTargets.has(item)) {
            errors.push(`proxy.enable[${index}] contains unsupported value: ${item}`);
          }
        });
      }
      if (proxyEnabled) {
        if (!['http', 'https', 'socks4', 'socks5'].includes(value.proxy.protocol as string)) {
          errors.push('proxy.protocol is invalid');
        }
        if (typeof value.proxy.host !== 'string' || !value.proxy.host.trim()) {
          errors.push('proxy.host must be a non-empty string');
        }
        validatePort('proxy.port', value.proxy.port);
      }
    }
  }
  const steamQuestEnabled = Array.isArray(value.awaQuests) && value.awaQuests.includes('steamQuest');
  if (steamQuestEnabled) {
    if (value.steamUse !== 'ASF') {
      errors.push('steamUse must be ASF when steamQuest is enabled');
    }
    if (value.asfProtocol !== undefined && !['http', 'https'].includes(value.asfProtocol as string)) {
      errors.push('asfProtocol must be http or https');
    }
    validatePort('asfPort', value.asfPort);
    if (typeof value.asfHost !== 'string' || !value.asfHost.trim()) {
      errors.push('asfHost must be a non-empty string when steamQuest is enabled');
    }
    if (typeof value.asfBotname !== 'string' || !value.asfBotname.trim()) {
      errors.push('asfBotname must be a non-empty string when steamQuest is enabled');
    }
  }
  if (value.steamUse !== undefined && value.steamUse !== 'ASF') {
    errors.push('steamUse must be ASF');
  }
  if (value.UA !== undefined && typeof value.UA !== 'string') {
    errors.push('UA must be a string');
  }
  const twitchEnabled = Array.isArray(value.awaQuests) && value.awaQuests.includes('watchTwitch');
  const hasTwitchCookieField = (name: string): boolean => typeof value.twitchCookie === 'string' && new RegExp(`(?:^|;\\s*)${name}=[^;]+`).test(value.twitchCookie);
  if (twitchEnabled && (!hasTwitchCookieField('auth-token') || !hasTwitchCookieField('unique_id'))) {
    errors.push('twitchCookie must contain auth-token and unique_id when watchTwitch is enabled');
  }
  if (value.pusher !== undefined) {
    if (!isRecord(value.pusher)) {
      errors.push('pusher must be an object');
    } else {
      validateBoolean('pusher.enable', value.pusher.enable);
      if (value.pusher.enable === true) {
        if (typeof value.pusher.platform !== 'string' || !value.pusher.platform.trim()) {
          errors.push('pusher.platform must be a non-empty string when enabled');
        }
        if (!isRecord(value.pusher.key) || Object.keys(value.pusher.key).length === 0) {
          errors.push('pusher.key must be a non-empty object when enabled');
        }
        if (value.pusher.options !== undefined && !isRecord(value.pusher.options)) {
          errors.push('pusher.options must be an object');
        }
      }
    }
  }
  return errors;
};

export { deepMerge, validateHelperConfig };
