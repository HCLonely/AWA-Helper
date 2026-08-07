const getManagerListenHost = (local: boolean | undefined, containerRuntime: boolean): string => {
  if (local && !containerRuntime) return '127.0.0.1';
  return '0.0.0.0';
};

export { getManagerListenHost };
