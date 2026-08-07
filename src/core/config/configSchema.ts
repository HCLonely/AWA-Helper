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
  if (value.awaQuests !== undefined && (!Array.isArray(value.awaQuests) || value.awaQuests.some((item) => typeof item !== 'string'))) errors.push('awaQuests must be an array of strings');
  if (value.awaDailyQuestType !== undefined && (!Array.isArray(value.awaDailyQuestType) || value.awaDailyQuestType.some((item) => typeof item !== 'string'))) errors.push('awaDailyQuestType must be an array of strings');

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
  if (isRecord(value.webUI)) validatePort('webUI.port', value.webUI.port);
  if (isRecord(value.managerServer)) validatePort('managerServer.port', value.managerServer.port);
  if (isRecord(value.proxy) && value.proxy.protocol !== undefined && !['http', 'https', 'socks4', 'socks5'].includes(value.proxy.protocol as string)) {
    errors.push('proxy.protocol is invalid');
  }
  return errors;
};

export { deepMerge, validateHelperConfig };
