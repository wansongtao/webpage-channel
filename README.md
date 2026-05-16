English | [简体中文](./README.zh-CN.md)

# WEBPAGE-CHANNEL

A lightweight, type-friendly messaging library for browser contexts.

It provides a unified event API for communication across web contexts such as tabs, iframes, and workers. By default it uses `BroadcastChannel`, and automatically falls back to `localStorage` if `BroadcastChannel` is unavailable. Can be extended with adapters like `postMessage`.

## Features

- Lightweight API: communicate with just `on`, `once`, `emit`, and `off`.
- TypeScript-friendly: strongly typed event names and payloads via generics.
- Adapter extensibility: uses `BroadcastChannel` by default, falls back to `localStorage` automatically, supports custom adapters.
- Custom serialization: replace `JSON.stringify/parse` when needed.
- Observable errors: hooks for encode/decode and low-level message errors.
- RPC layer: request/response and one-way notification via `WebpageChannelRpc`.

## Installation

```bash
pnpm add webpage-channel
# or
npm i webpage-channel
# or
yarn add webpage-channel
```

## Quick Start

### 1. Define event types

```ts
import { WebpageChannel } from 'webpage-channel';

type Events = {
	'user:update': (payload: { id: string; name: string }) => void;
	'toast:show': (payload: { message: string; type: 'success' | 'error' }) => void;
};

const channel = new WebpageChannel<Events>('app-channel');
```

### 2. Listen for events

```ts
channel.on('user:update', (payload) => {
	console.log('Received user update', payload.id, payload.name);
});
```

### 3. Emit events

```ts
const ok = channel.emit('user:update', { id: 'u1', name: 'Alice' });
if (!ok) {
	console.warn('Failed to send message');
}
```

### 4. Unsubscribe and dispose

```ts
const onToast = (payload: { message: string; type: 'success' | 'error' }) => {
	console.log(payload.message);
};

channel.on('toast:show', onToast);
channel.once('toast:show', (payload) => {
	console.log('Only once:', payload.message);
});
channel.off('toast:show', onToast); // remove a specific listener
channel.off('toast:show'); // remove all listeners of this event

channel.close(); // clear listeners and close underlying channel
```

## API

### `new WebpageChannel<T>(channelName, options?, adapter?)`

Creates a channel instance.

- `channelName: string`: channel name.
- `options?: { ... }`: optional settings.
- `adapter?: IWebpageChannelAdapter`: optional adapter; defaults to `BroadcastChannelAdapter`.

`options` details:

- `onError?: (e: Error) => void`
	- Triggered when serialization, deserialization, or event dispatch throws.
- `onMessageError?: (e: MessageEvent) => void`
	- Triggered when the underlying channel emits `messageerror`.
- `serializeMessage?: (data) => string`
	- Custom serializer, default is `JSON.stringify`.
- `deserializeMessage?: (raw) => data`
	- Custom deserializer, default is `JSON.parse`.

### `channel.on(event, callback)`

Registers an event listener.

### `channel.once(event, callback)`

Registers a one-time listener that is automatically removed after the first call.

### `channel.emit(event, payload): boolean`

Emits an event and returns send status:

- `true`: message serialized and sent successfully.
- `false`: sending failed with an exception (and `onError` is called).
- `false`: calling `emit` after `close()` also returns `false` (and `onError` is called).

### `channel.off(event, listener?)`

- With `listener`: removes only the specific function reference.
- Without `listener`: removes all listeners for the event.

### `channel.clear()`

Clears all listeners on the current instance.

### `channel.close()`

Clears listeners and closes the underlying adapter.

## RPC (Request / Response)

`WebpageChannelRpc` wraps a `WebpageChannel` and adds request/response and one-way notification semantics on top of the raw event bus.

Use it when one side needs to call a remote function and receive a result, rather than fire-and-forget events.

### Quick Start

