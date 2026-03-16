import { describe, expect, it, vi } from 'vitest';

import PostMessageAdapter from '../../src/core/postmessage-adapter';

describe('PostMessageAdapter', () => {
  it('should call targetWindow.postMessage with message and targetOrigin', () => {
    const mockWindow = { postMessage: vi.fn() } as unknown as Window;
    const adapter = new PostMessageAdapter(mockWindow, 'https://target.test');

    adapter.postMessage('hello');

    expect(mockWindow.postMessage).toHaveBeenCalledWith('hello', 'https://target.test');
    adapter.close();
  });

  it('should dispatch message only when origin and source match', () => {
    const callback = vi.fn();
    const adapter = new PostMessageAdapter(window, 'https://allowed.test');

    adapter.onMessage(callback);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'ok',
        origin: 'https://allowed.test',
        source: window
      })
    );

    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'blocked-origin',
        origin: 'https://blocked.test',
        source: window
      })
    );

    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'blocked-source',
        origin: 'https://allowed.test',
        source: null
      })
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('ok');

    adapter.close();
  });

  it('should remove previous message listener when onMessage is called again', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const adapter = new PostMessageAdapter(window, 'https://allowed.test');

    adapter.onMessage(() => {});
    adapter.onMessage(() => {});

    expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));

    adapter.close();
    removeSpy.mockRestore();
  });

  it('should remove previous messageerror listener when onMessageError is called again', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const adapter = new PostMessageAdapter(window, 'https://allowed.test');

    adapter.onMessageError(() => {});
    adapter.onMessageError(() => {});

    expect(removeSpy).toHaveBeenCalledWith('messageerror', expect.any(Function));

    adapter.close();
    removeSpy.mockRestore();
  });

  it('should invoke messageerror callback when messageerror event fires', () => {
    const onMessageError = vi.fn();
    const adapter = new PostMessageAdapter(window, 'https://allowed.test');

    adapter.onMessageError(onMessageError);

    const event = new MessageEvent('messageerror');
    window.dispatchEvent(event);

    expect(onMessageError).toHaveBeenCalledTimes(1);
    expect(onMessageError).toHaveBeenCalledWith(event);

    adapter.close();
  });

  it('should clean up message and messageerror listeners on close', () => {
    const onMessage = vi.fn();
    const onMessageError = vi.fn();
    const adapter = new PostMessageAdapter(window, 'https://allowed.test');

    adapter.onMessage(onMessage);
    adapter.onMessageError(onMessageError);
    adapter.close();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'after-close',
        origin: 'https://allowed.test',
        source: window
      })
    );
    window.dispatchEvent(new MessageEvent('messageerror'));

    expect(onMessage).not.toHaveBeenCalled();
    expect(onMessageError).not.toHaveBeenCalled();
  });

  it('should do nothing on close when no handlers were registered', () => {
    const adapter = new PostMessageAdapter(window, 'https://allowed.test');
    // Should not throw
    expect(() => adapter.close()).not.toThrow();
  });
});
