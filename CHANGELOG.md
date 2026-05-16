# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

## [1.2.0] - 2026-05-16

### Added

- Added `WebpageChannelRpc<T>` class providing a request/response and one-way notification RPC layer on top of `WebpageChannel`.
  - `request(event, payload, timeout?, signal?)` — sends a typed request and returns `[Error, undefined] | [null, Result]`. Supports per-call timeout and `AbortSignal` for external cancellation.
  - `response(event, handler)` — registers a handler for incoming requests; returns a cancel function.
  - `notify(event, payload)` — sends a one-way notification (no reply expected).
  - `onNotify(event, handler)` — registers a notification listener; returns a cancel function.
  - `off(event)` — unregisters the response handler and cancels all pending outgoing requests for that event.
  - `offNotify(event)` — unregisters the notification listener for an event.
  - `clear()` — unregisters all handlers and rejects all pending requests.
  - `close()` — calls `clear()` then closes the underlying `WebpageChannel`.
- Added `createRpcChannel<T>(channelName, options?, adapter?)` factory function that creates a `WebpageChannelRpc` without manually constructing a `WebpageChannel`.
- Added `toAbortError(reason)` utility function to `src/utils/index.ts`.
- Added `RpcOptions` and `RpcFn` types to the public type declarations.
- Exported `WebpageChannelRpc`, `createRpcChannel`, and `RpcOptions` from the package entry point.
- Added unit tests for `WebpageChannelRpc` under `test/core/webpage-channel-rpc.spec.ts` (33 tests).
- Added unit tests for `createRpcChannel` under `test/core/create-rpc-channel.spec.ts` (5 tests).
- Added `toAbortError` tests to `test/utils/utils.spec.ts` (6 tests).

### Documentation

- Updated `README.md` and `README.zh-CN.md` with a full RPC section covering Quick Start, return value convention, all RPC API methods, and RPC options.

## [1.1.0] - 2026-04-21

### Added

- Added `LocalStorageAdapter` as a built-in fallback adapter for environments where `BroadcastChannel` is unavailable, based on `localStorage` + `storage` events.
- Added `isSupportLocalStorage()` and `isSupportPostMessage()` utility functions to `src/utils/index.ts`.
- `WebpageChannel` now automatically selects an adapter in priority order: `BroadcastChannel` → `localStorage` → throws an error.
- Added environment availability checks (`isSupportBroadcastChannel`, `isSupportLocalStorage`, `isSupportPostMessage`) to all three built-in adapters' constructors, providing clear error messages when used in unsupported environments.
- Added unit tests for `LocalStorageAdapter` under `test/core/localstorage-adapter.spec.ts` with 100% coverage.
- Added `LocalStorageAdapter` fallback tests to `test/core/webpage-channel.spec.ts`.
- Added environment check tests to `test/core/broadcast-channel-adapter.spec.ts` and `test/core/postmessage-adapter.spec.ts`.
- Exported `LocalStorageAdapter` from the package entry point.

### Changed

- `WebpageChannel` constructor no longer performs a redundant `isSupportBroadcastChannel` check; environment detection is now delegated to each adapter's constructor.
- Error normalization in `WebpageChannel` (`postMessage` and `onMessage`) changed from `catch (e: any)` to `catch (e: unknown)` with `e instanceof Error` guard, consistent with `EventBus`.
- `this.onError && this.onError(e)` calls simplified to `this.onError?.(e)` throughout `WebpageChannel`.

### Documentation

- Updated `README.md` and `README.zh-CN.md` to document `LocalStorageAdapter`, automatic fallback behavior, notes on same-tab messaging, and updated test module list.

## [1.0.2] - 2026-03-20

### Added

- Added `once(event, callback)` support to `EventBus` and `WebpageChannel` for one-time listeners.

### Changed

- Improved `EventBus.emit()` iteration safety by dispatching on a snapshot to avoid mutation side effects during listener removal.
- Updated listener removal logic to support removing original callbacks registered via `once`.

### Documentation

- Updated `README.md` and `README.zh-CN.md` with `once` API usage and best-practice guidance for `Symbol` in cross-system messaging.

## [1.0.1] - 2026-03-16

### Added

- Added `channelName` field to `IChannelData` for improved message routing and filtering.
- Added unit tests for `BroadcastChannelAdapter` under `test/core/broadcast-channel-adapter.spec.ts`.
- Added unit tests for `PostMessageAdapter` under `test/core/postmessage-adapter.spec.ts`.
- Added unit tests for `WebpageChannel` under `test/core/webpage-channel.spec.ts`.
- Achieved **100%** test coverage across statements, branches, functions, and lines.

### Changed

- Updated `WebpageChannel` to include `channelName` in outgoing messages and validate it on incoming messages.
- Expanded test discovery in `vitest.config.ts` to include both `src/**/*.{test,spec}.{ts,js}` and `test/**/*.{test,spec}.{ts,js}`.
- Improved `WebpageChannel` event callback isolation so one listener throwing does not block other listeners.

### Fixed

- Fixed `PostMessageAdapter` listener cleanup logic by storing and removing exact handler references in `close()`.
- Hardened `PostMessageAdapter` message filtering with both origin and source checks.
- Fixed `WebpageChannel.emit()` behavior after `close()` to return `false` and trigger `onError`.

### Documentation

- Updated testing section in both `README.md` and `README.zh-CN.md` with coverage details and available test commands.
- Added detailed `PostMessageAdapter` usage examples for parent/iframe communication.
- Synchronized and expanded Chinese and English READMEs.

## [1.0.0] - 2026-03-13

### Added

- Initial public release of `webpage-channel`.
- Core channel abstraction with adapter-based transport.
- Built-in `BroadcastChannelAdapter` and `PostMessageAdapter`.
