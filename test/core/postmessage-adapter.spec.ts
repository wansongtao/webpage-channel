import { describe, expect, it, vi } from 'vitest';

import PostMessageAdapter from '../../src/core/postmessage-adapter';

describe('PostMessageAdapter', () => {
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
});
