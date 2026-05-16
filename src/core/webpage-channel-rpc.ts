import type {
  PendingRequest,
  RequestParams,
  RequestPayload,
  ResponsePayload,
  ResponseResult,
  RpcFn,
  RpcOptions,
  SerializedError
} from 'src/types';

import WebpageChannel from './webpage-channel';
import { generateLocalId, toAbortError } from 'src/utils';

/**
 * RPC layer built on top of {@link WebpageChannel}.
 *
 * Provides request/response, one-way notification, and lifecycle management
 * over any `WebpageChannel` instance.
 *
 * @typeParam T - A map of RPC method names to their function signatures.
 *   Each function's parameter type becomes the request payload, and its
 *   return type becomes the response payload.
 *
 * @example
 * ```ts
 * type Api = {
 *   add: (payload: { a: number; b: number }) => number;
 *   log: (payload: { text: string }) => void;
 * };
 *
 * const rpcA = new WebpageChannelRpc<Api>(channelA);
 * const rpcB = new WebpageChannelRpc<Api>(channelB);
 *
 * rpcA.response('add', ({ a, b }) => a + b);
 *
 * const [err, result] = await rpcB.request('add', { a: 1, b: 2 });
 * ```
 */
export default class WebpageChannelRpc<T extends Record<string, RpcFn>> {
  private channel: WebpageChannel<any>;
  private pendingRequests = new Map<string, PendingRequest>();
  private registeredHandlerEvents = new Set<PropertyKey>();
  private registeredNotifyEvents = new Set<PropertyKey>();
  private options: RpcOptions = {
    timeout: 5000,
    generateUniqueId: generateLocalId
  };

  /**
   * @param channel - The underlying `WebpageChannel` used for transport.
   * @param options - Optional overrides for default timeout and ID generation.
   */
  constructor(channel: WebpageChannel<any>, options?: Partial<RpcOptions>) {
    this.channel = channel;
    if (options?.timeout !== undefined) {
      this.options.timeout = options.timeout;
    }
    if (options?.generateUniqueId) {
      this.options.generateUniqueId = options.generateUniqueId;
    }
  }

  private getRequestEventKey<K extends keyof T>(event: K): string {
    return `@request:_${String(event)}_`;
  }

  private getResponseEventKey(id: string): string {
    return `@response:${id}`;
  }

  private getNotifyEventKey<K extends keyof T>(event: K): string {
    return `@notify:_${String(event)}_`;
  }

