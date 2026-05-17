import type { IWebpageChannelAdapter } from '../types';

import { generateLocalId, isSupportLocalStorage } from '../utils';

interface IStorageMessage {
  message: string;
  timestamp: string;
}

export default class LocalStorageAdapter implements IWebpageChannelAdapter {
  private storageKey: string;
  private storageHandler: ((e: StorageEvent) => void) | null = null;

  constructor(channelName: string) {
    if (!isSupportLocalStorage()) {
      throw new Error('localStorage is not supported in this environment.');
    }
    this.storageKey = `__webpage-channel:${channelName}`;
  }

  postMessage(message: string) {
    // timestamp ensures the serialized value always differs between calls,
    // so the 'storage' event fires even when the message content is identical.
    const payload: IStorageMessage = { message, timestamp: generateLocalId() };
    localStorage.setItem(this.storageKey, JSON.stringify(payload));
  }

  onMessage(callback: (message: string) => void) {
    if (this.storageHandler) {
      window.removeEventListener('storage', this.storageHandler);
    }

    this.storageHandler = (e: StorageEvent) => {
      if (e.key !== this.storageKey || e.newValue === null) return;

      try {
        const { message } = JSON.parse(e.newValue) as IStorageMessage;
        callback(message);
      } catch {
        // ignore malformed storage entries
      }
    };

    window.addEventListener('storage', this.storageHandler);
  }

  onMessageError(_callback: (e: MessageEvent) => void) {
    // localStorage storage events do not produce MessageError, no-op
  }

  close() {
    if (this.storageHandler) {
      window.removeEventListener('storage', this.storageHandler);
      this.storageHandler = null;
    }

    localStorage.removeItem(this.storageKey);
  }
}
