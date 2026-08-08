/**
 * @file healthcheck
 * @description Probes the unified Manager WebUI endpoint for CLI and container health checks.
 */
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { parse } from 'yaml';

type HealthConfig = {
  webUI?: { enable?: boolean, port?: number, ssl?: { cert?: string } }
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

const runHealthcheck = async (): Promise<boolean> => {
  const configPath = findConfigPath();
  if (!configPath) return false;
  try {
    const config = parse(await fs.promises.readFile(configPath, 'utf8')) as HealthConfig;
    if (config.webUI?.enable === false) return false;
    return await requestHealthEndpoint(config.webUI?.port || 3456, !!config.webUI?.ssl?.cert);
  } catch (_error) {
    return false;
  }
};

export { findConfigPath, requestHealthEndpoint, runHealthcheck };
