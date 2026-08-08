/** Typed Twitch error used by Twitch GraphQL APIs. */
import { PlatformError } from '../shared';

export class TwitchError extends PlatformError {
  constructor(operation: string, message: string, retryable = false, statusCode?: number, options?: ErrorOptions) {
    super('twitch', operation, message, retryable, statusCode, options);
    this.name = 'TwitchError';
  }
}
