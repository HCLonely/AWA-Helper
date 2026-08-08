/** Typed AWA error used by new API code. */
import { PlatformError } from '../shared';

export class AWAError extends PlatformError {
  constructor(operation: string, message: string, retryable = false, statusCode?: number, options?: ErrorOptions) {
    super('awa', operation, message, retryable, statusCode, options);
    this.name = 'AWAError';
  }
}
