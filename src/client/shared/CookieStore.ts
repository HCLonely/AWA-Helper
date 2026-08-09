/**
 * @file src/client/shared/CookieStore.ts
 * @description 定义远程平台客户端读写和序列化 Cookie 所需的存储接口。
 */
export interface CookieStore {
    /**
     * 获取 get 相关数据。
     * @param name - 用于定位目标对象的名称，类型为 `string`。
     * @returns `string | null`，get 获取到的数据。
     */
get(name: string): string | null;
    /**
     * 处理 stringify 相关逻辑。
     * @returns `string`，stringify 获取或生成的文本内容。
     */
stringify(): string;
    /**
     * 更新 update 相关数据。
     * @param setCookie - 用于身份验证和维持会话的 Cookie，类型为 `string[]`。
     * @returns `CookieStore`，update 操作完成后的结果。
     */
update(setCookie: string[]): CookieStore;
}
