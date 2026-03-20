type EventMap = Record<string, (args: any) => void>;
const ORIGINAL_LISTENER = Symbol('originalListener');

type WrappedListener<F extends (...args: any[]) => any> = F & {
  [ORIGINAL_LISTENER]?: F;
};

export default class EventBus<T extends EventMap> {
  private listeners: Partial<{ [K in keyof T]: T[K][] }> = {};
  private onListenerError?: (error: Error) => void;

  constructor(options?: { onListenerError?: (error: Error) => void }) {
    this.onListenerError = options?.onListenerError;
  }

  on<K extends keyof T>(event: K, callback: T[K]) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }

    this.listeners[event]!.push(callback);
  }

  once<K extends keyof T>(event: K, callback: T[K]) {
    const onceCallback = ((args: Parameters<T[K]>[0]) => {
      this.off(event, onceCallback as T[K]);
      callback(args);
    }) as WrappedListener<T[K]>;

    onceCallback[ORIGINAL_LISTENER] = callback;
    this.on(event, onceCallback as T[K]);
  }

  emit<K extends keyof T>(event: K, args: Parameters<T[K]>[0]) {
    const callbacks = this.listeners[event];
    if (!callbacks?.length) {
      return;
    }

    [...callbacks].forEach((callback) => {
      try {
        callback(args);
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        this.onListenerError?.(error);
      }
    });
  }

  off<K extends keyof T>(event: K, listener?: T[K]) {
    if (!listener) {
      delete this.listeners[event];
      return;
    }

    const fns = this.listeners[event];
    if (!fns?.length) {
      return;
    }

    const idx = fns.findIndex((fn) => {
      const wrapped = fn as WrappedListener<T[K]>;
      return fn === listener || wrapped[ORIGINAL_LISTENER] === listener;
    });
    if (idx !== -1) {
      fns.splice(idx, 1);
    }
  }

  clear() {
    this.listeners = {};
  }
}
