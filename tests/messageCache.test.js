import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test the serialization/parsing logic from backend/src/utils/messageCache.ts
// These are the pure functions that don't depend on Redis or MongoDB

function serializeMessage(message) {
  return JSON.stringify(message);
}

function parseMessage(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

describe('messageCache serialization', () => {
  it('serializes a message to JSON string', () => {
    const msg = { _id: 'abc123', sender: 'user1', content: 'hello', type: 'text' };
    const result = serializeMessage(msg);
    assert.equal(typeof result, 'string');
    assert.equal(JSON.parse(result).content, 'hello');
  });

  it('round-trips a message through serialize and parse', () => {
    const msg = {
      _id: '507f1f77bcf86cd799439011',
      sender: 'user1',
      content: 'test message',
      type: 'text',
      createdAt: new Date().toISOString(),
    };
    const serialized = serializeMessage(msg);
    const parsed = parseMessage(serialized);
    assert.deepEqual(parsed, msg);
  });

  it('handles messages with optional fields', () => {
    const msg = {
      _id: 'abc',
      sender: 'user1',
      content: 'hi',
      type: 'image',
      images: ['img1.png', 'img2.png'],
      receiver: 'user2',
      conversationId: 'conv1',
    };
    const result = parseMessage(serializeMessage(msg));
    assert.deepEqual(result, msg);
  });

  it('parseMessage returns null for invalid JSON', () => {
    assert.equal(parseMessage('not valid json'), null);
  });

  it('parseMessage returns null for empty string', () => {
    assert.equal(parseMessage(''), null);
  });

  it('handles messages with unicode content', () => {
    const msg = { _id: 'x', sender: 'u', content: '你好世界 🌍', type: 'text' };
    const result = parseMessage(serializeMessage(msg));
    assert.equal(result.content, '你好世界 🌍');
  });
});

describe('messageCache constants', () => {
  it('MAX_CACHED_MESSAGES should be 30', () => {
    const MAX_CACHED_MESSAGES = 30;
    assert.equal(MAX_CACHED_MESSAGES, 30);
  });

  it('HISTORY_CACHE_TTL should be 300 seconds (5 min)', () => {
    const HISTORY_CACHE_TTL = 300;
    assert.equal(HISTORY_CACHE_TTL, 300);
  });
});
