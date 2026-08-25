import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEnvFile,
  serializeEnvFile,
  jwtExpiry,
  isLive,
  normalizeHex,
  parseLackedPrivileges,
  privilegesFromSacdMask,
  pruneExpired,
  vehiclesQuery,
  vehicleName,
} from './dimo-auth.mjs';

test('privilegesFromSacdMask decodes 2-bits-per-privilege masks', () => {
  assert.deepEqual(privilegesFromSacdMask('0x3fffc'), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(privilegesFromSacdMask('0x3f0c'), [1, 4, 5, 6]);
  assert.deepEqual(privilegesFromSacdMask('0x0'), []);
  assert.deepEqual(privilegesFromSacdMask('garbage'), []);
});

test('pruneExpired drops dead JWTs, keeps live ones, tolerates empty input', () => {
  const now = Math.floor(Date.now() / 1000);
  const mk = (exp) => `e.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.s`;
  const pruned = pruneExpired({ 1: mk(now - 100), 2: mk(now + 3600) });
  assert.deepEqual(Object.keys(pruned), ['2']);
  assert.deepEqual(pruneExpired(undefined), {});
});

test('normalizeHex adds 0x to raw hex, keeps prefixed, rejects junk', () => {
  const raw = 'a'.repeat(64);
  assert.equal(normalizeHex(raw, 64), `0x${raw}`);
  assert.equal(normalizeHex(`0x${raw}`, 64), `0x${raw}`);
  assert.equal(normalizeHex('zz', 64), null);
  assert.equal(normalizeHex('a'.repeat(63), 64), null);
});

test('normalizeHex tolerates pasted whitespace, quotes, and KEY= prefixes', () => {
  const raw = 'b'.repeat(64);
  assert.equal(normalizeHex(` 0x${raw}\n`, 64), `0x${raw}`);
  assert.equal(normalizeHex(`DIMO_PRIVATE_KEY=0x${raw}`, 64), `0x${raw}`);
  assert.equal(normalizeHex(`"0x${raw}"`, 64), `0x${raw}`);
});

test('parseLackedPrivileges extracts missing privilege list from 403 body', () => {
  const body =
    '{"code":403,"message":"Address 0xb9 lacks permissions [7 8] for asset did:erc721:137:0xbA…:183644."}';
  assert.deepEqual(parseLackedPrivileges(body), [7, 8]);
  assert.deepEqual(parseLackedPrivileges('no match'), []);
});

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

test('vehiclesQuery omits the cursor on the first page and includes it after', () => {
  const first = vehiclesQuery('0xabc', null);
  assert.ok(first.includes('privileged: "0xabc"'));
  assert.ok(first.includes('first: 100)'));
  assert.ok(!first.includes('after:'));
  assert.ok(first.includes('totalCount'));
  assert.ok(first.includes('hasNextPage'));
  const next = vehiclesQuery('0xabc', 'MTkzMzQ2');
  assert.ok(next.includes('first: 100, after: "MTkzMzQ2"'));
});

test('vehicleName joins year/make/model and tolerates missing pieces', () => {
  assert.equal(vehicleName({ definition: { year: 2025, make: 'Ram', model: '1500' } }), '2025 Ram 1500');
  assert.equal(vehicleName({ definition: { make: 'Ram' } }), 'Ram');
  assert.equal(vehicleName({}), '');
});
