import { describe, expect, it, vi } from 'vitest';

import WebpageChannel from '../../src/core/webpage-channel';
import type { IWebpageChannelAdapter } from '../../src/types';

type TestEvents = {
  ping: (payload: { value: number }) => void;
  pong: (payload: { result: string }) => void;
};

class MockAdapter implements IWebpageChannelAdapter {
  private messageHandler: ((message: string) => void) | null = null;
  private messageErrorHandler: ((e: MessageEvent) => void) | null = null;

  postMessage = vi.fn();
  close = vi.fn();

  onMessage(callback: (message: string) => void): void {
    this.messageHandler = callback;
  }

  onMessageError(callback: (e: MessageEvent) => void): void {
    this.messageErrorHandler = callback;
  }

  emitIncoming(message: string) {
    this.messageHandler?.(message);
  }

  emitMessageError(event: MessageEvent) {
    this.messageErrorHandler?.(event);
  }
}

describe('WebpageChannel', () => {
  // --- constructor ---

  it('should use BroadcastChannelAdapter by default when no adapter is provided', () => {
    const channel = new WebpageChannel<TestEvents>('default-adapter-channel');
    // Should not throw, uses BroadcastChannelAdapter internally
    expect(channel).toBeDefined();
    channel.close();
  });

  it('should use custom serializeMessage and deserializeMessage', () => {
    const adapter = new MockAdapter();
    const serialize = vi.fn((data) => JSON.stringify(data));
    const deserialize = vi.fn((data) => JSON.parse(data));

    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      { serializeMessage: serialize, deserializeMessage: deserialize },
      adapter
    );

    channel.emit('ping', { value: 1 });
    expect(serialize).toHaveBeenCalledTimes(1);

    const listener = vi.fn();
    channel.on('ping', listener);
    adapter.emitIncoming(
      JSON.stringify({ channelName: 'test-channel', event: 'ping', data: { value: 2 } })
    );
    expect(deserialize).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ value: 2 });

    channel.close();
  });

  it('should not throw when onMessageError is not set and adapter emits messageerror', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    // Should not throw - the internal handler has `if (!this.onMessageError) return;`
    expect(() => adapter.emitMessageError(new MessageEvent('messageerror'))).not.toThrow();
    channel.close();
  });

  // --- emit ---

  it('should emit a message and return true on success', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    const ok = channel.emit('ping', { value: 42 });

    expect(ok).toBe(true);
    expect(adapter.postMessage).toHaveBeenCalledTimes(1);
    const sentMessage = JSON.parse(adapter.postMessage.mock.calls[0][0]);
    expect(sentMessage).toEqual({
      channelName: 'test-channel',
      event: 'ping',
      data: { value: 42 }
    });

    channel.close();
  });

  it('should return false and call onError when emit is called after close', () => {
    const onError = vi.fn();
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      { onError },
      adapter
    );

    channel.close();
    const ok = channel.emit('ping', { value: 1 });

    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('Adapter is not initialized');
  });

  it('should return false and not throw when emit fails and no onError is set', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    channel.close();
    const ok = channel.emit('ping', { value: 1 });

    expect(ok).toBe(false);
  });

  it('should return false and call onError when serializeMessage throws an Error', () => {
    const onError = vi.fn();
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      {
        onError,
        serializeMessage: () => { throw new Error('serialize failed'); }
      },
      adapter
    );

    const ok = channel.emit('ping', { value: 1 });

    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('serialize failed');

    channel.close();
  });

  it('should wrap non-Error thrown by serializeMessage into an Error', () => {
    const onError = vi.fn();
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      {
        onError,
        serializeMessage: () => { throw 'string error'; }
      },
      adapter
    );

    const ok = channel.emit('ping', { value: 1 });

    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);

    channel.close();
  });

  // --- on / onMessage (incoming) ---

  it('should dispatch incoming message to the correct event listeners', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    const pingListener = vi.fn();
    const pongListener = vi.fn();

    channel.on('ping', pingListener);
    channel.on('pong', pongListener);

    adapter.emitIncoming(
      JSON.stringify({ channelName: 'test-channel', event: 'ping', data: { value: 10 } })
    );

    expect(pingListener).toHaveBeenCalledWith({ value: 10 });
    expect(pongListener).not.toHaveBeenCalled();

    channel.close();
  });

  it('should ignore incoming message with mismatched channelName', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    const listener = vi.fn();
    channel.on('ping', listener);

    adapter.emitIncoming(
      JSON.stringify({ channelName: 'other-channel', event: 'ping', data: { value: 1 } })
    );

    expect(listener).not.toHaveBeenCalled();
    channel.close();
  });

  it('should ignore incoming message when event is undefined', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    const listener = vi.fn();
    channel.on('ping', listener);

    adapter.emitIncoming(
      JSON.stringify({ channelName: 'test-channel' })
    );

    expect(listener).not.toHaveBeenCalled();
    channel.close();
  });

  it('should ignore incoming message when event is null', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    const listener = vi.fn();
    channel.on('ping', listener);

    adapter.emitIncoming(
      JSON.stringify({ channelName: 'test-channel', event: null })
    );

    expect(listener).not.toHaveBeenCalled();
    channel.close();
  });

  it('should ignore incoming message when no listeners are registered for the event', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    // No listeners registered
    adapter.emitIncoming(
      JSON.stringify({ channelName: 'test-channel', event: 'ping', data: { value: 1 } })
    );

    // Should not throw
    channel.close();
  });

  it('should call onError when deserializeMessage throws an Error', () => {
    const onError = vi.fn();
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      { onError },
      adapter
    );

    adapter.emitIncoming('invalid json {{{');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);

    channel.close();
  });

  it('should wrap non-Error thrown by deserializeMessage into an Error', () => {
    const onError = vi.fn();
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      {
        onError,
        deserializeMessage: () => { throw 'parse string error'; }
      },
      adapter
    );

    adapter.emitIncoming('anything');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);

    channel.close();
  });

  it('should not throw when deserializeMessage fails and no onError is set', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    // invalid JSON but no onError handler
    expect(() => adapter.emitIncoming('invalid json {{{')).not.toThrow();

    channel.close();
  });

  // --- listener error handling ---

  it('should continue dispatching other listeners when one listener throws', () => {
    const onError = vi.fn();
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      { onError },
      adapter
    );

    const throwingListener = vi.fn(() => {
      throw new Error('listener failed');
    });
    const normalListener = vi.fn();

    channel.on('ping', throwingListener);
    channel.on('ping', normalListener);

    adapter.emitIncoming(
      JSON.stringify({ channelName: 'test-channel', event: 'ping', data: { value: 42 } })
    );

    expect(throwingListener).toHaveBeenCalledTimes(1);
    expect(normalListener).toHaveBeenCalledTimes(1);
    expect(normalListener).toHaveBeenCalledWith({ value: 42 });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('listener failed');
  });

  it('should wrap non-Error thrown by listener into an Error', () => {
    const onError = vi.fn();
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      { onError },
      adapter
    );

    channel.on('ping', () => {
      throw 'string listener error';
    });

    adapter.emitIncoming(
      JSON.stringify({ channelName: 'test-channel', event: 'ping', data: { value: 1 } })
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);

    channel.close();
  });

  it('should not throw when listener throws and no onError is set', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    channel.on('ping', () => {
      throw new Error('no handler');
    });

    expect(() =>
      adapter.emitIncoming(
        JSON.stringify({ channelName: 'test-channel', event: 'ping', data: { value: 1 } })
      )
    ).not.toThrow();

    channel.close();
  });

  // --- onMessageError ---

  it('should forward adapter messageerror to onMessageError callback', () => {
    const onMessageError = vi.fn();
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      { onMessageError },
      adapter
    );

    const messageError = new MessageEvent('messageerror');
    adapter.emitMessageError(messageError);

    expect(onMessageError).toHaveBeenCalledTimes(1);
    expect(onMessageError).toHaveBeenCalledWith(messageError);

    channel.close();
  });

  // --- off ---

  it('should remove only the specified listener when off is called with listener', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    const listenerA = vi.fn();
    const listenerB = vi.fn();

    channel.on('ping', listenerA);
    channel.on('ping', listenerB);
    channel.off('ping', listenerA);

    adapter.emitIncoming(
      JSON.stringify({ channelName: 'test-channel', event: 'ping', data: { value: 100 } })
    );

    expect(listenerA).not.toHaveBeenCalled();
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledWith({ value: 100 });
  });

  it('should remove all listeners of an event when off is called without listener', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    const listenerA = vi.fn();
    const listenerB = vi.fn();

    channel.on('ping', listenerA);
    channel.on('ping', listenerB);
    channel.off('ping');

    adapter.emitIncoming(
      JSON.stringify({ channelName: 'test-channel', event: 'ping', data: { value: 200 } })
    );

    expect(listenerA).not.toHaveBeenCalled();
    expect(listenerB).not.toHaveBeenCalled();
  });

  it('should do nothing when off is called with a listener that was never registered', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    const activeListener = vi.fn();
    const neverAddedListener = vi.fn();

    channel.on('ping', activeListener);
    channel.off('ping', neverAddedListener);

    adapter.emitIncoming(
      JSON.stringify({ channelName: 'test-channel', event: 'ping', data: { value: 400 } })
    );

    expect(activeListener).toHaveBeenCalledTimes(1);
    expect(activeListener).toHaveBeenCalledWith({ value: 400 });
  });

  it('should do nothing when off is called for an event with no listeners', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    // off on an event that was never registered
    expect(() => channel.off('ping', vi.fn())).not.toThrow();

    channel.close();
  });

  // --- clear ---

  it('should clear all listeners across events when clear is called', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    const listener = vi.fn();

    channel.on('ping', listener);
    channel.clear();

    adapter.emitIncoming(
      JSON.stringify({ channelName: 'test-channel', event: 'ping', data: { value: 300 } })
    );

    expect(listener).not.toHaveBeenCalled();
  });

  // --- close ---

  it('should clear listeners and close adapter on close', () => {
    const adapter = new MockAdapter();
    const channel = new WebpageChannel<TestEvents>(
      'test-channel',
      undefined,
      adapter
    );

    const listener = vi.fn();
    channel.on('ping', listener);
    channel.close();

    expect(adapter.close).toHaveBeenCalledTimes(1);

    // Emitting after close should fail
    const result = channel.emit('ping', { value: 1 });
    expect(result).toBe(false);
  });
});
