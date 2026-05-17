import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as utils from '../../src/utils';
import LocalStorageAdapter from '../../src/core/localstorage-adapter';

describe('LocalStorageAdapter', () => {
  const CHANNEL = 'test-channel';
  const STORAGE_KEY = `__webpage-channel:${CHANNEL}`;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('should throw if localStorage is not supported', () => {
    vi.spyOn(utils, 'isSupportLocalStorage').mockReturnValue(false);

    expect(() => new LocalStorageAdapter(CHANNEL)).toThrow(
      'localStorage is not supported in this environment.'
    );
  });

  it('should create adapter without throwing when localStorage is available', () => {
    expect(() => new LocalStorageAdapter(CHANNEL)).not.toThrow();
  });

  it('should write a JSON payload to localStorage on postMessage', () => {
    const adapter = new LocalStorageAdapter(CHANNEL);
    const setItemSpy = vi.spyOn(localStorage, 'setItem');

    adapter.postMessage('hello');

    expect(setItemSpy).toHaveBeenCalledOnce();
    const [key, value] = setItemSpy.mock.calls[0];
    expect(key).toBe(STORAGE_KEY);
    const parsed = JSON.parse(value as string);
    expect(parsed.message).toBe('hello');
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('should replace the previous listener when onMessage is called multiple times', () => {
    const adapter = new LocalStorageAdapter(CHANNEL);
    const first = vi.fn();
    const second = vi.fn();
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    adapter.onMessage(first);
    adapter.onMessage(second);

    expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));

    const payload = JSON.stringify({ message: 'hello', timestamp: 'ts' });
    const event = new StorageEvent('storage', { key: STORAGE_KEY, newValue: payload });
    window.dispatchEvent(event);

    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();

    adapter.close();
  });

  it('should use a different timestamp each call so repeated identical messages differ', () => {
    const adapter = new LocalStorageAdapter(CHANNEL);
    const setItemSpy = vi.spyOn(localStorage, 'setItem');

    let call = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => ++call);

    adapter.postMessage('same');
    adapter.postMessage('same');

    const values = setItemSpy.mock.calls.map(([, v]) => v as string);
    expect(values[0]).not.toBe(values[1]);
  });

  it('should invoke callback when a storage event fires with the correct key', () => {
    const adapter = new LocalStorageAdapter(CHANNEL);
    const callback = vi.fn();
    adapter.onMessage(callback);

    const payload = JSON.stringify({ message: 'from-other-tab', timestamp: Date.now() });
    const event = new StorageEvent('storage', { key: STORAGE_KEY, newValue: payload });
    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith('from-other-tab');
  });

  it('should not invoke callback for a different storage key', () => {
    const adapter = new LocalStorageAdapter(CHANNEL);
    const callback = vi.fn();
    adapter.onMessage(callback);

    const payload = JSON.stringify({ message: 'noise', timestamp: Date.now() });
    const event = new StorageEvent('storage', { key: 'other-key', newValue: payload });
    window.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should not invoke callback when newValue is null (item removed)', () => {
    const adapter = new LocalStorageAdapter(CHANNEL);
    const callback = vi.fn();
    adapter.onMessage(callback);

    const event = new StorageEvent('storage', { key: STORAGE_KEY, newValue: null });
    window.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should silently ignore malformed JSON in storage event', () => {
    const adapter = new LocalStorageAdapter(CHANNEL);
    const callback = vi.fn();
    adapter.onMessage(callback);

    const event = new StorageEvent('storage', { key: STORAGE_KEY, newValue: 'not-json' });
    expect(() => window.dispatchEvent(event)).not.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });

  it('should remove the storage event listener after close', () => {
    const adapter = new LocalStorageAdapter(CHANNEL);
    const callback = vi.fn();
    adapter.onMessage(callback);

    adapter.close();

    const payload = JSON.stringify({ message: 'after-close', timestamp: Date.now() });
    const event = new StorageEvent('storage', { key: STORAGE_KEY, newValue: payload });
    window.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should remove the localStorage key on close', () => {
    const adapter = new LocalStorageAdapter(CHANNEL);
    adapter.postMessage('hello');

    adapter.close();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('should set storageHandler to null after close', () => {
    const adapter = new LocalStorageAdapter(CHANNEL);
    adapter.onMessage(vi.fn());

    adapter.close();

    expect((adapter as any).storageHandler).toBeNull();
  });

  it('onMessageError should be a no-op and not throw', () => {
    const adapter = new LocalStorageAdapter(CHANNEL);
    expect(() => adapter.onMessageError(vi.fn())).not.toThrow();
  });
});
