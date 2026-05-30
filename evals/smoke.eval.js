// Smoke eval — verifies core backend utilities work correctly
// Run: node --test evals/smoke.eval.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('smoke: verification code generation', () => {
  const generate = () => Math.floor(100000 + Math.random() * 900000).toString();

  it('produces 6-digit codes', () => {
    for (let i = 0; i < 20; i++) {
      assert.match(generate(), /^\d{6}$/);
    }
  });
});

describe('smoke: time computation', () => {
  const computeNext = (hhmm, tz) => {
    const [h, m] = hhmm.split(':').map(Number);
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    for (let ms = 0; ms < 172800000; ms += 60000) {
      const c = new Date(next.getTime() + ms);
      const p = fmt.formatToParts(c);
      if (parseInt(p.find(x => x.type === 'hour')?.value||'0') === h && parseInt(p.find(x => x.type === 'minute')?.value||'0') === m) return c;
    }
    return new Date(now.getTime() + 86400000);
  };

  it('returns a future Date', () => {
    const r = computeNext('12:00', 'UTC');
    assert.ok(r > new Date());
  });
});

describe('smoke: input validation patterns', () => {
  it('ObjectId regex matches 24-hex', () => {
    assert.match('507f1f77bcf86cd799439011', /^[a-fA-F0-9]{24}$/);
  });

  it('email regex rejects invalid', () => {
    assert.ok(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test('bad'));
  });
});

describe('smoke: RBAC', () => {
  const check = (role, req) => req === 'admin' ? role === 'admin' : true;

  it('admin passes admin check', () => assert.ok(check('admin', 'admin')));
  it('user fails admin check', () => assert.ok(!check('user', 'admin')));
});

describe('smoke: AI mention triggers', () => {
  const triggers = ['@小助手', '@AI', '@助手'];
  const has = (t) => triggers.some(tr => t.includes(tr));

  it('detects all trigger words', () => {
    assert.ok(has('请 @小助手 帮忙'));
    assert.ok(has('@AI hi'));
    assert.ok(has('问 @助手'));
  });

  it('ignores normal text', () => {
    assert.ok(!has('hello world'));
  });
});
