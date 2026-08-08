/** Typed ASF IPC error. */
import { PlatformError } from '../shared';

export class ASFError extends PlatformError {
  constructor(operation: string, message: string, retryable = false, statusCode?: number, options?: ErrorOptions) {
    super('asf', operation, message, retryable, statusCode, options);
    this.name = 'ASFError';
  }
}
