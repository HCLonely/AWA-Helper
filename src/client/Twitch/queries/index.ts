/**
 * @file src/client/Twitch/queries/index.ts
 * @description 构建 Twitch 频道与扩展查询使用的持久化 GraphQL 请求载荷。
 */
export const linkedExtensionsQuery = JSON.stringify([{
  operationName: 'Settings_Connections_ExtensionConnectionsList',
  variables: {},
  extensions: {
    persistedQuery: {
      version: 1,
      sha256Hash: '7de55e735212a90752672f9baf33016fe1c7f2b4bfdad94a6d8031a1633deaeb'
    }
  }
}]);

/**
 * 构建频道信息查询。
 * @param channelLogin - 用于定位目标对象的名称，类型为 `string`。
 * @returns `string`，channelInfoQuery 获取或生成的文本内容。
 */
export const channelInfoQuery = (channelLogin: string): string => JSON.stringify([{
  operationName: 'ActiveWatchParty',
  variables: {
    channelLogin
  },
  extensions: {
    persistedQuery: {
      version: 1,
      sha256Hash: '4a8156c97b19e3a36e081cf6d6ddb5dbf9f9b02ae60e4d2ff26ed70aebc80a30'
    }
  }
}]);

/**
 * 构建扩展信息查询。
 * @param channelID - 目标资源的唯一标识，类型为 `string`。
 * @returns `string`，extensionInfoQuery 获取或生成的文本内容。
 */
export const extensionInfoQuery = (channelID: string): string => JSON.stringify([{
  operationName: 'ExtensionsForChannel',
  variables: {
    channelID
  },
  extensions: {
    persistedQuery: {
      version: 1,
      sha256Hash: 'd52085e5b03d1fc3534aa49de8f5128b2ee0f4e700f79bf3875dcb1c90947ac3'
    }
  }
}]);
