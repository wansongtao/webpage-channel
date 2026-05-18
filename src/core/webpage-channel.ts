import type {
  IChannelData,
  IErrorEvent,
  IMessageErrorEvent,
  IWebpageChannelAdapter
} from '../types';

import { BroadcastChannelAdapter } from './broadcast-channel-adapter';
import { LocalStorageAdapter } from './localstorage-adapter';
import { EventBus } from './event-bus';
import { isSupportBroadcastChannel, isSupportLocalStorage } from '../utils';

export class WebpageChannel<T extends Record<string, (args: any) => void>> {
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

  /**
   * Creates a new WebpageChannel instance.
   * Automatically selects BroadcastChannel or localStorage as the underlying adapter
   * based on browser support, unless a custom adapter is provided.
   * @param channelName - A unique name identifying this channel. Only messages sent on the same name will be received.
   * @param options - Optional configuration.
   * @param options.onError - Callback invoked when an internal error occurs (e.g. serialization failure or closed channel access).
   * @param options.onMessageError - Callback invoked when the underlying adapter encounters a message error.
   * @param options.serializeMessage - Custom serializer for outgoing messages. Defaults to `JSON.stringify`.
   * @param options.deserializeMessage - Custom deserializer for incoming messages. Defaults to `JSON.parse`.
   * @param adapter - A custom adapter to use instead of the auto-detected one.
   * @throws {Error} If neither BroadcastChannel nor localStorage is supported and no adapter is provided.
   */
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
    if (!adapter) {
      if (isSupportBroadcastChannel()) {
        this.adapter = new BroadcastChannelAdapter(channelName);
      } else if (isSupportLocalStorage()) {
        this.adapter = new LocalStorageAdapter(channelName);
      } else {
        throw new Error(
          'Neither BroadcastChannel nor localStorage is supported in this environment.'
        );
      }
    } else {
      this.adapter = adapter;
    }

    this.channelName = channelName;
    this.eventBus = new EventBus<T>({
      onListenerError: (error) => {
        this.onError?.(error);
      }
    });
    this.onError = options?.onError;
    this.onMessageError = options?.onMessageError;
    this.adapter.onMessageError((e) => {
      if (!this.onMessageError) return;

      this.onMessageError(e);
    });
    this.serializeMessage = options?.serializeMessage ?? JSON.stringify;
    this.deserializeMessage = options?.deserializeMessage ?? JSON.parse;

    this.onMessage();
  }

  /**
   * Registers a persistent listener for the specified event.
   * The listener remains active until manually removed via the returned unsubscribe function.
   * @param event - The event name to listen for.
   * @param callback - The callback function invoked when the event is received.
   * @returns A function that removes this listener when called.
   */
  on<K extends keyof T>(event: K, callback: T[K]): () => void {
    if (!this.adapter) {
      this.onError?.(new Error('Channel is closed'));
      return () => {};
    }
    return this.eventBus.on(event, callback);
  }

  /**
   * Registers a one-time listener for the specified event.
   * The listener is automatically removed after being invoked once.
   * @param event - The event name to listen for.
   * @param callback - The callback function invoked when the event is received.
   * @returns A function that removes this listener when called.
   */
  once<K extends keyof T>(event: K, callback: T[K]): () => void {
    if (!this.adapter) {
      this.onError?.(new Error('Channel is closed'));
      return () => {};
    }
    return this.eventBus.once(event, callback);
  }

  /**
   * Broadcasts an event with optional data to all other contexts listening on the same channel.
   * @param event - The event name to emit.
   * @param args - The argument to pass along with the event (omitted if the handler takes no arguments).
   * @returns `true` if the message was posted successfully, `false` otherwise.
   */
  emit<K extends keyof T>(
    event: K,
    ...[args]: Parameters<T[K]>[0] extends undefined
      ? []
      : [Parameters<T[K]>[0]]
  ) {
    const channelName = this.channelName;
    const msg: IChannelData<Parameters<T[K]>, K> = {
      channelName,
      event,
      data: args
    };

    return this.postMessage(msg);
  }

  /**
   * Removes a listener for the specified event.
   * If no listener is provided, all listeners for the event are removed.
   * @param event - The event name whose listener(s) should be removed.
   * @param listener - The specific listener to remove. Omit to remove all listeners for the event.
   */
  off<K extends keyof T>(event: K, listener?: T[K]) {
    this.eventBus.off(event, listener);
  }

  /**
   * Removes all event listeners registered on this channel.
   */
  clear() {
    this.eventBus.clear();
  }

  /**
   * Closes the channel by clearing all listeners and releasing the underlying adapter.
   * After calling this method, the channel can no longer send or receive messages.
   */
  close() {
    this.clear();
    this.adapter?.close();
    this.adapter = null;
  }

  /**
   * Serializes and sends a message through the underlying adapter.
   * @param data - The structured channel data to send.
   * @returns `true` if the message was posted successfully, `false` otherwise.
   */
  private postMessage(data: IChannelData<Parameters<T[keyof T]>, keyof T>) {
    if (!this.adapter) {
      const error = new Error('Adapter is not initialized');
      this.onError?.(error);
      return false;
    }

    try {
      const message = this.serializeMessage(data);
      this.adapter.postMessage(message);
      return true;
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.onError?.(error);
      return false;
    }
  }

  /**
   * Sets up the adapter's incoming message handler.
   * Deserializes each message and dispatches the corresponding event on the internal event bus.
   */
  private onMessage() {
    const callback = (message: string) => {
      let res: IChannelData<Parameters<T[keyof T]>, keyof T>;

      try {
        res = this.deserializeMessage(message);
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        this.onError?.(error);
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

      // @ts-ignore
      this.eventBus.emit(key, res.data);
    };

    this.adapter?.onMessage(callback);
  }

  /**
   * Indicates whether the channel has been closed.
   * Returns `true` if `close()` has been called and the adapter has been released.
   */
  get isClosed(): boolean {
    return this.adapter === null;
  }
}
