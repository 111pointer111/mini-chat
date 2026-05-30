import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test input validation patterns used across the backend

describe('email validation', () => {
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  it('accepts valid email addresses', () => {
    assert.ok(isValidEmail('user@example.com'));
    assert.ok(isValidEmail('test.user@domain.co'));
    assert.ok(isValidEmail('a@b.c'));
  });

  it('rejects invalid email addresses', () => {
    assert.ok(!isValidEmail(''));
    assert.ok(!isValidEmail('notanemail'));
    assert.ok(isValidEmail('@domain.com') === false);
    assert.ok(isValidEmail('user@') === false);
  });
});

describe('ObjectId validation', () => {
  const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(id);

  it('accepts valid 24-char hex strings', () => {
    assert.ok(isValidObjectId('507f1f77bcf86cd799439011'));
    assert.ok(isValidObjectId('000000000000000000000001'));
  });

  it('rejects invalid ObjectIds', () => {
    assert.ok(!isValidObjectId(''));
    assert.ok(!isValidObjectId('short'));
    assert.ok(!isValidObjectId('507f1f77bcf86cd79943901')); // 23 chars
    assert.ok(!isValidObjectId('507f1f77bcf86cd7994390112')); // 25 chars
    assert.ok(!isValidObjectId('gggggggggggggggggggggggg')); // non-hex
  });
});

describe('password strength', () => {
  const isStrongPassword = (pw) => typeof pw === 'string' && pw.length >= 6;

  it('accepts passwords with 6+ characters', () => {
    assert.ok(isStrongPassword('abcdef'));
    assert.ok(isStrongPassword('strongP@ss1'));
  });

  it('rejects short passwords', () => {
    assert.ok(!isStrongPassword(''));
    assert.ok(!isStrongPassword('12345'));
    assert.ok(!isStrongPassword('a'));
  });

  it('rejects non-string input', () => {
    assert.ok(!isStrongPassword(null));
    assert.ok(!isStrongPassword(undefined));
    assert.ok(!isStrongPassword(123456));
  });
});

describe('pushTime format validation', () => {
  const isValidPushTime = (t) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(t);

  it('accepts valid HH:MM times', () => {
    assert.ok(isValidPushTime('00:00'));
    assert.ok(isValidPushTime('09:30'));
    assert.ok(isValidPushTime('23:59'));
    assert.ok(isValidPushTime('12:00'));
  });

  it('rejects invalid times', () => {
    assert.ok(!isValidPushTime(''));
    assert.ok(!isValidPushTime('24:00'));
    assert.ok(!isValidPushTime('12:60'));
    assert.ok(!isValidPushTime('9:30'));
    assert.ok(!isValidPushTime('noon'));
  });
});

describe('conversation type validation', () => {
  const VALID_TYPES = ['ai', 'friend', 'group', 'scheduled_task'];
  const isValidType = (t) => VALID_TYPES.includes(t);

  it('accepts valid conversation types', () => {
    for (const t of VALID_TYPES) {
      assert.ok(isValidType(t), `expected ${t} to be valid`);
    }
  });

  it('rejects invalid conversation types', () => {
    assert.ok(!isValidType(''));
    assert.ok(!isValidType('channel'));
    assert.ok(!isValidType('AI'));
  });
});
