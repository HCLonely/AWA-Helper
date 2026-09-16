/**
 * @file src/client/shared/ProxyAgentFactory.ts
 * @description 根据 HTTP、HTTPS 或 SOCKS 地址创建项目支持的代理代理器。
 */
import { formatProxy } from '../../tools/proxy';

/**
 * 创建代理连接器。
 * @param configuration - 控制当前操作行为的配置，类型为 `proxy`。
 * @returns `any`，createProxyAgent 创建的对象或数据。
 */
export const createProxyAgent = (
  configuration: proxy,
  targetProtocol: 'http' | 'https' = 'https'
): myAxiosConfig['httpsAgent'] => formatProxy(configuration, targetProtocol);
