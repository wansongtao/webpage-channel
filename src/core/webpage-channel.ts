import type {
  IChannelData,
  IErrorEvent,
  IMessageErrorEvent,
  IWebpageChannelAdapter
} from '../types';

import BroadcastChannelAdapter from './broadcast-channel-adapter';
import EventBus from './event-bus';

export default class WebpageChannel<
  T extends Record<string, (args: any) => void>
> {
  private channelName: string;
  private eventBus: EventBus<T>;
  private adapter: IWebpageChannelAdapter | null;

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
    this.eventBus = new EventBus<T>({
      onListenerError: (error) => {
        this.onError?.(error);
      }
    });
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
    this.eventBus.on(event, callback);
  }

  once<K extends keyof T>(event: K, callback: T[K]) {
    this.eventBus.once(event, callback);
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
    this.eventBus.off(event, listener);
  }

  clear() {
    this.eventBus.clear();
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

      this.eventBus.emit(key, res.data);
    });
  }
}
