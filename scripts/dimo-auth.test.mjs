import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvFile, serializeEnvFile, jwtExpiry, isLive } from './dimo-auth.mjs';

test('parseEnvFile parses KEY=VALUE lines, ignores comments/blanks', () => {
  const text = '# creds\nDIMO_CLIENT_ID=0xabc\n\nDIMO_DOMAIN=http://localhost:3000/callback\n';
  assert.deepEqual(parseEnvFile(text), {
    DIMO_CLIENT_ID: '0xabc',
    DIMO_DOMAIN: 'http://localhost:3000/callback',
  });
});

test('parseEnvFile keeps = signs inside values', () => {
  assert.deepEqual(parseEnvFile('A=b=c'), { A: 'b=c' });
});

test('serializeEnvFile round-trips', () => {
  const obj = { DIMO_CLIENT_ID: '0xabc', DIMO_PRIVATE_KEY: '0xdef', DIMO_DOMAIN: 'http://x' };
  assert.deepEqual(parseEnvFile(serializeEnvFile(obj)), obj);
});

test('jwtExpiry decodes exp from payload', () => {
  const payload = Buffer.from(JSON.stringify({ exp: 1750000000 })).toString('base64url');
  assert.equal(jwtExpiry(`eyJh.${payload}.sig`), 1750000000);
});

test('jwtExpiry returns 0 for garbage', () => {
  assert.equal(jwtExpiry('not-a-jwt'), 0);
});

test('isLive requires 60s margin', () => {
  const now = Math.floor(Date.now() / 1000);
  const mk = (exp) => `e.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.s`;
  assert.equal(isLive(mk(now + 3600)), true);
  assert.equal(isLive(mk(now + 30)), false);
  assert.equal(isLive(mk(now - 10)), false);
});
