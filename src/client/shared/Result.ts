/** Explicit success/failure result for domain outcomes that should not throw. */
export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

export const success = <T>(data: T): Result<T, never> => ({ ok: true, data });
export const failure = <E>(error: E): Result<never, E> => ({ ok: false, error });
