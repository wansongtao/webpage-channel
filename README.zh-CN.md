[English](./README.md) | 简体中文

# WEBPAGE-CHANNEL

一个轻量级、类型友好的浏览器端消息通信库。

它提供统一的事件 API，用于在不同网页上下文之间通信，例如多标签页、iframe 与 worker 场景。默认基于 `BroadcastChannel`，并支持通过适配器扩展到 `postMessage` 等通信方式。

## 特性

- 轻量易用：`on`、`emit`、`off` 即可完成事件收发。
- TypeScript 友好：通过泛型约束事件名和事件数据类型。
- 可扩展适配器：默认 `BroadcastChannel`，可自定义适配器。
- 可自定义序列化：支持替换 `JSON.stringify/parse`。
- 错误可观察：提供消息编解码错误与底层消息错误回调。

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

channel.on('toast:show', onToast);
channel.off('toast:show', onToast); // 移除指定监听器
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

### `channel.on(event, callback)`

注册事件监听。

### `channel.emit(event, payload): boolean`

发送事件并返回是否发送成功：

- `true`：序列化与发送成功。
- `false`：发送过程抛错（同时触发 `onError`）。

### `channel.off(event, listener?)`

- 传 `listener`：仅移除该函数引用。
- 不传 `listener`：移除该事件全部监听器。

### `channel.clear()`

清空当前实例的所有事件监听器。

### `channel.close()`

清空监听器并关闭底层适配器。

## 适配器扩展

库通过 `IWebpageChannelAdapter` 抽象底层通信能力，你可以按需实现自己的适配器（例如 `window.postMessage`、`MessagePort` 等）。

### 内置适配器

- `BroadcastChannelAdapter`：默认适配器，适合同源多标签页/上下文通信。
- `PostMessageAdapter`：适合父页面与 iframe、弹窗窗口等基于 `window.postMessage` 的场景。

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
- `PostMessageAdapter` 内部按 `e.origin === targetOrigin` 过滤消息来源。
- 父子页面应使用相同的频道名与事件定义，避免协议不一致。

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
- 在页面卸载或模块销毁时调用 `close()` 释放资源。

## 许可证

[MIT](./LICENSE)
