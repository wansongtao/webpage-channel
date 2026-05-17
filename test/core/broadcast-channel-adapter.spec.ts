import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as utils from '../../src/utils';
import BroadcastChannelAdapter from '../../src/core/broadcast-channel-adapter';

describe('BroadcastChannelAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw if BroadcastChannel is not supported', () => {
    vi.spyOn(utils, 'isSupportBroadcastChannel').mockReturnValue(false);

    expect(() => new BroadcastChannelAdapter('test-bc')).toThrow(
      'BroadcastChannel is not supported in this environment.'
    );
  });
  it('should create a BroadcastChannel with the given channel name', () => {
    const adapter = new BroadcastChannelAdapter('test-bc');
    // If constructor didn't throw, the channel was created
    expect(adapter).toBeDefined();
    adapter.close();
  });

  it('should call BroadcastChannel.postMessage with the message', () => {
    const adapter = new BroadcastChannelAdapter('test-bc');
    const postMessageSpy = vi.spyOn(BroadcastChannel.prototype, 'postMessage');

    adapter.postMessage('hello');

    expect(postMessageSpy).toHaveBeenCalledWith('hello');
    postMessageSpy.mockRestore();
    adapter.close();
  });

  it('should wire onmessage to invoke callback with e.data', () => {
    const adapter = new BroadcastChannelAdapter('test-bc-wire');
    const callback = vi.fn();

    adapter.onMessage(callback);

    // Access internal channel to simulate incoming message
    const internalChannel = (adapter as any).channel as BroadcastChannel;
    const event = new MessageEvent('message', { data: 'payload' });
    internalChannel.onmessage?.(event);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('payload');
    adapter.close();
  });

  it('should wire onmessageerror to invoke callback with the event', () => {
    const adapter = new BroadcastChannelAdapter('test-bc-err');
    const callback = vi.fn();

    adapter.onMessageError(callback);

    const internalChannel = (adapter as any).channel as BroadcastChannel;
    const event = new MessageEvent('messageerror');
    internalChannel.onmessageerror?.(event);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(event);
    adapter.close();
  });

  it('should close the internal BroadcastChannel', () => {
    const adapter = new BroadcastChannelAdapter('test-bc-close');
    const internalChannel = (adapter as any).channel as BroadcastChannel;
    const closeSpy = vi.spyOn(internalChannel, 'close');

    adapter.close();

    expect(closeSpy).toHaveBeenCalledTimes(1);
    closeSpy.mockRestore();
  });
});
