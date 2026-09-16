/**
 * @file src/tools/config/ConfigLoader.ts
 * @description 定位 YAML 配置文件，执行解析与校验，并输出标准化应用配置。
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
  debug: {
    http: false
  },
  webUI: {
    enable: true,
    port: 2345,
    local: true
  },
  awaHost: 'www.alienwarearena.com',
  awaQuests: ['getStarted', 'dailyQuest', 'timeOnSite'],
  awaDailyQuestType: ['click', 'visitLink', 'openLink', 'changeBorder', 'changeAvatar', 'viewNews'],
  asfProtocol: 'http'
};

/**
 * 定位配置文件。
 * @returns `string`，locateConfig 获取或生成的文本内容。
 */
const locateConfig = (): string => {
  const candidates = ['config.yml', join('config', 'config.yml')];
  if (/dist$|output$/.test(process.cwd())) {
    candidates.push(join('..', 'config.yml'), join('..', 'config', 'config.yml'));
  }
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`[CONFIG_NOT_FOUND] Configuration file not found: ${resolve(candidates[1])}`);
  }
  return found;
};

/**
 * 规范化 Manager 配置。
 * @param value - 需要写入或参与计算的值，类型为 `config`。
 * @param configPath - 待读取或写入文件的路径，类型为 `string`。
 * @returns `NormalizedManagerConfig`，补齐默认值并通过校验的标准 Manager 配置。
 */
const normalizeManager = (value: config, configPath: string): NormalizedManagerConfig => {
  const legacy = value.managerServer;
  const current = value.manager;
  let secret = current?.secret || legacy?.secret || '';
  if (!secret) {
    secret = crypto.randomBytes(24).toString('hex');
    updateYamlFieldsSync(configPath, {
      'manager.secret': secret
    });
  }
  return {
    secret,
    ...normalizeManagerConfig(value)
  };
};

/**
 * 加载配置。
 * @returns `LoadedConfig`，loadConfig 获取到的数据。
 */
const loadConfig = (configPath?: string): LoadedConfig => {
  const path = configPath || locateConfig();
  const source = fs.readFileSync(path, 'utf8');
  validateYaml(source);
  const raw = deepMerge(defaultConfig, parse(source));
  const errors = validateHelperConfig(raw);
  if (errors.length > 0) {
    throw createConfigValidationError(source, errors);
  }
  return {
    path,
    raw,
    manager: normalizeManager(raw, path)
  };
};

export { defaultConfig, loadConfig, locateConfig };
