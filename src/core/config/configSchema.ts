const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

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

const validateHelperConfig = (value: unknown): Array<string> => {
  if (!isRecord(value)) return ['config must be an object'];
  const errors: Array<string> = [];
  if (!['zh', 'en'].includes(value.language as string)) errors.push('language must be zh or en');
  if (typeof value.awaHost !== 'string' || !value.awaHost.trim()) errors.push('awaHost must be a non-empty string');
  if (typeof value.awaHost === 'string' && !/^[a-z\d.-]+(?::\d+)?$/i.test(value.awaHost)) errors.push('awaHost must be a hostname with an optional port');
  if (value.awaQuests !== undefined && (!Array.isArray(value.awaQuests) || value.awaQuests.some((item) => typeof item !== 'string'))) errors.push('awaQuests must be an array of strings');
  if (value.awaDailyQuestType !== undefined && (!Array.isArray(value.awaDailyQuestType) || value.awaDailyQuestType.some((item) => typeof item !== 'string'))) errors.push('awaDailyQuestType must be an array of strings');

  const validateBoolean = (name: string, field: unknown): void => {
    if (field !== undefined && typeof field !== 'boolean') errors.push(`${name} must be a boolean`);
  };
  validateBoolean('TLSRejectUnauthorized', value.TLSRejectUnauthorized);
  validateBoolean('autoUpdate', value.autoUpdate);
  validateBoolean('joinSteamCommunityEvent', value.joinSteamCommunityEvent);

  const validateNonNegativeNumber = (name: string): void => {
    const field = value[name];
    if (field !== undefined && (typeof field !== 'number' || !Number.isFinite(field) || field < 0)) {
      errors.push(`${name} must be a non-negative number`);
    }
  };
  validateNonNegativeNumber('timeout');
  validateNonNegativeNumber('logsExpire');

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
        if (value.managerServer.corn !== undefined && value.managerServer.corn !== null && value.managerServer.corn !== '' && typeof value.managerServer.corn !== 'string') errors.push('managerServer.corn must be a string');
        if (value.managerServer.artifacts !== undefined && value.managerServer.artifacts !== null && (!Array.isArray(value.managerServer.artifacts) || value.managerServer.artifacts.some((item) => !isRecord(item) || typeof item.corn !== 'string' || typeof item.ids !== 'string'))) {
          errors.push('managerServer.artifacts must contain corn and ids strings');
        }
      }
    }
  }
  if (value.proxy !== undefined) {
    if (!isRecord(value.proxy)) {
      errors.push('proxy must be an object');
    } else {
      const proxyEnabled = Array.isArray(value.proxy.enable) && value.proxy.enable.length > 0;
      if (value.proxy.enable !== undefined && value.proxy.enable !== null && !Array.isArray(value.proxy.enable)) errors.push('proxy.enable must be an array of strings');
      if (Array.isArray(value.proxy.enable) && value.proxy.enable.some((item) => typeof item !== 'string')) errors.push('proxy.enable must be an array of strings');
      if (proxyEnabled) {
        if (!['http', 'https', 'socks4', 'socks5'].includes(value.proxy.protocol as string)) errors.push('proxy.protocol is invalid');
        if (typeof value.proxy.host !== 'string' || !value.proxy.host.trim()) errors.push('proxy.host must be a non-empty string');
        validatePort('proxy.port', value.proxy.port);
      }
    }
  }
  const steamQuestEnabled = Array.isArray(value.awaQuests) && value.awaQuests.includes('steamQuest');
  if (steamQuestEnabled) {
    if (value.asfProtocol !== undefined && !['http', 'https'].includes(value.asfProtocol as string)) errors.push('asfProtocol must be http or https');
    validatePort('asfPort', value.asfPort);
  }
  if (value.steamUse !== undefined && value.steamUse !== 'ASF') errors.push('steamUse must be ASF');
  if (value.UA !== undefined && typeof value.UA !== 'string') errors.push('UA must be a string');
  return errors;
};

export { deepMerge, validateHelperConfig };
