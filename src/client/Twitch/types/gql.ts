/**
 * @file src/client/Twitch/types/gql.ts
 * @description 定义 Twitch GraphQL 请求使用的通用响应信封。
 */
export interface TwitchGqlEnvelope<T> {
  data?: T
}