```ts
import { createRpcChannel } from 'webpage-channel';

type Api = {
	add: (payload: { a: number; b: number }) => number;
	log: (payload: { text: string }) => void;
};

const rpcA = createRpcChannel<Api>('my-channel');
const rpcB = createRpcChannel<Api>('my-channel');

// request / response
rpcA.response('add', ({ a, b }) => a + b);
const [err, result] = await rpcB.request('add', { a: 3, b: 4 });
// result === 7

// one-way notification
rpcA.onNotify('log', ({ text }) => console.log(text));
rpcB.notify('log', { text: 'hello' });
```

For custom channel setup, use `WebpageChannelRpc` directly:

```ts
import { WebpageChannelRpc, WebpageChannel } from 'webpage-channel';

const channelA = new WebpageChannel<Api>('my-channel');
const channelB = new WebpageChannel<Api>('my-channel');

const rpcA = new WebpageChannelRpc<Api>(channelA);
const rpcB = new WebpageChannelRpc<Api>(channelB);
```

`createRpcChannel` and `WebpageChannelRpc` both accept `channelName`, `options.channel`, `options.rpc`, and `adapter`.

### Return value convention

`request` always resolves — never rejects. The result is a discriminated tuple:

```ts
const [err, result] = await rpc.request('add', { a: 1, b: 2 });

if (err) {
	// timeout, emit failure, remote handler threw, or AbortSignal fired
	console.error(err.message);
} else {
	console.log(result); // typed as the handler's return type
}
```

### RPC API

#### `rpc.request(event, payload, timeout?, signal?)`

Send a request and wait for the response.

- `timeout` — per-call override in ms; defaults to the instance-level timeout (default `5000`).
- `signal` — an `AbortSignal` to cancel the request externally.

Returns `Promise<[Error] | [undefined, result]>`.

```ts
// with a custom timeout
const [err, result] = await rpc.request('add', { a: 1, b: 2 }, 3000);

// cancellable via AbortController
const controller = new AbortController();
setTimeout(() => controller.abort(), 1000);
const [err2, result2] = await rpc.request('add', { a: 1, b: 2 }, undefined, controller.signal);
```

#### `rpc.response(event, handler): () => void`

Register a handler for an incoming request. Returns a cancel function that unregisters the handler.

```ts
const cancel = rpcA.response('add', ({ a, b }) => a + b);

// async handlers are supported
rpcA.response('greet', async ({ name }) => {
	const greeting = await fetchGreeting(name);
	return greeting;
});

cancel(); // unregister when no longer needed
```

#### `rpc.notify(event, payload): boolean`

Send a one-way notification. No response is expected. Returns `false` if the channel is closed.

```ts
rpcB.notify('log', { text: 'hello' });
```

#### `rpc.onNotify(event, handler): () => void`

Register a listener for incoming notifications. Returns a cancel function.

```ts
const cancel = rpcA.onNotify('log', ({ text }) => {
	console.log(text);
});

cancel(); // unregister
```

#### `rpc.off(event)`

Unregister the response handler for an event and cancel any pending outgoing requests for that event.

> Prefer the cancel function returned by `response()` for one-off unregistration. Use `off()` when you need to remove a handler that was registered elsewhere.

#### `rpc.offNotify(event)`

Unregister the notification listener for an event.

> Prefer the cancel function returned by `onNotify()` for one-off unregistration. Use `offNotify()` when you need to remove a listener that was registered elsewhere.

#### `rpc.clear()`

Cancel all pending requests and remove all response handlers and notification listeners. Does **not** close the underlying channel.

#### `rpc.close()`

Calls `clear()` then closes the underlying channel. The instance must not be used after this.

### RPC Options

Pass options as the second argument to `WebpageChannelRpc` (or `options.rpc` in `createRpcChannel`):

```ts
const rpc = new WebpageChannelRpc<Api>(channel, {
	timeout: 10_000,                  // default request timeout in ms
	generateUniqueId: () => myUuid(), // custom request ID generator
});
```

## Adapter Extension

### Built-in Adapters

- `BroadcastChannelAdapter`: default adapter for same-origin multi-tab/context communication.
- `LocalStorageAdapter`: fallback adapter based on `localStorage` + `storage` events, for environments where `BroadcastChannel` is unavailable. Same-origin multi-tab only; messages are not received by the sender tab.
- `PostMessageAdapter`: good for parent/iframe and popup communication based on `window.postMessage`.

