type EventMap = Record<string, (args: any) => void>;
const ORIGINAL_LISTENER = Symbol('originalListener');

type WrappedListener<F extends (...args: any[]) => any> = F & {
  [ORIGINAL_LISTENER]?: F;
};

export class EventBus<T extends EventMap> {
  private listeners: Partial<{ [K in keyof T]: T[K][] }> = {};
  private onListenerError?: (error: Error) => void;

  /**
   * Creates a new EventBus instance.
   * @param options - Optional configuration.
   * @param options.onListenerError - Callback invoked when a listener throws an error during event dispatch.
   */
  constructor(options?: { onListenerError?: (error: Error) => void }) {
    this.onListenerError = options?.onListenerError;
  }

  /**
   * Registers a persistent listener for the specified event.
   * @param event - The event name to listen for.
   * @param callback - The callback function invoked when the event is emitted.
   * @returns A function that removes this listener when called.
   */
  on<K extends keyof T>(event: K, callback: T[K]): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }

    this.listeners[event]!.push(callback);
    return () => this.off(event, callback);
  }

  /**
   * Registers a one-time listener for the specified event.
   * The listener is automatically removed after being invoked once.
   * @param event - The event name to listen for.
   * @param callback - The callback function invoked when the event is emitted.
   * @returns A function that removes this listener when called.
   */
  once<K extends keyof T>(event: K, callback: T[K]): () => void {
    const onceCallback = ((args: Parameters<T[K]>[0]) => {
      this.off(event, onceCallback as T[K]);
      callback(args);
    }) as WrappedListener<T[K]>;

    onceCallback[ORIGINAL_LISTENER] = callback;
    return this.on(event, onceCallback as T[K]);
  }

  /**
   * Emits an event, invoking all registered listeners for it.
   * If a listener throws, the error is caught and forwarded to `onListenerError` if provided.
   * @param event - The event name to emit.
   * @param args - The argument to pass to each listener (omitted if the listener takes no arguments).
   */
  emit<K extends keyof T>(
    event: K,
    ...[args]: Parameters<T[K]>[0] extends undefined
      ? []
      : [Parameters<T[K]>[0]]
  ) {
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

  /**
   * Removes a listener for the specified event.
   * If no listener is provided, all listeners for the event are removed.
   * Also correctly removes listeners registered via `once`.
   * @param event - The event name whose listener(s) should be removed.
   * @param listener - The specific listener to remove. Omit to remove all listeners for the event.
   */
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
    if (fns.length === 0) {
      delete this.listeners[event];
    }
  }

  /**
   * Removes all registered listeners for all events.
   */
  clear() {
    this.listeners = {};
  }
}
