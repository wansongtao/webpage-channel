export const isSupportBroadcastChannel = (): boolean => {
  return typeof BroadcastChannel !== 'undefined';
};

export const isSupportLocalStorage = (): boolean => {
  return typeof localStorage !== 'undefined';
};
