/** Describes a transport or protocol failure at a remote platform boundary. */
export class PlatformError extends Error {
  constructor(
    readonly platform: 'awa' | 'twitch' | 'asf',
    readonly operation: string,
    message: string,
    readonly retryable = false,
    readonly statusCode?: number,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'PlatformError';
  }
}
