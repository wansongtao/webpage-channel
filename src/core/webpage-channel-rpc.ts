import type {
  RequestParams,
  RequestPayload,
  ResponsePayload,
  ResponseResult,
  RpcFn,
  RpcOptions
} from 'src/types';

import WebpageChannel from './webpage-channel';

export default class WebpageChannelRpc<T extends Record<string, RpcFn>> {
  private channel: WebpageChannel<any>;
  private options: RpcOptions = {
    timeout: 5000,
    generateUniqueId: this.generateLocalId
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

  private generateLocalId(): string {
    return `${Date.now()}-${Math.random().toString(36)}-${Math.random().toString(36).slice(2)}`;
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
    timeout = this.options.timeout,
    generateUniqueId = this.options.generateUniqueId
  ): Promise<[Error] | [undefined, ResponsePayload<T[K]>]> {
    const id = `req:${String(event)}:${generateUniqueId()}`;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.channel.off(this.getResponseEventKey(id));
        resolve([new Error(`Request timed out for event: ${String(event)}`)]);
      }, timeout);

      this.channel.once(
        this.getResponseEventKey(id),
        ({ result, error }: ResponseResult<T[K]>) => {
          timer && clearTimeout(timer);

          if (result) {
            resolve([undefined, result]);
          } else {
            resolve([error!]);
          }
        }
      );

      const key = this.getRequestEventKey(event);
      const res = this.channel.emit(key, { id, payload });
      if (!res) {
        timer && clearTimeout(timer);
        this.channel.off(this.getResponseEventKey(id));
        resolve([new Error(`Emit failed for event: ${String(event)}`)]);
        return;
      }
    });
  }

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
    this.channel.clear()
  }
}

// example
type RpcEvents = {
  getUser: (p: { id: number }) => { name: string };
  fetchUser: (p: { id: number }) => Promise<{ name: string }>;
};

const rpc = new WebpageChannelRpc<RpcEvents>(new WebpageChannel('test'));

rpc.request('getUser', { id: 1 }).then(([error, res]) => {
  console.log('receive: ', error, res?.name);
});
rpc.response('getUser', (payload) => {
  return { name: payload.id + '' };
});

rpc.request('fetchUser', { id: 2 }).then(([err, res]) => {
  console.log('receive: ', err, res?.name);
});
rpc.response('fetchUser', async (payload) => {
  return { name: payload.id + '' };
});
