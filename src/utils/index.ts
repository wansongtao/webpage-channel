export const isSupportBroadcastChannel = (): boolean => {
  return typeof BroadcastChannel !== 'undefined';
};

export const isSupportLocalStorage = (): boolean => {
  return typeof localStorage !== 'undefined';
};

export const isSupportPostMessage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.postMessage === 'function';
};
