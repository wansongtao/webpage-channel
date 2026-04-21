export const isSupportBroadcastChannel = (): boolean => {
  return typeof BroadcastChannel !== 'undefined';
};
