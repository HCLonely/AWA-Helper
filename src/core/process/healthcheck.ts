import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { parse } from 'yaml';

type HealthConfig = {
  webUI?: { enable?: boolean, port?: number, ssl?: { cert?: string } }
  managerServer?: { enable?: boolean, port?: number, ssl?: { cert?: string } }
};

const findConfigPath = (): string | undefined => [
  'config.yml',
  path.join('config', 'config.yml'),
  path.join('..', 'config.yml'),
  path.join('..', 'config', 'config.yml')
].find((candidate) => fs.existsSync(candidate));

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

const isHelperProcessAlive = async (): Promise<boolean> => {
  try {
    const lock = JSON.parse(await fs.promises.readFile(path.join('data', 'helper.lock'), 'utf8')) as { pid?: unknown };
    if (!Number.isSafeInteger(lock.pid) || (lock.pid as number) <= 0) return false;
    process.kill(lock.pid as number, 0);
    return true;
  } catch (_error) {
    return false;
  }
};

const runHealthcheck = async (): Promise<boolean> => {
  const configPath = findConfigPath();
  if (!configPath) return false;
  try {
    const config = parse(await fs.promises.readFile(configPath, 'utf8')) as HealthConfig;
    const managerMode = process.env.helperMode === 'manager' || process.env.AWA_HELPER_HEALTH_TARGET === 'manager';
    if (managerMode) {
      if (!config.managerServer?.enable) return false;
      return await requestHealthEndpoint(config.managerServer.port || 2345, !!config.managerServer.ssl?.cert);
    }
    if (config.webUI?.enable) {
      return await requestHealthEndpoint(config.webUI.port || 3456, !!config.webUI.ssl?.cert);
    }
    return await isHelperProcessAlive();
  } catch (_error) {
    return false;
  }
};

export { findConfigPath, requestHealthEndpoint, runHealthcheck };
