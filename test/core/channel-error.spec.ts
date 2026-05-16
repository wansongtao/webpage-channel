import { describe, expect, it } from 'vitest';

import { ChannelError } from '../../src/core/channel-error';

describe('ChannelError', () => {
  it('should be an instance of Error', () => {
    const err = new ChannelError('Error');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ChannelError);
  });

  it.each([
    'TimeoutError',
    'AbortError',
    'EmitError',
    'Error',
  ] as const)('should set name to "%s"', (name) => {
    const err = new ChannelError(name);
    expect(err.name).toBe(name);
  });

  it('should set message when provided', () => {
    const err = new ChannelError('TimeoutError', 'request timed out');
    expect(err.message).toBe('request timed out');
  });

  it('should have empty message when omitted', () => {
    const err = new ChannelError('AbortError');
    expect(err.message).toBe('');
  });
});
