import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test general-purpose helper patterns used in the codebase

describe('paginate', () => {
  const paginate = (total, page = 1, limit = 20) => {
    const totalPages = Math.ceil(total / limit);
    return {
      total,
      page: Math.max(1, Math.min(page, totalPages || 1)),
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  };

  it('calculates total pages correctly', () => {
    assert.equal(paginate(100, 1, 20).totalPages, 5);
    assert.equal(paginate(0, 1, 20).totalPages, 0);
    assert.equal(paginate(1, 1, 20).totalPages, 1);
  });

  it('clamps page to valid range', () => {
    assert.equal(paginate(100, 0, 20).page, 1);
    assert.equal(paginate(100, 999, 20).page, 5);
  });

  it('sets hasNext and hasPrev correctly', () => {
    const first = paginate(100, 1, 20);
    assert.ok(!first.hasPrev);
    assert.ok(first.hasNext);

    const middle = paginate(100, 3, 20);
    assert.ok(middle.hasPrev);
    assert.ok(middle.hasNext);

    const last = paginate(100, 5, 20);
    assert.ok(last.hasPrev);
    assert.ok(!last.hasNext);
  });

  it('handles empty results', () => {
    const result = paginate(0, 1, 20);
    assert.equal(result.total, 0);
    assert.equal(result.totalPages, 0);
    assert.equal(result.page, 1);
  });
});

describe('sanitizeHtml (basic)', () => {
  const sanitizeHtml = (input) =>
    input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  it('escapes HTML special characters', () => {
    assert.equal(sanitizeHtml('<script>alert("xss")</script>'),
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('passes through plain text unchanged', () => {
    assert.equal(sanitizeHtml('hello world'), 'hello world');
  });

  it('handles empty string', () => {
    assert.equal(sanitizeHtml(''), '');
  });

  it('escapes ampersands', () => {
    assert.equal(sanitizeHtml('a & b'), 'a &amp; b');
  });
});

describe('truncate', () => {
  const truncate = (str, maxLen) =>
    str.length > maxLen ? str.slice(0, maxLen) + '...' : str;

  it('truncates long strings', () => {
    assert.equal(truncate('hello world', 5), 'hello...');
  });

  it('leaves short strings unchanged', () => {
    assert.equal(truncate('hi', 10), 'hi');
  });

  it('handles exact length', () => {
    assert.equal(truncate('hello', 5), 'hello');
  });
});

describe('parseMentions', () => {
  const parseMentions = (text) => {
    const matches = text.match(/@\S+/g) || [];
    return [...new Set(matches)];
  };

  it('extracts @mentions from text', () => {
    assert.deepEqual(parseMentions('hello @user1 and @user2'), ['@user1', '@user2']);
  });

  it('deduplicates mentions', () => {
    assert.deepEqual(parseMentions('@user1 @user1 @user1'), ['@user1']);
  });

  it('returns empty array when no mentions', () => {
    assert.deepEqual(parseMentions('no mentions here'), []);
  });

  it('handles AI assistant triggers', () => {
    const mentions = parseMentions('请 @小助手 帮我解答');
    assert.ok(mentions.includes('@小助手'));
  });
});

describe('clamp', () => {
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  it('clamps value below minimum', () => {
    assert.equal(clamp(-5, 0, 100), 0);
  });

  it('clamps value above maximum', () => {
    assert.equal(clamp(150, 0, 100), 100);
  });

  it('returns value within range unchanged', () => {
    assert.equal(clamp(50, 0, 100), 50);
  });
});
