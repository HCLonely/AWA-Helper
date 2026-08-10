/**
 * @file src/tools/process/healthcheck.ts
 * @description 请求统一 Manager 健康端点，并将响应转换为命令行健康状态。
 */
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { parse } from 'yaml';

type HealthConfig = {
  webUI?: { enable?: boolean, port?: number, ssl?: { cert?: string } }
};

/**
 * 获取 find Config Path 相关数据。
 * @returns `string | undefined`，findConfigPath 获取到的数据。
 */
const findConfigPath = (): string | undefined => [
  'config.yml',
  path.join('config', 'config.yml'),
  path.join('..', 'config.yml'),
  path.join('..', 'config', 'config.yml')
].find((candidate) => fs.existsSync(candidate));

/**
 * 请求 request Health Endpoint 相关数据。
 * @param port - 目标服务监听的端口号，类型为 `number`。
 * @param useTls - 用于决定健康检查是否通过 TLS 发起，类型为 `boolean`。
 * @returns `Promise<boolean>`，表示 requestHealthEndpoint 检查是否通过。
 */
const requestHealthEndpoint = (port: number, useTls: boolean): Promise<boolean> => new Promise((resolve) => {
  const transport = useTls ? https : http;
  const request = transport.get({
    hostname: '127.0.0.1',
    port,
    path: '/health/live',
    timeout: 3000,
    rejectUnauthorized: false
  }, (response) => {
    response.resume();
    resolve(response.statusCode === 200);
  });
  request.once('timeout', () => request.destroy());
  request.once('error', () => resolve(false));
});

/**
 * 执行 run Healthcheck 相关数据。
 * @returns `Promise<boolean>`，表示 runHealthcheck 检查是否通过。
 */
const runHealthcheck = async (): Promise<boolean> => {
  const configPath = findConfigPath();
  if (!configPath) {
    return false;
  }
  try {
    const config = parse(await fs.promises.readFile(configPath, 'utf8')) as HealthConfig;
    if (config.webUI?.enable === false) {
      return false;
    }
    return await requestHealthEndpoint(config.webUI?.port || 2345, !!config.webUI?.ssl?.cert);
  } catch (_error) {
    return false;
  }
};

export { findConfigPath, requestHealthEndpoint, runHealthcheck };
