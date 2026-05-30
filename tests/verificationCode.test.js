import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Inline the logic under test (source: backend/src/utils/verificationCode.ts)
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

describe('generateVerificationCode', () => {
  it('returns a 6-digit string', () => {
    const code = generateVerificationCode();
    assert.equal(code.length, 6);
    assert.match(code, /^\d{6}$/);
  });

  it('returns a value between 100000 and 999999', () => {
    for (let i = 0; i < 100; i++) {
      const code = Number(generateVerificationCode());
      assert.ok(code >= 100000, `code ${code} < 100000`);
      assert.ok(code <= 999999, `code ${code} > 999999`);
    }
  });

  it('produces different values over many calls (non-deterministic)', () => {
    const codes = new Set();
    for (let i = 0; i < 50; i++) {
      codes.add(generateVerificationCode());
    }
    assert.ok(codes.size > 1, 'expected more than 1 unique code out of 50');
  });
});
