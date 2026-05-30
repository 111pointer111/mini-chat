import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test message content formatting and processing

describe('markdown-lite formatting', () => {
  const formatMessage = (text) =>
    text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');

  it('converts bold markers', () => {
    assert.equal(formatMessage('**bold**'), '<strong>bold</strong>');
  });

  it('converts italic markers', () => {
    assert.equal(formatMessage('*italic*'), '<em>italic</em>');
  });

  it('converts inline code', () => {
    assert.equal(formatMessage('`code`'), '<code>code</code>');
  });

  it('handles mixed formatting', () => {
    const result = formatMessage('**bold** and *italic* and `code`');
    assert.ok(result.includes('<strong>bold</strong>'));
    assert.ok(result.includes('<em>italic</em>'));
    assert.ok(result.includes('<code>code</code>'));
  });

  it('leaves plain text unchanged', () => {
    assert.equal(formatMessage('no formatting here'), 'no formatting here');
  });
});

describe('message length limits', () => {
  const MAX_MESSAGE_LENGTH = 5000;
  const isValidMessageLength = (text) => text.length > 0 && text.length <= MAX_MESSAGE_LENGTH;

  it('accepts messages within limit', () => {
    assert.ok(isValidMessageLength('hello'));
    assert.ok(isValidMessageLength('a'.repeat(5000)));
  });

  it('rejects empty messages', () => {
    assert.ok(!isValidMessageLength(''));
  });

  it('rejects messages over limit', () => {
    assert.ok(!isValidMessageLength('a'.repeat(5001)));
  });
});

describe('image URL validation', () => {
  const isValidImageUrl = (url) => {
    try {
      const parsed = new URL(url);
      return /\.(jpg|jpeg|png|gif|webp)$/i.test(parsed.pathname);
    } catch {
      return false;
    }
  };

  it('accepts valid image URLs', () => {
    assert.ok(isValidImageUrl('https://example.com/photo.jpg'));
    assert.ok(isValidImageUrl('https://cdn.test/img.png'));
    assert.ok(isValidImageUrl('https://host/a.gif'));
    assert.ok(isValidImageUrl('https://host/b.webp'));
  });

  it('rejects non-image URLs', () => {
    assert.ok(!isValidImageUrl('https://example.com/file.pdf'));
    assert.ok(!isValidImageUrl('https://example.com/page'));
  });

  it('rejects malformed URLs', () => {
    assert.ok(!isValidImageUrl('not a url'));
    assert.ok(!isValidImageUrl(''));
  });
});

describe('file size formatting', () => {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  };

  it('formats bytes', () => {
    assert.equal(formatFileSize(0), '0 B');
    assert.equal(formatFileSize(500), '500 B');
  });

  it('formats kilobytes', () => {
    assert.equal(formatFileSize(1024), '1.0 KB');
    assert.equal(formatFileSize(1536), '1.5 KB');
  });

  it('formats megabytes', () => {
    assert.equal(formatFileSize(1048576), '1.0 MB');
  });
});
