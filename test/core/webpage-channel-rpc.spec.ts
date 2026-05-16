import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IWebpageChannelAdapter } from '../../src/types';
import WebpageChannel from '../../src/core/webpage-channel';
import WebpageChannelRpc from '../../src/core/webpage-channel-rpc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TestApi = {
  add: (payload: { a: number; b: number }) => number;
  greet: (payload: { name: string }) => string;
  fail: (payload: { msg: string }) => never;
  log: (payload: { text: string }) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHANNEL_NAME = 'rpc-test-channel';

/** Two adapters that synchronously relay messages to each other. */
class LinkedAdapter implements IWebpageChannelAdapter {
  private _handler: ((msg: string) => void) | null = null;
  peer: LinkedAdapter | null = null;

  postMessage = vi.fn((msg: string) => {
    this.peer?._handler?.(msg);
  });

  close = vi.fn();

  onMessage(cb: (msg: string) => void): void {
    this._handler = cb;
  }

  onMessageError(_cb: (e: MessageEvent) => void): void {}
}

function createLinkedPair(): [LinkedAdapter, LinkedAdapter] {
  const a = new LinkedAdapter();
  const b = new LinkedAdapter();
  a.peer = b;
  b.peer = a;
  return [a, b];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebpageChannelRpc', () => {
  let clientAdapter: LinkedAdapter;
  let serverAdapter: LinkedAdapter;
  let clientChannel: WebpageChannel<any>;
  let serverChannel: WebpageChannel<any>;
  let client: WebpageChannelRpc<TestApi>;
  let server: WebpageChannelRpc<TestApi>;

  beforeEach(() => {
    [clientAdapter, serverAdapter] = createLinkedPair();
    clientChannel = new WebpageChannel(CHANNEL_NAME, undefined, clientAdapter);
    serverChannel = new WebpageChannel(CHANNEL_NAME, undefined, serverAdapter);
    client = new WebpageChannelRpc(clientChannel);
    server = new WebpageChannelRpc(serverChannel);
  });

  afterEach(() => {
    client.close();
    server.close();
  });

  // -------------------------------------------------------------------------
  // constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('should create an instance with default options', () => {
      expect(client).toBeDefined();
    });

    it('should accept custom timeout and generateUniqueId options', () => {
      const genId = vi.fn(() => 'fixed-id');
      const rpc = new WebpageChannelRpc(clientChannel, { timeout: 1000, generateUniqueId: genId });
      expect(rpc).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // request / response
  // -------------------------------------------------------------------------

  describe('request / response', () => {
    it('should send a request and receive the result', async () => {
      server.response('add', ({ a, b }) => a + b);

      const [err, result] = await client.request('add', { a: 3, b: 4 });

      expect(err).toBeUndefined();
      expect(result).toBe(7);
    });

    it('should handle an async response handler', async () => {
      server.response('greet', async ({ name }) => `Hello, ${name}!`);

      const [err, result] = await client.request('greet', { name: 'World' });

      expect(err).toBeUndefined();
      expect(result).toBe('Hello, World!');
    });

    it('should propagate errors thrown in the handler as an Error', async () => {
      server.response('fail', ({ msg }) => {
        throw new Error(msg);
      });

      const [err, result] = await client.request('fail', { msg: 'boom' });

      expect(result).toBeUndefined();
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe('boom');
    });

    it('should wrap non-Error values thrown in the handler', async () => {
      server.response('fail', () => {
        throw 'unexpected string';
      });

      const [err] = await client.request('fail', { msg: '' });

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe('unexpected string');
    });

    it('should preserve error name from the handler', async () => {
      server.response('fail', () => {
        const e = new TypeError('type mismatch');
        throw e;
      });

      const [err] = await client.request('fail', { msg: '' });

      expect((err as Error).name).toBe('TypeError');
      expect((err as Error).message).toBe('type mismatch');
    });

    it('should time out when no handler responds', async () => {
      const [err] = await client.request('add', { a: 1, b: 2 }, 50);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/timed out/i);
    });

    it('should use the per-request timeout over the default', async () => {
      const rpc = new WebpageChannelRpc(clientChannel, { timeout: 5000 });

      const [err] = await rpc.request('add', { a: 1, b: 2 }, 30);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/timed out/i);
    });

    it('should return an error immediately when emit fails', async () => {
      const [adapterA] = createLinkedPair();
      const closedChannel = new WebpageChannel(CHANNEL_NAME, undefined, adapterA);
      const rpc = new WebpageChannelRpc(closedChannel);
      closedChannel.close();

      const [err] = await rpc.request('add', { a: 1, b: 1 });

      expect(err).toBeInstanceOf(Error);
    });

    it('should replace the handler when response() is called again for the same event', async () => {
      server.response('add', () => 0);
      server.response('add', ({ a, b }) => a + b);

      const [, result] = await client.request('add', { a: 10, b: 5 });

      expect(result).toBe(15);
    });
  });

  // -------------------------------------------------------------------------
  // off
  // -------------------------------------------------------------------------

  describe('off', () => {
    it('should remove the response handler so subsequent requests time out', async () => {
      server.response('add', ({ a, b }) => a + b);
      server.off('add');

      const [err] = await client.request('add', { a: 1, b: 2 }, 50);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/timed out/i);
    });

    it('should cancel pending outgoing requests for the removed event', async () => {
      // No server handler — request stays pending until cancelled or timed out.
      const promise = client.request('add', { a: 1, b: 2 }, 5000);
      client.off('add');

      const [err] = await promise;

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/cancelled/i);
    });
  });

  // -------------------------------------------------------------------------
  // notify / onNotify / offNotify
  // -------------------------------------------------------------------------

  describe('notify / onNotify / offNotify', () => {
    it('should deliver a notification to the registered listener', () => {
      const handler = vi.fn();
      server.onNotify('log', handler);

      client.notify('log', { text: 'hello' });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ text: 'hello' });
    });

    it('should return true when notify succeeds', () => {
      server.onNotify('log', vi.fn());

      const ok = client.notify('log', { text: 'ping' });

      expect(ok).toBe(true);
    });

    it('should return false when the channel is closed', () => {
      clientChannel.close();

      const ok = client.notify('log', { text: 'ping' });

      expect(ok).toBe(false);
    });

    it('should replace an existing listener when onNotify is called again', () => {
      const first = vi.fn();
      const second = vi.fn();
      server.onNotify('log', first);
      server.onNotify('log', second);

      client.notify('log', { text: 'msg' });

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledOnce();
    });

    it('should stop receiving notifications after offNotify', () => {
      const handler = vi.fn();
      server.onNotify('log', handler);
      server.offNotify('log');

      client.notify('log', { text: 'silent' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should be independent from request/response events with the same key name', async () => {
      const notifyHandler = vi.fn();
      server.onNotify('add', notifyHandler);
      server.response('add', ({ a, b }) => a + b);

      client.notify('add', { a: 1, b: 2 });
      const [, result] = await client.request('add', { a: 3, b: 4 });

      expect(notifyHandler).toHaveBeenCalledOnce();
      expect(result).toBe(7);
    });
  });

  // -------------------------------------------------------------------------
  // clear
  // -------------------------------------------------------------------------

  describe('clear', () => {
    it('should remove all response handlers', async () => {
      server.response('add', ({ a, b }) => a + b);
      server.response('greet', ({ name }) => `Hi ${name}`);
      server.clear();

      const [err] = await client.request('add', { a: 1, b: 2 }, 50);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/timed out/i);
    });

    it('should remove all notify listeners', () => {
      const logHandler = vi.fn();
      server.onNotify('log', logHandler);
      server.clear();

      client.notify('log', { text: 'after clear' });

      expect(logHandler).not.toHaveBeenCalled();
    });

    it('should cancel all pending outgoing requests', async () => {
      const promise = client.request('add', { a: 1, b: 2 }, 5000);
      client.clear();

      const [err] = await promise;

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/cleared/i);
    });
  });

  // -------------------------------------------------------------------------
  // close
  // -------------------------------------------------------------------------

  describe('close', () => {
    it('should close the underlying channel adapter', () => {
      server.close();

      expect(serverAdapter.close).toHaveBeenCalledTimes(1);
    });
  });
});
