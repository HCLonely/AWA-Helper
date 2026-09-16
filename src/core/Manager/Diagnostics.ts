import { AWAContext } from '../../client/AWA/AWAContext';
import { getControlCenter } from '../../client/AWA/APIs/quests/getControlCenter';
import { parseVerifiedControlCenter } from '../../client/AWA/parsers/verifiedControlCenter';
import { TwitchContext } from '../../client/Twitch/TwitchContext';
import { verifySession as verifyTwitch } from '../../client/Twitch/APIs/session/verifySession';
import { linkedExtensionsQuery } from '../../client/Twitch/queries';
import { ASFContext } from '../../client/Steam/ASFContext';
import { createHttpTransport, type HttpTransport } from '../../client/shared/HttpTransport';
import { http, retryDelayMs } from '../../tools/http/client';
import { runWithRequestSignal } from '../../tools/http/RequestContext';
import { withLogSecrets } from '../../tools/logging/sanitize';

export type DiagnosticCode = 'ok' | 'disabled' | 'missing-config' | 'session-expired' | 'extension-missing' |
  'network-rejected' | 'rate-limited' | 'page-changed' | 'connection-failed';
export interface DiagnosticResult {
  platform: 'awa' | 'twitch' | 'asf'; code: DiagnosticCode; checkedAt: string;
  retryAt?: string; parser?: string; missingFields?: string[];
}

/** Inspect causes, never return raw request objects, response bodies, URLs or credentials. */
export const classifyDiagnosticError = (platform: DiagnosticResult['platform'], error: unknown): DiagnosticResult => {
  const result: DiagnosticResult = { platform, code: 'connection-failed', checkedAt: new Date().toISOString() };
  const visited = new Set<unknown>();
  let current = error;
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    const value = current as { statusCode?: number; response?: { status?: number; headers?: Record<string, unknown> }; cause?: unknown; parser?: string; missingFields?: string[] };
    const status = value.statusCode || value.response?.status;
    if (status === 429) {
      result.code = 'rate-limited';
      const delay = retryDelayMs(value.response?.headers?.['retry-after'], 60000);
      const retryAt = Date.now() + delay;
      if (Number.isFinite(retryAt) && retryAt <= 8.64e15) {
        result.retryAt = new Date(retryAt).toISOString();
      }
      return result;
    }
    if (status === 401 || status === 602) {
      result.code = 'session-expired';
    }
    if (status === 610) {
      result.code = 'network-rejected';
    }
    if (value.parser) {
      result.code = 'page-changed'; result.parser = value.parser; result.missingFields = value.missingFields;
    }
    current = value.cause;
  }
  return result;
};

export class Diagnostics {
  private pending?: Promise<DiagnosticResult[]>;
  private latest: DiagnosticResult[] = [];
  private lastConfig?: string;
  private controller?: AbortController;

  snapshot(): DiagnosticResult[] {
    return structuredClone(this.latest);
  }

  async stop(): Promise<void> {
    this.controller?.abort(); await this.pending;
  }

  run(config: config, transport?: HttpTransport): Promise<DiagnosticResult[]> {
    if (this.pending) {
      return this.pending;
    }
    // Cache only identical configurations. Configuration content stays in memory.
    const signature = JSON.stringify(config);
    if (signature === this.lastConfig && this.latest.length && Date.now() - Date.parse(this.latest[0].checkedAt) < 30000) {
      return Promise.resolve(this.snapshot());
    }
    this.controller = new AbortController();
    const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(20000)]);
    const bounded = transport || createHttpTransport((options) => http({ ...options, signal, timeout: 10000, retryTimes: 0, maxContentLength: 4 * 1024 * 1024 } as myAxiosConfig));
    const probe = async (platform: DiagnosticResult['platform'], action: () => Promise<DiagnosticCode>): Promise<DiagnosticResult> => {
      const previous = this.latest.find((check) => check.platform === platform);
      if (this.lastConfig === signature && previous?.retryAt && Date.parse(previous.retryAt) > Date.now()) {
        return { ...previous };
      }
      try {
        return { platform, code: await action(), checkedAt: new Date().toISOString() };
      } catch (error) {
        return classifyDiagnosticError(platform, error);
      }
    };
    this.pending = withLogSecrets(config, () => runWithRequestSignal(signal, async () => {
      const results = await Promise.all([
        probe('awa', async () => {
          if (!config.awaCookie) {
            return 'missing-config';
          }
          const awa = new AWAContext({ cookie: config.awaCookie, host: config.awaHost, proxy: config.proxy, userAgent: config.UA, transport: bounded });
          try {
            const html = await getControlCenter(awa);
            parseVerifiedControlCenter(html, awa.baseURL);
            return 'ok';
          } finally {
            awa.httpsAgent?.destroy();
          }
        }),
        probe('twitch', async () => {
          if (!config.awaQuests.includes('watchTwitch')) {
            return 'disabled';
          }
          if (!config.twitchCookie) {
            return 'missing-config';
          }
          const twitch = new TwitchContext({ cookie: config.twitchCookie, proxy: config.proxy, transport: bounded });
          try {
            if (!twitch.cookie.get('auth-token') || !twitch.cookie.get('unique_id')) {
              return 'missing-config';
            }
            await verifyTwitch(twitch);
            const response = await twitch.request<Array<{ data?: { currentUser?: { linkedExtensions?: Array<{ name?: string }> } }; errors?: unknown[] }>>({
              url: 'https://gql.twitch.tv/gql', method: 'POST', headers: { 'Client-Id': twitch.clientId }, data: linkedExtensionsQuery
            });
            const envelope = response.data?.[0];
            if (!envelope || envelope.errors?.length) {
              return 'connection-failed';
            }
            if (!envelope.data?.currentUser) {
              return 'session-expired';
            }
            const extensions = envelope.data.currentUser.linkedExtensions;
            if (!Array.isArray(extensions)) {
              return 'page-changed';
            }
            return extensions.some((item) => item.name === 'Arena Rewards Tracker') ? 'ok' : 'extension-missing';
          } finally {
            twitch.httpsAgent?.destroy();
          }
        }),
        probe('asf', async () => {
          if (!config.awaQuests.includes('steamQuest')) {
            return 'disabled';
          }
          if (!config.asfHost || !config.asfPort || !config.asfBotname) {
            return 'missing-config';
          }
          const asf = new ASFContext({ protocol: config.asfProtocol, host: config.asfHost, port: config.asfPort,
            password: config.asfPassword, botName: config.asfBotname, proxy: config.proxy, transport: bounded });
          try {
            const response = await asf.request<{ Success?: boolean }>({ url: asf.commandURL.replace(/\/Command$/, '/ASF'), method: 'GET' });
            return response.data?.Success === true ? 'ok' : 'connection-failed';
          } finally {
            asf.httpAgent?.destroy(); asf.httpsAgent?.destroy();
          }
        })
      ]);
      this.latest = results; this.lastConfig = signature;
      return this.snapshot();
    })).finally(() => {
      this.pending = undefined; this.controller = undefined;
    });
    return this.pending;
  }
}
