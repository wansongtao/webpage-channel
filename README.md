English | [简体中文](./README.zh-CN.md)

# WEBPAGE-CHANNEL

A lightweight, type-friendly messaging library for browser contexts.

It provides a unified event API for communication across web contexts such as tabs, iframes, and workers. By default it uses `BroadcastChannel`, and can be extended with adapters like `postMessage`.

## Features

- Lightweight API: communicate with just `on`, `emit`, and `off`.
- TypeScript-friendly: strongly typed event names and payloads via generics.
- Adapter extensibility: uses `BroadcastChannel` by default, supports custom adapters.
- Custom serialization: replace `JSON.stringify/parse` when needed.
- Observable errors: hooks for encode/decode and low-level message errors.

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

### `channel.emit(event, payload): boolean`

Emits an event and returns send status:

- `true`: message serialized and sent successfully.
- `false`: sending failed with an exception (and `onError` is called).

### `channel.off(event, listener?)`

- With `listener`: removes only the specific function reference.
- Without `listener`: removes all listeners for the event.

### `channel.clear()`

Clears all listeners on the current instance.

### `channel.close()`

Clears listeners and closes the underlying adapter.

## Adapter Extension

The library abstracts transport with `IWebpageChannelAdapter`, so you can implement your own adapter (for example `window.postMessage`, `MessagePort`, and others).

### Built-in Adapters

- `BroadcastChannelAdapter`: default adapter for same-origin multi-tab/context communication.
- `PostMessageAdapter`: good for parent/iframe and popup communication based on `window.postMessage`.

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
- `PostMessageAdapter` filters incoming messages with `e.origin === targetOrigin`.
- Parent and child should use the same channel name and event contract.

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
- Call `close()` when a page/module is disposed.

## License

[MIT](./LICENSE)
