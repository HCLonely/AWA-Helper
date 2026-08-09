/**
 * @file src/client/shared/Result.ts
 * @description 定义显式区分成功值与失败值的领域操作结果类型。
 */
export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

/**
 * 处理 success 相关逻辑。
 * @param data - 当前请求或操作使用的数据内容，类型为 `T`。
 * @returns `Result<T, never>`，包含成功值且不携带错误的结果对象。
 */
export const success = <T>(data: T): Result<T, never> => ({ ok: true, data });
/**
 * 处理 failure 相关逻辑。
 * @param error - 需要处理或转换的异常对象，类型为 `E`。
 * @returns `Result<never, E>`，包含错误值且不携带成功数据的结果对象。
 */
export const failure = <E>(error: E): Result<never, E> => ({ ok: false, error });
