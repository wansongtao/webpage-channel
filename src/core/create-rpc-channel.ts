import type { IWebpageChannelAdapter, RpcFn, RpcOptions } from 'src/types';

import WebpageChannel from './webpage-channel';
import WebpageChannelRpc from './webpage-channel-rpc';

type ChannelOptions = ConstructorParameters<typeof WebpageChannel>[1];

export function createRpcChannel<T extends Record<string, RpcFn>>(
  channelName: string,
  options?: {
    channel?: ChannelOptions;
    rpc?: Partial<RpcOptions>;
  },
  adapter?: IWebpageChannelAdapter
): WebpageChannelRpc<T> {
  const channel = new WebpageChannel(channelName, options?.channel, adapter);
  return new WebpageChannelRpc<T>(channel, options?.rpc);
}
