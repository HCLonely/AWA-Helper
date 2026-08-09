/**
 * @file src/server/network.ts
 * @description 根据本地模式或容器部署模式选择 Manager 服务器监听地址。
 */
/**
 * 获取 get Manager Listen Host 相关数据。
 * @param local - 用于决定服务是否仅监听本地地址，类型为 `boolean | undefined`。
 * @param containerRuntime - 当前任务使用的运行时实例，类型为 `boolean`。
 * @returns `string`，getManagerListenHost 获取或生成的文本内容。
 */
const getManagerListenHost = (local: boolean | undefined, containerRuntime: boolean): string => {
  if (local && !containerRuntime) {
    return '127.0.0.1';
  }
  return '0.0.0.0';
};

export { getManagerListenHost };
