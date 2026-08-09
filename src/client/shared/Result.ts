/**
 * @file src/client/shared/Result.ts
 * @description 定义显式区分成功值与失败值的领域操作结果类型。
 */
export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

/** 远程操作的判别联合结果；`ok` 同时约束成功和失败状态。 */
export type ActionResult<SuccessState extends string, FailureState extends string = never> =
  | { ok: true; state: SuccessState; message?: string }
  | { ok: false; state: FailureState; message?: string };

/** 远程查找的判别联合结果；未找到时通过 `reason` 说明原因。 */
export type LookupResult<T, R extends string = 'not-found'> =
  | { found: true; value: T }
  | { found: false; reason: R };

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
