import { describe, expect, it, vi } from 'vitest';

import EventBus from '../../src/core/event-bus';

type TestEvents = {
  ping: (payload: { value: number }) => void;
  pong: (payload: { result: string }) => void;
};

describe('EventBus', () => {
  it('should call listener with payload for the matched event', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();

    bus.on('ping', listener);
    bus.emit('ping', { value: 1 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ value: 1 });
  });

  it('should continue dispatching listeners when one throws', () => {
    const onListenerError = vi.fn();
    const bus = new EventBus<TestEvents>({ onListenerError });
    const throwing = vi.fn(() => {
      throw new Error('listener failed');
    });
    const normal = vi.fn();

    bus.on('ping', throwing);
    bus.on('ping', normal);
    bus.emit('ping', { value: 2 });

    expect(throwing).toHaveBeenCalledTimes(1);
    expect(normal).toHaveBeenCalledTimes(1);
    expect(normal).toHaveBeenCalledWith({ value: 2 });
    expect(onListenerError).toHaveBeenCalledTimes(1);
    expect(onListenerError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onListenerError.mock.calls[0][0].message).toBe('listener failed');
  });

  it('should wrap non-Error thrown by listener', () => {
    const onListenerError = vi.fn();
    const bus = new EventBus<TestEvents>({ onListenerError });

    bus.on('ping', () => {
      throw 'string listener error';
    });
    bus.emit('ping', { value: 3 });

    expect(onListenerError).toHaveBeenCalledTimes(1);
    expect(onListenerError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('should remove only the specified listener when off is called with listener', () => {
    const bus = new EventBus<TestEvents>();
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    bus.on('ping', listenerA);
    bus.on('ping', listenerB);
    bus.off('ping', listenerA);
    bus.emit('ping', { value: 4 });

    expect(listenerA).not.toHaveBeenCalled();
    expect(listenerB).toHaveBeenCalledTimes(1);
  });

  it('should remove all listeners for an event when off is called without listener', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();

    bus.on('ping', listener);
    bus.off('ping');
    bus.emit('ping', { value: 5 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should call once listener only once', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();

    bus.once('ping', listener);
    bus.emit('ping', { value: 6 });
    bus.emit('ping', { value: 7 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ value: 6 });
  });

  it('should support off with original listener registered by once', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();

    bus.once('ping', listener);
    bus.off('ping', listener);
    bus.emit('ping', { value: 8 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should clear all listeners across events', () => {
    const bus = new EventBus<TestEvents>();
    const ping = vi.fn();
    const pong = vi.fn();

    bus.on('ping', ping);
    bus.on('pong', pong);
    bus.clear();

    bus.emit('ping', { value: 6 });
    bus.emit('pong', { result: 'ok' });

    expect(ping).not.toHaveBeenCalled();
    expect(pong).not.toHaveBeenCalled();
  });
});
