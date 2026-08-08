/** @description Decodes Manager WebSocket credentials from the negotiated protocol header. */
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
