/** Transport-level error independent of any remote platform domain. */
export class HttpError extends Error {
  constructor(message: string, readonly statusCode?: number, readonly retryable = false, options?: ErrorOptions) {
    super(message, options);
    this.name = 'HttpError';
  }
}
