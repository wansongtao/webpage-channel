[English](./README.md) | 简体中文

# WEBPAGE-CHANNEL

一个轻量级、类型友好的浏览器端消息通信库。

它提供统一的事件 API，用于在不同网页上下文之间通信，例如多标签页、iframe 与 worker 场景。默认基于 `BroadcastChannel`，在不支持时自动降级到 `localStorage`，并支持通过适配器扩展到 `postMessage` 等通信方式。

## 特性

- **轻量易用**：`on`、`once`、`emit`、`off` 即可完成事件收发。
- **TypeScript 友好**：通过泛型约束事件名和事件数据类型。
- **可扩展适配器**：默认 `BroadcastChannel`，不支持时自动降级到 `localStorage`；也可使用 `PostMessageAdapter` 实现 iframe/弹窗通信，或自行实现适配器。
- **可自定义序列化**：支持替换默认的 `JSON.stringify/parse`。
- **错误可观察**：提供消息编解码错误与底层 `messageerror` 事件回调。
- **RPC 层**：通过 `WebpageChannelRpc` 或 `createRpcChannel` 工厂函数支持类型化请求/响应与单向通知。
- **结构化错误处理**：`request()` 始终 resolve 为 `[ChannelError] | [undefined, result]` 元组，无未捕获的 reject；通过 `err.name` 区分超时、中止、发送失败与 handler 异常。

## 安装

```bash
pnpm add webpage-channel
# 或
npm i webpage-channel
# 或
yarn add webpage-channel
```

## 快速开始

### 1. 定义事件类型

```ts
import { WebpageChannel } from 'webpage-channel';

type Events = {
	'user:update': (payload: { id: string; name: string }) => void;
	'toast:show': (payload: { message: string; type: 'success' | 'error' }) => void;
};

const channel = new WebpageChannel<Events>('app-channel');
```

### 2. 监听消息

```ts
channel.on('user:update', (payload) => {
	console.log('收到用户更新', payload.id, payload.name);
});
```

### 3. 发送消息

```ts
const ok = channel.emit('user:update', { id: 'u1', name: 'Alice' });
if (!ok) {
	console.warn('消息发送失败');
}
```

### 4. 取消监听和销毁

```ts
const onToast = (payload: { message: string; type: 'success' | 'error' }) => {
	console.log(payload.message);
};

// on/once 均返回一个取消函数
const unsubscribe = channel.on('toast:show', onToast);
const unsubscribeOnce = channel.once('toast:show', (payload) => {
	console.log('仅触发一次:', payload.message);
});

unsubscribe();      // 移除该监听器
unsubscribeOnce();  // 在触发前取消（若尚未触发）

channel.off('toast:show', onToast); // 等价写法 — 移除指定监听器
channel.off('toast:show'); // 移除该事件全部监听器

channel.close(); // 清空监听并关闭底层通道
```

## API

### `new WebpageChannel<T>(channelName, options?, adapter?)`

创建一个频道实例。

- `channelName: string`：频道名称。
- `options?: { ... }`：可选配置。
- `adapter?: IWebpageChannelAdapter`：可选适配器；不传时默认使用 `BroadcastChannelAdapter`。

`options` 说明：

- `onError?: (e: Error) => void`
	- 序列化、反序列化或事件分发过程中出现异常时触发。
- `onMessageError?: (e: MessageEvent) => void`
	- 底层通道触发 `messageerror` 时触发。
- `serializeMessage?: (data) => string`
	- 自定义序列化函数，默认 `JSON.stringify`。
- `deserializeMessage?: (raw) => data`
	- 自定义反序列化函数，默认 `JSON.parse`。

### `channel.on(event, callback): () => void`

注册事件监听。返回一个取消函数，调用后移除该监听器。

> 在 `close()` 之后调用 `on` 会触发 `onError`，并返回一个空操作函数。

### `channel.once(event, callback): () => void`

注册一次性监听器，首次触发后会自动移除。返回一个取消函数，可在触发前主动取消。

> 在 `close()` 之后调用 `once` 会触发 `onError`，并返回一个空操作函数。

### `channel.emit(event, payload): boolean`

发送事件并返回是否发送成功：

- `true`：序列化与发送成功。
- `false`：发送过程抛错（同时触发 `onError`）。
- `false`：在调用 `close()` 之后再调用 `emit` 也会返回 `false`（同时触发 `onError`）。

### `channel.off(event, listener?)`

- 传 `listener`：仅移除该函数引用。
- 不传 `listener`：移除该事件全部监听器。

### `channel.clear()`

清空当前实例的所有事件监听器。

### `channel.isClosed: boolean`

在 `close()` 调用后返回 `true`。

### `channel.close()`

清空监听器并关闭底层适配器。

## RPC（请求 / 响应）

`WebpageChannelRpc` 对 `WebpageChannel` 进行封装，在原有事件总线基础上增加了请求/响应和单向通知语义。

当需要一端调用远端函数并获取返回值时使用，而非仅发送即忘的事件。

### 快速开始

