import type { IWebpageChannelAdapter } from '../types';
import { isSupportBroadcastChannel } from '../utils';

export default class BroadcastChannelAdapter implements IWebpageChannelAdapter {
  private channel: BroadcastChannel;

  constructor(channelName: string) {
    if (!isSupportBroadcastChannel()) {
      throw new Error('BroadcastChannel is not supported in this environment.');
    }
    this.channel = new BroadcastChannel(channelName);
  }

  postMessage(message: string) {
    this.channel.postMessage(message);
  }

  onMessage(callback: (message: string) => void) {
    this.channel.onmessage = (e) => {
      callback(e.data);
    };
  }

  onMessageError(callback: (e: MessageEvent) => void) {
    this.channel.onmessageerror = callback;
  }

  close() {
    this.channel.close();
  }
}
