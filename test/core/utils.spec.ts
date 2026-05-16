import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateLocalId, isSupportBroadcastChannel, isSupportLocalStorage, isSupportPostMessage } from '../../src/utils';

describe('generateLocalId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return a UUID string when crypto.randomUUID is available', () => {
    const id = generateLocalId();
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('should use the fallback when crypto is undefined', () => {
    vi.stubGlobal('crypto', undefined);

    const id = generateLocalId();

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    // fallback format: <timestamp>-<random>-<random>
    expect(id).toMatch(/^\d+-[a-z0-9]+-[a-z0-9]+$/);
  });

  it('should use the fallback when crypto.randomUUID is not a function', () => {
    vi.stubGlobal('crypto', {});

    const id = generateLocalId();

    expect(typeof id).toBe('string');
    expect(id).toMatch(/^\d+-[a-z0-9]+-[a-z0-9]+$/);
  });

  it('should return unique values on each call', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateLocalId()));
    expect(ids.size).toBe(10);
  });
});

describe('isSupportBroadcastChannel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return true when BroadcastChannel is defined', () => {
    expect(isSupportBroadcastChannel()).toBe(true);
  });

  it('should return false when BroadcastChannel is undefined', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    expect(isSupportBroadcastChannel()).toBe(false);
  });
});

describe('isSupportLocalStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return true when localStorage is defined', () => {
    expect(isSupportLocalStorage()).toBe(true);
  });

  it('should return false when localStorage is undefined', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(isSupportLocalStorage()).toBe(false);
  });
});

describe('isSupportPostMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return true when window.postMessage is a function', () => {
    expect(isSupportPostMessage()).toBe(true);
  });

  it('should return false when window is undefined', () => {
    vi.stubGlobal('window', undefined);
    expect(isSupportPostMessage()).toBe(false);
  });
});
