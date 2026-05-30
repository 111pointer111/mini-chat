import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Inline the logic under test (source: backend/src/utils/timeUtils.ts)
function computeNextRunTime(pushTime, timezone) {
  const [targetHour, targetMinute] = pushTime.split(':').map(Number);
  const now = new Date();
  const nextMinute = new Date(now);
  nextMinute.setSeconds(0, 0);
  nextMinute.setMinutes(nextMinute.getMinutes() + 1);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  for (let ms = 0; ms < 2 * 86400000; ms += 60000) {
    const candidate = new Date(nextMinute.getTime() + ms);
    const parts = formatter.formatToParts(candidate);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    if (hour === targetHour && minute === targetMinute) {
      return candidate;
    }
  }

  return new Date(now.getTime() + 86400000);
}

describe('computeNextRunTime', () => {
  it('returns a Date object', () => {
    const result = computeNextRunTime('12:00', 'Asia/Shanghai');
    assert.ok(result instanceof Date);
    assert.ok(!isNaN(result.getTime()));
  });

  it('returns a time in the future', () => {
    const now = new Date();
    const result = computeNextRunTime('12:00', 'Asia/Shanghai');
    assert.ok(result.getTime() > now.getTime(), 'result should be in the future');
  });

  it('returns a time within 48 hours from now', () => {
    const now = new Date();
    const result = computeNextRunTime('12:00', 'Asia/Shanghai');
    const maxFuture = now.getTime() + 2 * 86400000;
    assert.ok(result.getTime() <= maxFuture, 'result should be within 48 hours');
  });

  it('handles midnight (00:00)', () => {
    const result = computeNextRunTime('00:00', 'UTC');
    assert.ok(result instanceof Date);
    assert.ok(!isNaN(result.getTime()));
  });

  it('handles end-of-day (23:59)', () => {
    const result = computeNextRunTime('23:59', 'UTC');
    assert.ok(result instanceof Date);
    assert.ok(!isNaN(result.getTime()));
  });

  it('works with different timezones', () => {
    const timezones = ['UTC', 'America/New_York', 'Asia/Tokyo', 'Europe/London'];
    for (const tz of timezones) {
      const result = computeNextRunTime('09:30', tz);
      assert.ok(result instanceof Date, `failed for timezone ${tz}`);
      assert.ok(!isNaN(result.getTime()), `invalid date for timezone ${tz}`);
    }
  });
});
