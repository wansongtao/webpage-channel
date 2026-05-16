export interface IWebpageChannelAdapter {
  postMessage(message: string): void;
  onMessage(callback: (message: string) => void): void;
  onMessageError(callback: (e: MessageEvent) => void): void;
  close(): void;
}

export interface IChannelData<T = any, C = string> {
  channelName: string
  event?: C;
  data?: T;
}
export type IErrorEvent = (e: Error) => void;
export type IMessageErrorEvent = (e: MessageEvent) => void;

export type RpcFn = (arg: any) => any;
export type RequestPayload<F extends RpcFn> = Parameters<F>[0];
export type ResponsePayload<F extends RpcFn> = Awaited<ReturnType<F>>;
export type RequestParams<F extends RpcFn> = {
  id: string;
  payload: RequestPayload<F>;
};
export type ResponseResult<F extends RpcFn> = {
  result?: ResponsePayload<F>;
  error?: Error;
};
export interface RpcOptions {
  timeout: number;
  generateUniqueId: () => string;
}
