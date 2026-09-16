/** Ordered GitHub fallbacks shared by release lookup and asset downloads. */
const prefixes = ['', 'https://gh-proxy.org/', 'https://cdn.gh-proxy.org/', 'https://axisnow.gh-proxy.org/'];

export const githubSources = (original: string): string[] => {
  const url = new URL(original);
  if (url.protocol !== 'https:' || !['api.github.com', 'github.com'].includes(url.hostname) || url.username || url.password) {
    throw new Error('Expected an original HTTPS GitHub URL');
  }
  return prefixes.map((prefix) => prefix + original);
};

export const withGitHubFallback = async <T>(original: string, attempt: (url: string) => Promise<T>): Promise<T> => {
  const failures: string[] = [];
  for (const url of githubSources(original)) {
    try {
      return await attempt(url);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 410) {
        throw error;
      }
      // Do not include request headers, credentials or response bodies in diagnostics.
      const message = error instanceof Error ? error.message : 'request failed';
      failures.push(`${new URL(url).host}: ${status ? `HTTP ${status}` : message}`);
    }
  }
  throw new Error(`直连及三个加速地址均失败 / All GitHub sources failed: ${failures.join('; ')}`);
};
