/** Injectable HTTP boundary used by platform contexts and API tests. */
import type { AxiosResponse } from 'axios';

export interface HttpTransport {
  request<T = unknown>(config: myAxiosConfig): Promise<AxiosResponse<T>>;
}

export const createHttpTransport = (
  request: (config: myAxiosConfig) => Promise<AxiosResponse>
): HttpTransport => ({
  request: <T = unknown>(config: myAxiosConfig) => request(config) as Promise<AxiosResponse<T>>
});
