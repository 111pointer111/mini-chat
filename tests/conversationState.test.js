import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test conversation state machine transitions

describe('conversation state transitions', () => {
  const STATES = {
    IDLE: 'idle',
    TYPING: 'typing',
    STREAMING: 'streaming',
    ERROR: 'error',
  };

  const TRANSITIONS = {
    [STATES.IDLE]: [STATES.TYPING],
    [STATES.TYPING]: [STATES.IDLE, STATES.STREAMING, STATES.ERROR],
    [STATES.STREAMING]: [STATES.IDLE, STATES.ERROR],
    [STATES.ERROR]: [STATES.IDLE],
  };

  const canTransition = (from, to) => TRANSITIONS[from]?.includes(to) ?? false;

  it('allows idle -> typing', () => {
    assert.ok(canTransition(STATES.IDLE, STATES.TYPING));
  });

  it('allows typing -> streaming', () => {
    assert.ok(canTransition(STATES.TYPING, STATES.STREAMING));
  });

  it('allows streaming -> idle', () => {
    assert.ok(canTransition(STATES.STREAMING, STATES.IDLE));
  });

  it('allows any state -> error', () => {
    assert.ok(canTransition(STATES.TYPING, STATES.ERROR));
    assert.ok(canTransition(STATES.STREAMING, STATES.ERROR));
  });

  it('allows error -> idle (recovery)', () => {
    assert.ok(canTransition(STATES.ERROR, STATES.IDLE));
  });

  it('rejects idle -> streaming (must go through typing)', () => {
    assert.ok(!canTransition(STATES.IDLE, STATES.STREAMING));
  });

  it('rejects idle -> error', () => {
    assert.ok(!canTransition(STATES.IDLE, STATES.ERROR));
  });

  it('rejects error -> typing (must recover to idle first)', () => {
    assert.ok(!canTransition(STATES.ERROR, STATES.TYPING));
  });
});

describe('message status lifecycle', () => {
  const STATUS = { SENDING: 'sending', SENT: 'sent', DELIVERED: 'delivered', FAILED: 'failed' };

  const getStatusIcon = (status) => {
    const icons = { sending: '⏳', sent: '✓', delivered: '✓✓', failed: '✗' };
    return icons[status] ?? '?';
  };

  it('returns correct icons for each status', () => {
    assert.equal(getStatusIcon(STATUS.SENDING), '⏳');
    assert.equal(getStatusIcon(STATUS.SENT), '✓');
    assert.equal(getStatusIcon(STATUS.DELIVERED), '✓✓');
    assert.equal(getStatusIcon(STATUS.FAILED), '✗');
  });

  it('returns ? for unknown status', () => {
    assert.equal(getStatusIcon('unknown'), '?');
  });
});

describe('unread count', () => {
  const incrementUnread = (count) => count + 1;
  const resetUnread = () => 0;

  it('increments from zero', () => {
    assert.equal(incrementUnread(0), 1);
  });

  it('increments from non-zero', () => {
    assert.equal(incrementUnread(5), 6);
  });

  it('resets to zero', () => {
    assert.equal(resetUnread(), 0);
  });
});
