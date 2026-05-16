export const isSupportBroadcastChannel = (): boolean => {
  return typeof BroadcastChannel !== 'undefined';
};

export const isSupportLocalStorage = (): boolean => {
  return typeof localStorage !== 'undefined';
};

export const isSupportPostMessage = (): boolean => {
  return (
    typeof window !== 'undefined' && typeof window.postMessage === 'function'
  );
};

export const generateLocalId = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  // fallback for older environments
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

export const toAbortError = (reason: unknown): Error => {
  if (reason instanceof Error) return reason;
  return new Error(reason !== undefined ? String(reason) : 'Request aborted');
}
