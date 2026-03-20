# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

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
