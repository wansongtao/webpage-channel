import type {
  RequestParams,
  RequestPayload,
  ResponsePayload,
  ResponseResult,
  RpcFn,
  RpcOptions
} from 'src/types';

import WebpageChannel from './webpage-channel';
import { generateLocalId } from 'src/utils';

export default class WebpageChannelRpc<T extends Record<string, RpcFn>> {
  private channel: WebpageChannel<any>;
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

  request<K extends keyof T>(
    event: K,
    payload: RequestPayload<T[K]>,
    timeout?: number
  ): Promise<[Error] | [undefined, ResponsePayload<T[K]>]> {
    const { timeout: defaultTimeout, generateUniqueId } = this.options;
    const resolvedTimeout = timeout ?? defaultTimeout;
    const id = `req:${String(event)}:${generateUniqueId()}`;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.channel.off(this.getResponseEventKey(id));
        resolve([new Error(`Request timed out for event: ${String(event)}`)]);
      }, resolvedTimeout);

      this.channel.once(
        this.getResponseEventKey(id),
        ({ result, error }: ResponseResult<T[K]>) => {
          clearTimeout(timer);

          if (error) {
            resolve([error]);
          } else {
            resolve([undefined, result!]);
          }
        }
      );

      const key = this.getRequestEventKey(event);
      const res = this.channel.emit(key, { id, payload });
      if (!res) {
        clearTimeout(timer);
        this.channel.off(this.getResponseEventKey(id));
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
        const error = e instanceof Error ? e : new Error(String(e));
        this.channel.emit(this.getResponseEventKey(id), { error });
      }
    });
  }

  off<K extends keyof T>(event: K): void {
    const key = this.getRequestEventKey(event);
    this.channel.off(key);
  }

  clear(): void {
    this.channel.clear();
  }

  close(): void {
    this.channel.close();
  }
}
