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
import { generateLocalId } from 'src/utils';

export default class WebpageChannelRpc<T extends Record<string, RpcFn>> {
  private channel: WebpageChannel<any>;
  private pendingRequests = new Map<string, PendingRequest>();
  private registeredHandlerEvents = new Set<PropertyKey>();
  private registeredNotifyEvents = new Set<PropertyKey>();
  private options: RpcOptions = {
    timeout: 5000,
    generateUniqueId: generateLocalId
  };

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

  request<K extends keyof T>(
    event: K,
    payload: RequestPayload<T[K]>,
    timeout?: number
  ): Promise<[Error] | [undefined, ResponsePayload<T[K]>]> {
    const { timeout: defaultTimeout, generateUniqueId } = this.options;
    const resolvedTimeout = timeout ?? defaultTimeout;
    const id = `req:${String(event)}:${generateUniqueId()}`;

    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        clearTimeout(timer);
        this.channel.off(this.getResponseEventKey(id));
        this.pendingRequests.delete(id);
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
   * If a handler is already registered for the same event, it will be replaced silently.
   */
  response<K extends keyof T>(
    event: K,
    handler: (
      payload: RequestPayload<T[K]>
    ) => ResponsePayload<T[K]> | Promise<ResponsePayload<T[K]>>
  ): void {
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
  }

  notify<K extends keyof T>(event: K, payload: RequestPayload<T[K]>): boolean {
    const key = this.getNotifyEventKey(event);
    return this.channel.emit(key, payload);
  }

  onNotify<K extends keyof T>(
    event: K,
    handler: (payload: RequestPayload<T[K]>) => void
  ): void {
    this.offNotify(event);
    const key = this.getNotifyEventKey(event);
    this.channel.on(key, handler);
    this.registeredNotifyEvents.add(event);
  }

  offNotify<K extends keyof T>(event: K): void {
    const key = this.getNotifyEventKey(event);
    this.channel.off(key);
    this.registeredNotifyEvents.delete(event);
  }

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

  close(): void {
    this.channel.close();
  }
}
