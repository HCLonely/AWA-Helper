/** Reads Hive and Nexus stream names from the AWA control center. */
import { AWAContext } from '../../AWAContext';
import type { AvailableStreams } from '../../../../types/achievement';
import { parseAvailableStreams } from '../../parsers';

export const getAvailableStreams = async (context: AWAContext): Promise<AvailableStreams> => {
  const options: myAxiosConfig = { url: `${context.baseURL}/control-center`, method: 'GET', headers: context.headers };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  const response = await context.request<string>(options);
  return parseAvailableStreams(response.data);
};
