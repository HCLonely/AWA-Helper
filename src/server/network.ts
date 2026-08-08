/** @description Selects the unified server bind address for local and container modes. */
const getManagerListenHost = (local: boolean | undefined, containerRuntime: boolean): string => {
  if (local && !containerRuntime) return '127.0.0.1';
  return '0.0.0.0';
};

export { getManagerListenHost };