> `WebpageChannel` selects an adapter automatically in this order: `BroadcastChannel` → `localStorage` → throws an error.

### Using LocalStorageAdapter

You can use `LocalStorageAdapter` directly if you need to force the `localStorage` transport:

```ts
import { LocalStorageAdapter, WebpageChannel } from 'webpage-channel';

type Events = {
	'user:update': (payload: { id: string }) => void;
};

const adapter = new LocalStorageAdapter('app-channel');
const channel = new WebpageChannel<Events>('app-channel', undefined, adapter);

channel.on('user:update', (payload) => {
	console.log('Received:', payload.id);
});

channel.emit('user:update', { id: 'u1' });
```

Notes:

- `LocalStorageAdapter` is for **same-origin, cross-tab** communication only.
- A tab will **not** receive its own messages (consistent with `BroadcastChannel` behavior).
- Each message writes to `localStorage`, which persists briefly; the key is removed when `close()` is called.
- The stored value includes a `timestamp` field to ensure the `storage` event fires even when the same message is sent consecutively.

### Using PostMessageAdapter

`PostMessageAdapter` constructor parameters:

- `targetWindow: Window`: target window object (such as `iframe.contentWindow` or `window.parent`).
- `targetOrigin: string`: target origin (for example `https://example.com`, or `*` in local development).

Parent page sends to iframe:

```ts
import { PostMessageAdapter, WebpageChannel } from 'webpage-channel';

type Events = {
	'auth:token': (payload: { token: string }) => void;
};

const iframe = document.getElementById('child-frame') as HTMLIFrameElement;
const adapter = new PostMessageAdapter(iframe.contentWindow!, 'https://child.example.com');
const channel = new WebpageChannel<Events>('iframe-channel', undefined, adapter);

channel.emit('auth:token', { token: 'abc123' });
```

Iframe sends back to parent:

```ts
import { PostMessageAdapter, WebpageChannel } from 'webpage-channel';

type Events = {
	'auth:token': (payload: { token: string }) => void;
};

const adapter = new PostMessageAdapter(window.parent, 'https://parent.example.com');
const channel = new WebpageChannel<Events>('iframe-channel', undefined, adapter);

channel.on('auth:token', (payload) => {
	console.log('Received token:', payload.token);
});
```

Notes:

- Avoid using `*` as `targetOrigin` in production.
- `PostMessageAdapter` validates both `e.origin === targetOrigin` and `e.source === targetWindow`.
- Parent and child should keep the same event names and payload contract.

### Custom Adapter Example

```ts
import { WebpageChannel, type IWebpageChannelAdapter } from 'webpage-channel';

class MyAdapter implements IWebpageChannelAdapter {
	postMessage(message: string) {
		// send
	}

	onMessage(callback: (message: string) => void) {
		// receive
	}

	onMessageError(callback: (e: MessageEvent) => void) {
		// message error
	}

	close() {
		// cleanup
	}
}

type Events = {
	ping: (payload: { time: number }) => void;
};

const channel = new WebpageChannel<Events>('my-channel', undefined, new MyAdapter());
```

## Custom Serialization Example

```ts
type Events = {
	notify: (payload: { text: string }) => void;
};

const channel = new WebpageChannel<Events>('secure-channel', {
	serializeMessage(data) {
		return btoa(JSON.stringify(data));
	},
	deserializeMessage(raw) {
		return JSON.parse(atob(raw));
	},
	onError(err) {
		console.error('Encode/decode or dispatch error:', err);
	}
});
```

## Best Practices

- Keep event names stable and semantic; `module:action` naming works well.
- Avoid sending very large objects; send only required fields.
- For cross-origin communication, strictly validate `origin` in your adapter logic.
- For cross-system or cross-context contracts, use `string` event names and payload fields, not `Symbol` values.
- Using `Symbol` for internal runtime markers is fine (for example, listener metadata that never crosses the transport boundary).
- Call `close()` when a page/module is disposed.

## Testing

Current coverage: **100%** statements, branches, functions, and lines.

```bash
# Run tests in watch mode
pnpm test

# Run tests with coverage
pnpm test:coverage
```

## License

[MIT](./LICENSE)
