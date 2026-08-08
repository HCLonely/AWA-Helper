/**
 * @file ConfigLoader
 * @description Locates, validates, and normalizes current or legacy YAML configuration.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import { join, resolve } from 'path';
import { parse } from 'yaml';
import { deepMerge, validateHelperConfig } from './ConfigSchema';
import { createConfigValidationError, updateYamlFieldsSync, validateYaml } from './YamlConfig';
import type { LoadedConfig, NormalizedManagerConfig } from './types';
import { normalizeManagerConfig } from './ConfigMigration';

const defaultConfig: config = {
  language: 'zh',
  timeout: 86400,
  logsExpire: 30,
  webUI: { enable: true, port: 3456, local: true },
  awaHost: 'www.alienwarearena.com',
  awaQuests: ['getStarted', 'dailyQuest', 'timeOnSite', 'watchTwitch', 'steamQuest'],
  awaDailyQuestType: ['click', 'visitLink', 'openLink', 'changeBorder', 'changeAvatar', 'viewNews'],
  asfProtocol: 'http'
};

const locateConfig = (): string => {
  const candidates = ['config.yml', join('config', 'config.yml')];
  if (/dist$|output$/.test(process.cwd())) {
    candidates.push(join('..', 'config.yml'), join('..', 'config', 'config.yml'));
  }
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`Configuration file not found: ${resolve(candidates[1])}`);
  return found;
};

const normalizeManager = (value: config, configPath: string): NormalizedManagerConfig => {
  const legacy = value.managerServer;
  const current = value.manager;
  let secret = current?.secret || legacy?.secret || '';
  if (!secret) {
    secret = crypto.randomBytes(24).toString('hex');
    updateYamlFieldsSync(configPath, { 'manager.secret': secret });
  }
  return {
    secret,
    ...normalizeManagerConfig(value)
  };
};

const loadConfig = (): LoadedConfig => {
  const path = locateConfig();
  const source = fs.readFileSync(path, 'utf8');
  validateYaml(source);
  const raw = deepMerge(defaultConfig, parse(source));
  const errors = validateHelperConfig(raw);
  if (errors.length > 0) throw createConfigValidationError(source, errors);
  return { path, raw, manager: normalizeManager(raw, path) };
};

export { defaultConfig, loadConfig, locateConfig };
