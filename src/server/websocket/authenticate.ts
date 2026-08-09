/**
 * @file src/server/websocket/authenticate.ts
 * @description 从 WebSocket 子协议请求头中解析并规范化 Manager 身份验证密钥。
 */
/**
 * 解析 decode Manager Web Socket Secret 相关数据。
 * @param header - 携带 WebSocket 身份凭据的请求头值，类型为 `string | string[] | undefined`。
 * @returns `string`，decodeManagerWebSocketSecret 获取或生成的文本内容。
 */
const decodeManagerWebSocketSecret = (header: string | string[] | undefined): string => {
  const protocols = String(header || '').split(',').map((item) => item.trim());
  if (protocols[0] !== 'awa-manager' || !protocols[1] || protocols[1].length > 8192) return '';
  try {
    return Buffer.from(protocols[1], 'base64url').toString('utf8');
  } catch (_error) {
    return '';
  }
};

export { decodeManagerWebSocketSecret };
