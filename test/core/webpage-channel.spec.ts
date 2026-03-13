import { describe, expect, it, vi } from 'vitest';

import WebpageChannel from '../../src/core/webpage-channel';
import type { IWebpageChannelAdapter } from '../../src/types';

type TestEvents = {
  ping: (payload: { value: number }) => void;
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
      JSON.stringify({ event: 'ping', data: { value: 42 } })
    );

    expect(throwingListener).toHaveBeenCalledTimes(1);
    expect(normalListener).toHaveBeenCalledTimes(1);
    expect(normalListener).toHaveBeenCalledWith({ value: 42 });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('listener failed');
  });

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
      JSON.stringify({ event: 'ping', data: { value: 100 } })
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
      JSON.stringify({ event: 'ping', data: { value: 200 } })
    );

    expect(listenerA).not.toHaveBeenCalled();
    expect(listenerB).not.toHaveBeenCalled();
  });

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
      JSON.stringify({ event: 'ping', data: { value: 300 } })
    );

    expect(listener).not.toHaveBeenCalled();
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
      JSON.stringify({ event: 'ping', data: { value: 400 } })
    );

    expect(activeListener).toHaveBeenCalledTimes(1);
    expect(activeListener).toHaveBeenCalledWith({ value: 400 });
  });
});
