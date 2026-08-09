/** Central adapter for creating the repository's supported proxy agents. */
import { formatProxy } from '../../tools';

export const createProxyAgent = (configuration: proxy): myAxiosConfig['httpsAgent'] => formatProxy(configuration);
