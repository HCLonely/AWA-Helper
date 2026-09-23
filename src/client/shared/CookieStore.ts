/**
 * @file src/client/shared/CookieStore.ts
 * @description 定义远程平台客户端读写和序列化 Cookie 所需的存储接口。
 */
export interface CookieStore {
    /**
     * 获取数据。
     * @param name - 用于定位目标对象的名称，类型为 `string`。
     * @returns `string | null`，get 获取到的数据。
     */
get(name: string): string | null;
/** 重新验证身份前移除过期的会话 Cookie。 */
remove(name: string): CookieStore;
    /**
     * 序列化为字符串。
     * @returns `string`，stringify 获取或生成的文本内容。
     */
stringify(): string;
    /**
     * 更新状态。
     * @param setCookie - 用于身份验证和维持会话的 Cookie，类型为 `string[]`。
     * @returns `CookieStore`，update 操作完成后的结果。
     */
update(setCookie: string[]): CookieStore;
}
