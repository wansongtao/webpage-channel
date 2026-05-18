import type { IWebpageChannelAdapter, RpcFn, RpcOptions } from 'src/types';

import WebpageChannel from './webpage-channel';
import WebpageChannelRpc from './webpage-channel-rpc';

type ChannelOptions = ConstructorParameters<typeof WebpageChannel>[1];

/**
 * Creates a `WebpageChannelRpc` instance backed by a `WebpageChannel`.
 * This is a convenience factory that wires up the channel and RPC layer in one call.
 * @param channelName - A unique name identifying this channel.
 * @param options - Optional configuration.
 * @param options.channel - Options forwarded to the underlying `WebpageChannel` (e.g. error handlers, serializers).
 * @param options.rpc - Partial RPC options: `timeout` (ms before a pending call rejects) and `generateUniqueId` (custom request ID generator).
 * @param adapter - A custom channel adapter. If omitted, one is auto-detected from the environment.
 * @returns A fully initialized `WebpageChannelRpc` instance.
 */
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