```ts
import { createRpcChannel } from 'webpage-channel';

type Api = {
	add: (payload: { a: number; b: number }) => number;
	log: (payload: { text: string }) => void;
};

const rpcA = createRpcChannel<Api>('my-channel');
const rpcB = createRpcChannel<Api>('my-channel');

// 请求 / 响应
rpcA.response('add', ({ a, b }) => a + b);
const [err, result] = await rpcB.request('add', { a: 3, b: 4 });
// result === 7

// 单向通知
rpcA.onNotify('log', ({ text }) => console.log(text));
rpcB.notify('log', { text: 'hello' });
```

如需自定义 channel 配置，可直接使用 `WebpageChannelRpc`：

```ts
import { WebpageChannelRpc, WebpageChannel } from 'webpage-channel';

const channelA = new WebpageChannel<Api>('my-channel');
const channelB = new WebpageChannel<Api>('my-channel');

const rpcA = new WebpageChannelRpc<Api>(channelA);
const rpcB = new WebpageChannelRpc<Api>(channelB);
```

`createRpcChannel` 与 `WebpageChannelRpc` 均支持 `channelName`、`options.channel`、`options.rpc` 和 `adapter` 参数。

### 返回值约定

`request` 始终 resolve，永不 reject。结果为可判别的元组：

```ts
import { ChannelError } from 'webpage-channel';

const [err, result] = await rpc.request('add', { a: 1, b: 2 });

if (err) {
	// err 是 ChannelError 实例，通过 err.name 可判断错误类型：
	//   'TimeoutError'  — 超时未收到响应
	//   'AbortError'    — AbortSignal 被触发
	//   'EmitError'     — 消息发送失败（如通道已关闭）
	//   'Error'         — 远端 handler 抛出了异常
	console.error(err.name, err.message);
} else {
	console.log(result); // 类型为 handler 的返回类型
}
```

### RPC API

#### `rpc.request(event, payload, timeout?, signal?)`

发送请求并等待响应。

- `timeout` — 单次调用超时时间（ms），覆盖实例级默认值（默认 `5000`）。
- `signal` — 可选 `AbortSignal`，用于外部主动取消请求。

返回 `Promise<[ChannelError] | [undefined, result]>`。

```ts
// 自定义超时
const [err, result] = await rpc.request('add', { a: 1, b: 2 }, 3000);

// 通过 AbortController 取消
const controller = new AbortController();
setTimeout(() => controller.abort(), 1000);
const [err2, result2] = await rpc.request('add', { a: 1, b: 2 }, undefined, controller.signal);
```

#### `rpc.response(event, handler): () => void`

注册处理指定请求的函数。返回一个取消函数，调用后注销该处理函数。

```ts
const cancel = rpcA.response('add', ({ a, b }) => a + b);

// 支持 async handler
rpcA.response('greet', async ({ name }) => {
	const greeting = await fetchGreeting(name);
	return greeting;
});

cancel(); // 不再需要时注销
```

#### `rpc.notify(event, payload): boolean`

发送单向通知，不等待响应。通道已关闭时返回 `false`。

```ts
rpcB.notify('log', { text: 'hello' });
```

#### `rpc.onNotify(event, handler): () => void`

注册单向通知的监听器。返回一个取消函数。

```ts
const cancel = rpcA.onNotify('log', ({ text }) => {
	console.log(text);
});

cancel(); // 注销
```

#### `rpc.off(event)`

注销指定事件的 response handler，并取消所有针对该事件的 pending 请求。

> 优先使用 `response()` 返回的取消函数来注销 handler；仅当需要注销在其他地方注册的 handler 时才使用 `off()`。

#### `rpc.offNotify(event)`

注销指定事件的通知监听器。

> 优先使用 `onNotify()` 返回的取消函数来注销监听器；仅当需要注销在其他地方注册的监听器时才使用 `offNotify()`。

#### `rpc.clear()`

取消所有 pending 请求，移除所有 response handler 和通知监听器。**不会**关闭底层通道。

#### `rpc.close()`

先调用 `clear()`，再关闭底层通道。调用后实例不可再使用。

### RPC 配置项

作为第二参数传入 `WebpageChannelRpc`（或 `createRpcChannel` 的 `options.rpc`）：

```ts
const rpc = new WebpageChannelRpc<Api>(channel, {
	timeout: 10_000,                  // 默认请求超时时间（ms）
	generateUniqueId: () => myUuid(), // 自定义请求 ID 生成函数
});
```

### 错误类型

`ChannelError` 继承自内置 `Error`，是 `request()` 失败元组中返回的错误类型。通过 `name` 属性可判断错误来源：

| `err.name` | 含义 |
|---|---|
| `'TimeoutError'` | 超时未收到响应 |
| `'AbortError'` | `AbortSignal` 被触发，请求在收到响应前被取消 |
| `'EmitError'` | 底层通道发送失败（如通道已关闭） |
| `'Error'` | 远端 handler 抛出了异常 |

`ChannelError` 和 `ErrorName` 类型别名均从包入口导出：

