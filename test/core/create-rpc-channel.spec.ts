import { describe, expect, it, vi } from 'vitest';

import type { IWebpageChannelAdapter } from '../../src/types';
import WebpageChannelRpc from '../../src/core/webpage-channel-rpc';
import { createRpcChannel } from '../../src/core/create-rpc-channel';

type TestApi = {
  add: (payload: { a: number; b: number }) => number;
};

class MockAdapter implements IWebpageChannelAdapter {
  postMessage = vi.fn();
  close = vi.fn();
  onMessage(_cb: (msg: string) => void): void {}
  onMessageError(_cb: (e: MessageEvent) => void): void {}
}

describe('createRpcChannel', () => {
  it('should return a WebpageChannelRpc instance', () => {
    const adapter = new MockAdapter();
    const rpc = createRpcChannel<TestApi>('test-channel', undefined, adapter);

    expect(rpc).toBeInstanceOf(WebpageChannelRpc);
    rpc.close();
  });

  it('should accept rpc options', () => {
    const genId = vi.fn(() => 'fixed-id');
    const adapter = new MockAdapter();
    const rpc = createRpcChannel<TestApi>(
      'test-channel',
      { rpc: { timeout: 1000, generateUniqueId: genId } },
      adapter
    );

    expect(rpc).toBeInstanceOf(WebpageChannelRpc);
    rpc.close();
  });

  it('should accept channel options', () => {
    const onError = vi.fn();
    const adapter = new MockAdapter();
    const rpc = createRpcChannel<TestApi>(
      'test-channel',
      { channel: { onError } },
      adapter
    );

    expect(rpc).toBeInstanceOf(WebpageChannelRpc);
    rpc.close();
  });

  it('should close the underlying adapter when rpc.close() is called', () => {
    const adapter = new MockAdapter();
    const rpc = createRpcChannel<TestApi>('test-channel', undefined, adapter);

    rpc.close();

    expect(adapter.close).toHaveBeenCalledTimes(1);
  });

  it('should wire up request/response end-to-end', async () => {
    let serverHandler: ((msg: string) => void) | null = null;
    let clientHandler: ((msg: string) => void) | null = null;

    const serverAdapter: IWebpageChannelAdapter = {
      postMessage: vi.fn((msg: string) => clientHandler?.(msg)),
      close: vi.fn(),
      onMessage: (cb) => { serverHandler = cb; },
      onMessageError: () => {}
    };
    const clientAdapter: IWebpageChannelAdapter = {
      postMessage: vi.fn((msg: string) => serverHandler?.(msg)),
      close: vi.fn(),
      onMessage: (cb) => { clientHandler = cb; },
      onMessageError: () => {}
    };

    const server = createRpcChannel<TestApi>('ch', undefined, serverAdapter);
    const client = createRpcChannel<TestApi>('ch', undefined, clientAdapter);

    server.response('add', ({ a, b }) => a + b);
    const [err, result] = await client.request('add', { a: 3, b: 4 });

    expect(err).toBeUndefined();
    expect(result).toBe(7);

    server.close();
    client.close();
  });
});
