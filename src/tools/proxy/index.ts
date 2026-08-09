/** Proxy-agent creation for HTTP, HTTPS, and SOCKS configurations. */
import * as tunnel from 'tunnel';
import { SocksProxyAgent, type SocksProxyAgentOptions } from 'socks-proxy-agent';

export const formatProxy = (configuration: proxy): myAxiosConfig['httpsAgent'] => {
  const options: tunnel.ProxyOptions & SocksProxyAgentOptions = { host: configuration.host, port: configuration.port };
  if (configuration.protocol?.includes('socks')) {
    options.hostname = configuration.host;
    if (configuration.username && configuration.password) {
      options.userId = configuration.username;
      options.password = configuration.password;
    }
    return new SocksProxyAgent(options);
  }
  if (configuration.username && configuration.password) {
    options.proxyAuth = `${configuration.username}:${configuration.password}`;
  }
  if (configuration.protocol === 'http') {
    return tunnel.httpsOverHttp({ proxy: options });
  }
  if (configuration.protocol === 'https') {
    return tunnel.httpsOverHttps({ proxy: options });
  }
  return undefined;
};