```ts
import { ChannelError, type ErrorName } from 'webpage-channel';

function handleRpcError(err: ChannelError) {
	switch (err.name) {
		case 'TimeoutError': /* 重试或显示超时提示 */ break;
		case 'AbortError':  /* 请求已被主动取消 */ break;
		case 'EmitError':   /* 通道不可用 */ break;
		case 'Error':       /* handler 抛出了异常 */ break;
	}
}
```

> **注意：** `response()` handler 内部抛出的异常，序列化时 `name` 统一为 `'Error'`，原始错误类型（如 `TypeError`）不会跨消息边界传递。

## 适配器扩展

库通过 `IWebpageChannelAdapter` 抽象底层通信能力，你可以按需实现自己的适配器（例如 `window.postMessage`、`MessagePort` 等）。

### 内置适配器

- `BroadcastChannelAdapter`：默认适配器，适合同源多标签页/上下文通信。
- `LocalStorageAdapter`：基于 `localStorage` + `storage` 事件的降级适配器，适用于 `BroadcastChannel` 不可用的环境。仅支持同源跨标签页，发送方标签页不会收到自身发出的消息。
- `PostMessageAdapter`：适合父页面与 iframe、弹窗窗口等基于 `window.postMessage` 的场景。

> `WebpageChannel` 会按以下顺序自动选择适配器：`BroadcastChannel` → `localStorage` → 抛出错误。

### 使用 LocalStorageAdapter

如需强制使用 `localStorage` 通信，可直接传入 `LocalStorageAdapter`：

```ts
import { LocalStorageAdapter, WebpageChannel } from 'webpage-channel';

type Events = {
	'user:update': (payload: { id: string }) => void;
};

const adapter = new LocalStorageAdapter('app-channel');
const channel = new WebpageChannel<Events>('app-channel', undefined, adapter);

channel.on('user:update', (payload) => {
	console.log('收到:', payload.id);
});

channel.emit('user:update', { id: 'u1' });
```

注意事项：

- `LocalStorageAdapter` 仅适用于**同源跨标签页**通信。
- 发送方标签页**不会**收到自身发出的消息（与 `BroadcastChannel` 行为一致）。
- 每次发送都会写入 `localStorage`，调用 `close()` 时会清除对应的键。
- 存储值中包含 `timestamp` 字段，确保连续发送相同内容时 `storage` 事件仍能正常触发。

### 使用 PostMessageAdapter

`PostMessageAdapter` 构造参数：

- `targetWindow: Window`：目标窗口对象（如 `iframe.contentWindow`、`window.parent`）。
- `targetOrigin: string`：目标来源（例如 `https://example.com`，或开发环境 `*`）。

父页面发送给 iframe：

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

iframe 回传给父页面：

```ts
import { PostMessageAdapter, WebpageChannel } from 'webpage-channel';

type Events = {
	'auth:token': (payload: { token: string }) => void;
};

const adapter = new PostMessageAdapter(window.parent, 'https://parent.example.com');
const channel = new WebpageChannel<Events>('iframe-channel', undefined, adapter);

channel.on('auth:token', (payload) => {
	console.log('收到 token:', payload.token);
});
```

注意事项：

- 生产环境请避免使用 `*` 作为 `targetOrigin`。
- `PostMessageAdapter` 内部会同时校验 `e.origin === targetOrigin` 和 `e.source === targetWindow`。
- 父子页面建议保持一致的事件名与数据结构定义。
- **安全提示**：本库是传输层，不对 payload 结构做运行时校验。当与第三方或不可信窗口通信时（尤其是 `targetOrigin: '*'` 场景），建议在业务层对接收到的数据进行校验后再使用。`deserializeMessage` 选项是接入 [Zod](https://zod.dev) 等 Schema 校验器的便捷入口：

```ts
import { z } from 'zod';

const schema = z.object({
	channelName: z.string(),
	event: z.string().optional(),
	data: z.unknown(),
});

const channel = new WebpageChannel('my-channel', {
	deserializeMessage: (raw) => schema.parse(JSON.parse(raw)),
});
```

### 自定义适配器示例

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

## 序列化定制示例

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
		console.error('编解码或分发错误:', err);
	}
});
```

## 使用建议

- 事件名保持稳定且语义化，推荐使用 `模块:动作` 命名。
- 避免传输超大对象，尽量传必要字段。
- 跨来源通信时请在适配器内严格校验 `origin`。
- 作为跨系统或跨上下文协议时，事件名和消息字段建议使用 `string`，不要使用 `Symbol`。
- `Symbol` 适合内部运行时标记（例如仅在内存中使用的监听器元信息），但不应进入传输消息。
- 在页面卸载或模块销毁时调用 `close()` 释放资源。

## 测试

当前覆盖率：语句、分支、函数、行均为 **100%**。

```bash
# 监听模式运行测试
pnpm test

# 运行测试并生成覆盖率报告
pnpm test:coverage
```

## 许可证

[MIT](./LICENSE)
