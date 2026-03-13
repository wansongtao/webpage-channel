export interface IWebpageChannelAdapter {
  postMessage(message: string): void;
  onMessage(callback: (message: string) => void): void;
  onMessageError(callback: (e: MessageEvent) => void): void;
  close(): void;
}

export interface IChannelData<T = any, C = string> {
  event?: C;
  data?: T;
}
export type IErrorEvent = (e: Error) => void;
export type IMessageErrorEvent = (e: MessageEvent) => void;
