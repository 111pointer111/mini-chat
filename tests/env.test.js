import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test environment and configuration validation patterns

describe('required environment variables', () => {
  const validateEnv = (env, required) => {
    const missing = required.filter(key => !env[key] || env[key].trim() === '');
    return { valid: missing.length === 0, missing };
  };

  it('passes when all required vars are present', () => {
    const result = validateEnv(
      { JWT_SECRET: 'secret', MONGO_URI: 'mongodb://localhost' },
      ['JWT_SECRET', 'MONGO_URI']
    );
    assert.ok(result.valid);
    assert.deepEqual(result.missing, []);
  });

  it('fails when required vars are missing', () => {
    const result = validateEnv({}, ['JWT_SECRET', 'MONGO_URI']);
    assert.ok(!result.valid);
    assert.deepEqual(result.missing, ['JWT_SECRET', 'MONGO_URI']);
  });

  it('fails when required vars are empty strings', () => {
    const result = validateEnv({ JWT_SECRET: '  ' }, ['JWT_SECRET']);
    assert.ok(!result.valid);
    assert.deepEqual(result.missing, ['JWT_SECRET']);
  });

  it('ignores extra env vars not in required list', () => {
    const result = validateEnv(
      { JWT_SECRET: 's', EXTRA: 'ignored' },
      ['JWT_SECRET']
    );
    assert.ok(result.valid);
  });
});

describe('CORS origins parsing', () => {
  const parseCorsOrigins = (raw) =>
    raw.split(',').map(s => s.trim()).filter(Boolean);

  it('parses comma-separated origins', () => {
    assert.deepEqual(
      parseCorsOrigins('http://localhost:5173,http://localhost:5174'),
      ['http://localhost:5173', 'http://localhost:5174']
    );
  });

  it('handles single origin', () => {
    assert.deepEqual(parseCorsOrigins('http://localhost:5173'), ['http://localhost:5173']);
  });

  it('trims whitespace', () => {
    assert.deepEqual(
      parseCorsOrigins(' http://a.com , http://b.com '),
      ['http://a.com', 'http://b.com']
    );
  });

  it('filters empty segments', () => {
    assert.deepEqual(parseCorsOrigins('a,,b,'), ['a', 'b']);
  });
});

describe('AI provider config resolution', () => {
  const resolveConfig = (userProvider, defaultProvider, envVars) => {
    if (userProvider?.baseURL && userProvider?.apiKey && userProvider?.modelName) {
      return { source: 'user', ...userProvider };
    }
    if (defaultProvider?.baseURL && defaultProvider?.apiKey && defaultProvider?.modelName) {
      return { source: 'default', ...defaultProvider };
    }
    if (envVars.AI_BASE_URL && envVars.AI_API_KEY && envVars.AI_MODEL) {
      return { source: 'env', baseURL: envVars.AI_BASE_URL, apiKey: envVars.AI_API_KEY, modelName: envVars.AI_MODEL };
    }
    return null;
  };

  it('prefers user provider', () => {
    const result = resolveConfig(
      { baseURL: 'https://user.api', apiKey: 'k1', modelName: 'gpt-4' },
      { baseURL: 'https://default.api', apiKey: 'k2', modelName: 'gpt-3.5' },
      {}
    );
    assert.equal(result.source, 'user');
  });

  it('falls back to default provider', () => {
    const result = resolveConfig(
      null,
      { baseURL: 'https://default.api', apiKey: 'k2', modelName: 'gpt-3.5' },
      {}
    );
    assert.equal(result.source, 'default');
  });

  it('falls back to env vars', () => {
    const result = resolveConfig(null, null, {
      AI_BASE_URL: 'https://env.api',
      AI_API_KEY: 'k3',
      AI_MODEL: 'gpt-4o',
    });
    assert.equal(result.source, 'env');
  });

  it('returns null when nothing is configured', () => {
    assert.equal(resolveConfig(null, null, {}), null);
  });

  it('skips incomplete user provider', () => {
    const result = resolveConfig(
      { baseURL: 'https://api' },
      { baseURL: 'https://default.api', apiKey: 'k', modelName: 'm' },
      {}
    );
    assert.equal(result.source, 'default');
  });
});