  /**
   * Send a request and wait for the remote handler's response.
   *
   * The returned promise always resolves (never rejects) as a discriminated
   * tuple:
   * - `[Error]` — request failed (timeout, emit failure, handler error, or abort)
   * - `[undefined, result]` — request succeeded
   *
   * @param event - The RPC method name to call.
   * @param payload - Argument passed to the remote handler.
   * @param timeout - Per-request timeout in ms. Defaults to the instance-level timeout.
   * @param signal - Optional `AbortSignal` to cancel the request externally.
   * @returns A promise that resolves to `[Error]` or `[undefined, result]`.
   */
  request<K extends keyof T>(
    event: K,
    payload: RequestPayload<T[K]>,
    timeout?: number,
    signal?: AbortSignal
  ): Promise<[Error] | [undefined, ResponsePayload<T[K]>]> {
    const { timeout: defaultTimeout, generateUniqueId } = this.options;
    const resolvedTimeout = timeout ?? defaultTimeout;
    const id = `req:${String(event)}:${generateUniqueId()}`;

    return new Promise((resolve) => {
      if (signal?.aborted) {
        resolve([toAbortError(signal.reason)]);
        return;
      }

      let timer: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        clearTimeout(timer);
        this.channel.off(this.getResponseEventKey(id));
        this.pendingRequests.delete(id);
        signal?.removeEventListener('abort', onAbort);
      };

      const onAbort = () => {
        cleanup();
        resolve([toAbortError(signal!.reason)]);
      };

      this.pendingRequests.set(id, {
        event,
        cancel: (err: Error) => {
          cleanup();
          resolve([err]);
        }
      });

      timer = setTimeout(() => {
        cleanup();
        resolve([new Error(`Request timed out for event: ${String(event)}`)]);
      }, resolvedTimeout);

      signal?.addEventListener('abort', onAbort, { once: true });

      this.channel.once(
        this.getResponseEventKey(id),
        ({ result, error }: ResponseResult<T[K]>) => {
          cleanup();

          if (error) {
            const err = new Error(error.message);
            err.name = error.name;
            resolve([err]);
          } else {
            resolve([undefined, result!]);
          }
        }
      );

      const key = this.getRequestEventKey(event);
      const res = this.channel.emit(key, { id, payload });
      if (!res) {
        cleanup();
        resolve([new Error(`Emit failed for event: ${String(event)}`)]);
      }
    });
  }

  /**
   * Register a handler for the given RPC event.
   *
   * If a handler is already registered for the same event it will be replaced
   * silently. Any pending requests targeting the replaced handler are cancelled.
   *
   * @param event - The RPC method name to handle.
   * @param handler - Synchronous or async function that processes the request
   *   and returns the response. Thrown errors are serialised and forwarded to
   *   the caller as an `[Error]` tuple.
   * @returns A function that unregisters this handler when called.
   */
  response<K extends keyof T>(
    event: K,
    handler: (
      payload: RequestPayload<T[K]>
    ) => ResponsePayload<T[K]> | Promise<ResponsePayload<T[K]>>
  ): () => void {
    this.off(event);

    const key = this.getRequestEventKey(event);
    this.channel.on(key, async ({ id, payload }: RequestParams<T[K]>) => {
      try {
        const result = await handler(payload);
        this.channel.emit(this.getResponseEventKey(id), { result });
      } catch (e: unknown) {
        const raw = e instanceof Error ? e : new Error(String(e));
        const error: SerializedError = { message: raw.message, name: raw.name };
        this.channel.emit(this.getResponseEventKey(id), { error });
      }
    });
    this.registeredHandlerEvents.add(event);

    return () => this.off(event);
  }

  /**
   * Send a one-way notification — fire-and-forget, no response is expected.
   *
   * @param event - The notification name.
   * @param payload - Data to deliver to the remote listener.
   * @returns `true` if the message was emitted successfully, `false` otherwise
   *   (e.g. the channel has been closed).
   */
  notify<K extends keyof T>(event: K, payload: RequestPayload<T[K]>): boolean {
    const key = this.getNotifyEventKey(event);
    return this.channel.emit(key, payload);
  }

  /**
   * Register a listener for incoming one-way notifications.
   *
   * If a listener is already registered for the same event it will be replaced
   * silently.
   *
   * @param event - The notification name to listen for.
   * @param handler - Callback invoked with the notification payload.
   * @returns A function that unregisters this listener when called.
   */
  onNotify<K extends keyof T>(
    event: K,
    handler: (payload: RequestPayload<T[K]>) => void
  ): () => void {
    this.offNotify(event);
    const key = this.getNotifyEventKey(event);
    this.channel.on(key, handler);
    this.registeredNotifyEvents.add(event);

    return () => this.offNotify(event);
  }

  /**
   * Unregister the notification listener for the given event.
   *
   * @param event - The notification name to stop listening for.
   */
  offNotify<K extends keyof T>(event: K): void {
    const key = this.getNotifyEventKey(event);
    this.channel.off(key);
    this.registeredNotifyEvents.delete(event);
  }

  /**
   * Unregister the response handler for the given event and cancel any
   * outgoing requests that are still waiting for a response to that event.
   *
   * @param event - The RPC method name to deregister.
   */
  off<K extends keyof T>(event: K): void {
    const pending = [...this.pendingRequests.entries()].filter(
      ([, { event: e }]) => e === event
    );
    for (const [, { cancel }] of pending) {
      cancel(
        new Error(
          `Request cancelled: handler for "${String(event)}" was removed`
        )
      );
    }

    const key = this.getRequestEventKey(event);
    this.channel.off(key);
    this.registeredHandlerEvents.delete(event);
  }

  /**
   * Cancel all pending requests and remove all response handlers and
   * notification listeners.
   *
   * Does **not** close the underlying channel — use {@link close} for that.
   */
  clear(): void {
    const pending = [...this.pendingRequests.values()];
    for (const { cancel } of pending) {
      cancel(new Error('RPC handlers were cleared'));
    }

    for (const event of this.registeredHandlerEvents) {
      const key = this.getRequestEventKey(event as keyof T);
      this.channel.off(key);
    }
    this.registeredHandlerEvents.clear();

    for (const event of this.registeredNotifyEvents) {
      const key = this.getNotifyEventKey(event as keyof T);
      this.channel.off(key);
    }
    this.registeredNotifyEvents.clear();
  }

  /**
   * Cancel all pending requests, remove all handlers, and close the
   * underlying channel.
   *
   * After this call the instance must not be used.
   */
  close(): void {
    this.clear();
    this.channel.close();
  }
}
