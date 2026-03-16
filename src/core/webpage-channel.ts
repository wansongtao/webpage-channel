import type {
  IChannelData,
  IErrorEvent,
  IMessageErrorEvent,
  IWebpageChannelAdapter
} from '../types';

import BroadcastChannelAdapter from './broadcast-channel-adapter';

export default class WebpageChannel<
  T extends Record<string, (args: any) => void>
> {
  private adapter: IWebpageChannelAdapter | null;
  private listeners: Record<keyof T, ((args: any) => void)[]> = {} as any;
  private channelName: string;

  onError?: IErrorEvent;
  onMessageError?: IMessageErrorEvent;
  serializeMessage: (
    data: IChannelData<Parameters<T[keyof T]>, keyof T>
  ) => string;
  deserializeMessage: (
    data: string
  ) => IChannelData<Parameters<T[keyof T]>, keyof T>;

  constructor(
    channelName: string,
    options?: {
      onError?: IErrorEvent;
      onMessageError?: IMessageErrorEvent;
      serializeMessage?: (
        data: IChannelData<Parameters<T[keyof T]>, keyof T>
      ) => string;
      deserializeMessage?: (
        data: string
      ) => IChannelData<Parameters<T[keyof T]>, keyof T>;
    },
    adapter?: IWebpageChannelAdapter
  ) {
    this.channelName = channelName;
    this.adapter = adapter ?? new BroadcastChannelAdapter(channelName);
    this.onMessage();

    this.onError = options?.onError;
    this.onMessageError = options?.onMessageError;
    this.adapter.onMessageError((e) => {
      if (!this.onMessageError) return;

      this.onMessageError(e);
    });

    this.serializeMessage = options?.serializeMessage ?? JSON.stringify;
    this.deserializeMessage = options?.deserializeMessage ?? JSON.parse;
  }

  on<K extends keyof T>(event: K, callback: T[K]) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit<K extends keyof T>(event: K, args: Parameters<T[K]>[0]) {
    const channelName = this.channelName;
    const msg: IChannelData<Parameters<T[K]>, K> = {
      channelName,
      event,
      data: args
    };

    return this.postMessage(msg);
  }

  off<K extends keyof T>(event: K, listener?: T[K]) {
    if (!listener) {
      delete this.listeners[event];
      return;
    }

    const fns = this.listeners[event];
    if (!fns || !fns.length) {
      return;
    }

    const idx = fns.indexOf(listener);
    if (idx !== -1) {
      fns.splice(idx, 1);
    }
  }

  clear() {
    this.listeners = {} as any;
  }

  close() {
    this.clear();
    this.adapter?.close();
    this.adapter = null;
  }

  private postMessage(data: IChannelData<Parameters<T[keyof T]>, keyof T>) {
    if (!this.adapter) {
      const error = new Error('Adapter is not initialized');
      this.onError && this.onError(error);
      return false;
    }

    try {
      const message = this.serializeMessage(data);
      this.adapter?.postMessage(message);
      return true;
    } catch (e: any) {
      if (!(e instanceof Error)) {
        e = new Error(e);
      }

      this.onError && this.onError(e);
      return false;
    }
  }

  private onMessage() {
    this.adapter?.onMessage((message) => {
      let res: IChannelData<Parameters<T[keyof T]>, keyof T>;
      try {
        res = this.deserializeMessage(message);
      } catch (e: any) {
        if (!(e instanceof Error)) {
          e = new Error(e);
        }

        this.onError && this.onError(e);
        return;
      }

      const key = res.event;
      if (
        res.channelName !== this.channelName ||
        key === undefined ||
        key === null
      ) {
        return;
      }

      const callbacks = this.listeners[key];
      if (!callbacks || !callbacks.length) {
        return;
      }

      callbacks.forEach((callback) => {
        try {
          callback(res.data);
        } catch (e: any) {
          if (!(e instanceof Error)) {
            e = new Error(e);
          }
          this.onError && this.onError(e);
        }
      });
    });
  }
}
