#!/usr/bin/env node
// DIMO auth helper for the dimo Claude Code plugin.
// Owns the credential lifecycle so the skill never touches the private key:
//   setup --client-id 0x.. --private-key 0x.. [--domain URL]
//   status                 → JSON state report
//   vehicle-jwt <tokenId>  → prints a valid Vehicle JWT to stdout
import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIMO_DIR = join(homedir(), '.dimo');
const CREDS_PATH = join(DIMO_DIR, 'credentials.env');
const CACHE_PATH = join(DIMO_DIR, 'jwt-cache.json');
const AUTH_BASE = process.env.DIMO_AUTH_BASE_URL || 'https://auth.dimo.zone';
const EXCHANGE_URL =
  process.env.DIMO_TOKEN_EXCHANGE_URL || 'https://token-exchange-api.dimo.zone/v1/tokens/exchange';
const IDENTITY_URL = process.env.DIMO_IDENTITY_API_URL || 'https://identity-api.dimo.zone/query';
const VEHICLE_NFT = '0xbA5738a18d83D41847dfFbDC6101d37C69c9B0cF';
const ALL_PRIVILEGES = [1, 2, 3, 4, 5, 6, 7, 8];

export function parseEnvFile(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

export function serializeEnvFile(obj) {
  return (
    Object.entries(obj)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n'
  );
}

export function jwtExpiry(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
    return typeof payload.exp === 'number' ? payload.exp : 0;
  } catch {
    return 0;
  }
}

export function isLive(jwt, marginSec = 60) {
  return jwtExpiry(jwt) - marginSec > Date.now() / 1000;
}

// Accepts hex with or without 0x prefix (console keys ship raw, app keys prefixed),
// and tolerates common paste artifacts: whitespace, quotes, a leading `KEY=` label.
export function normalizeHex(value, hexLen) {
  let v = (value || '').trim().replace(/^["']|["']$/g, '');
  const eq = v.indexOf('=');
  if (eq !== -1 && /^[A-Z_]+$/.test(v.slice(0, eq))) v = v.slice(eq + 1).trim();
  if (v.startsWith('0x')) v = v.slice(2);
  return new RegExp(`^[0-9a-fA-F]{${hexLen}}$`).test(v) ? `0x${v}` : null;
}

// Token exchange rejects requests for privileges the grant doesn't include,
// naming them like: "lacks permissions [7 8] for asset ...". Fallback only —
// the primary path reads the grant from the Identity API (privilegesFromSacdMask).
export function parseLackedPrivileges(body) {
  const m = body.match(/lacks permissions \[([\d\s]+)\]/);
  return m ? m[1].trim().split(/\s+/).map(Number) : [];
}

// SACD permissions are a hex bitmask with two bits per privilege: privilege i
// occupies bits 2i and 2i+1 (e.g. 0x3f0c → [1, 4, 5, 6], 0x3fffc → [1..8]).
export function privilegesFromSacdMask(hex) {
  let mask;
  try {
    mask = BigInt(hex);
  } catch {
    return [];
  }
  const out = [];
  for (let i = 1; i <= 8; i++) {
    if (((mask >> BigInt(2 * i)) & 3n) === 3n) out.push(i);
  }
  return out;
}

function readCreds() {
  if (!existsSync(CREDS_PATH)) return null;
  const c = parseEnvFile(readFileSync(CREDS_PATH, 'utf8'));
  if (!c.DIMO_CLIENT_ID || !c.DIMO_PRIVATE_KEY || !c.DIMO_DOMAIN) return null;
  return c;
}

function readCache() {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return { devJwt: null, vehicleJwts: {} };
  }
}

export function pruneExpired(vehicleJwts) {
  return Object.fromEntries(Object.entries(vehicleJwts || {}).filter(([, jwt]) => isLive(jwt)));
}

function writeCache(cache) {
  cache.vehicleJwts = pruneExpired(cache.vehicleJwts);
  writeFileSync(CACHE_PATH, JSON.stringify(cache), { mode: 0o600 });
  chmodSync(CACHE_PATH, 0o600); // mode only applies on create; fix pre-existing files too
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function mintDevJwt(creds) {
  let Wallet;
  try {
    ({ Wallet } = await import('ethers'));
  } catch {
    const scriptsDir = dirname(fileURLToPath(import.meta.url));
    fail(
      `Missing dependencies (a plugin update can reset them). Run:\n` +
        `  npm install --prefix "${scriptsDir}" --silent\nthen retry.`,
    );
  }
  const q = new URLSearchParams({
    client_id: creds.DIMO_CLIENT_ID,
    domain: creds.DIMO_DOMAIN,
    scope: 'openid email',
    response_type: 'code',
    address: creds.DIMO_CLIENT_ID,
  });
  const chRes = await fetch(`${AUTH_BASE}/auth/web3/generate_challenge?${q}`, { method: 'POST' });
  const chText = await chRes.text();
  let challenge, state;
  try {
    ({ challenge, state } = JSON.parse(chText));
  } catch {
    // The auth server renders an HTML page for unknown client_id/domain pairs.
  }
  if (!chRes.ok || !challenge || !state)
    fail(
      `generate_challenge failed (${chRes.status}). ` +
        'Check that DIMO_CLIENT_ID and DIMO_DOMAIN match a license + redirect URI generated in the DIMO app.\n' +
        chText.slice(0, 200),
    );
  const signature = await new Wallet(creds.DIMO_PRIVATE_KEY).signMessage(challenge);
  const subRes = await fetch(`${AUTH_BASE}/auth/web3/submit_challenge`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.DIMO_CLIENT_ID,
      domain: creds.DIMO_DOMAIN,
      grant_type: 'authorization_code',
      state,
      signature,
    }),
  });
  if (!subRes.ok)
    fail(
      `submit_challenge failed: ${subRes.status} ${await subRes.text()}\n` +
        'The API key may have been rotated — generate a new key in the DIMO app and re-run setup.',
    );
  const body = await subRes.json();
  const jwt = body.access_token || body.developer_jwt || body.token;
  if (!jwt) fail(`submit_challenge returned no token: ${JSON.stringify(body)}`);
  return jwt;
}

async function ensureDevJwt(creds, cache) {
  if (cache.devJwt && isLive(cache.devJwt)) return cache.devJwt;
  cache.devJwt = await mintDevJwt(creds);
  writeCache(cache);
  return cache.devJwt;
}

async function cmdVehicleJwt(tokenIdArg, opts) {
  const tokenId = Number.parseInt(tokenIdArg, 10);
  if (!Number.isInteger(tokenId)) fail('usage: dimo-auth.mjs vehicle-jwt <tokenId> [--refresh]');
  const creds = readCreds();
  if (!creds) fail('No credentials. Run setup first.');
  const cache = readCache();
  // --refresh: skip caches after a server-side 401 (revoked key, clock skew).
  if (opts.refresh) cache.devJwt = null;
  const cached = cache.vehicleJwts?.[tokenId];
  if (!opts.refresh && cached && isLive(cached)) {
    console.log(cached);
    return;
  }
  const devJwt = await ensureDevJwt(creds, cache);
  // Primary path: read the actual grant from the public Identity API and request
  // exactly those privileges. Falls back to all 8 + the 403 retry below if the
  // lookup fails (network blip, indexing lag).
  const grantedPrivileges = async () => {
    try {
      const res = await fetch(IDENTITY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{ vehicle(tokenId: ${tokenId}) { sacds(first: 100) { nodes { grantee permissions expiresAt } } } }`,
        }),
      });
      const nodes = (await res.json()).data.vehicle.sacds.nodes;
      const grant = nodes.find(
        (n) =>
          n.grantee.toLowerCase() === creds.DIMO_CLIENT_ID.toLowerCase() &&
          new Date(n.expiresAt).getTime() > Date.now(),
      );
      const privs = grant && privilegesFromSacdMask(grant.permissions);
      return privs?.length ? privs : null;
    } catch {
      return null;
    }
  };
  const exchange = async (privileges) => {
    const res = await fetch(EXCHANGE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${devJwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftContractAddress: VEHICLE_NFT, privileges, tokenId }),
    });
    return { res, text: await res.text() };
  };
  let privileges = (await grantedPrivileges()) || ALL_PRIVILEGES;
  let { res, text } = await exchange(privileges);
  if (res.status === 403) {
    // Grant may cover fewer privileges than we ask for — drop the named ones and retry.
    const lacked = parseLackedPrivileges(text);
    privileges = privileges.filter((p) => !lacked.includes(p));
    if (lacked.length && privileges.length) {
      console.error(`note: license lacks privileges [${lacked.join(', ')}]; retrying with [${privileges.join(', ')}]`);
      ({ res, text } = await exchange(privileges));
    }
  }
  if (!res.ok)
    fail(
      `token exchange failed: ${res.status} ${text}\n` +
        'Confirm the vehicle is shared with this license ("Share all vehicles" in the DIMO app).',
    );
  let token;
  try {
    ({ token } = JSON.parse(text));
  } catch {
    /* fall through to the check below */
  }
  if (!token) fail(`token exchange returned no token: ${text.slice(0, 200)}`);
  cache.vehicleJwts = cache.vehicleJwts || {};
  cache.vehicleJwts[tokenId] = token;
  writeCache(cache);
  console.log(token);
}

function cmdSetup(argv) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  // Values come from flags or, preferably, environment variables (keeps the
  // private key out of argv / `ps` output).
  const clientId = normalizeHex(get('--client-id') ?? process.env.DIMO_CLIENT_ID, 40);
  const privateKey = normalizeHex(get('--private-key') ?? process.env.DIMO_PRIVATE_KEY, 64);
  const domain = get('--domain') || process.env.DIMO_DOMAIN || 'http://localhost:3000/callback';
  if (!clientId || !privateKey)
    fail(
      'usage: dimo-auth.mjs setup --client-id 0x.. --private-key 0x.. [--domain URL]\n' +
        'client-id must be a 20-byte hex address, private-key a 32-byte hex key (0x prefix optional).',
    );
  mkdirSync(DIMO_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(
    CREDS_PATH,
    serializeEnvFile({
      DIMO_CLIENT_ID: clientId,
      DIMO_PRIVATE_KEY: privateKey,
      DIMO_DOMAIN: domain,
    }),
    { mode: 0o600 },
  );
  chmodSync(CREDS_PATH, 0o600); // mode only applies on create; fix pre-existing files too
  writeCache({ devJwt: null, vehicleJwts: {} });
  console.log(JSON.stringify({ ok: true, credsPath: CREDS_PATH }));
}

// Lists vehicles shared with the stored license, via the public Identity API.
// Lives here (not as a curl in the skill) so the GraphQL quoting is done once, safely.
// Pages through the full set — a fleet license can hold far more than one page,
// and a silent `first: 100` cap would hide vehicles from the user.
export function vehiclesQuery(clientId, after) {
  const cursor = after ? `, after: "${after}"` : '';
  return `{ vehicles(filterBy: {privileged: "${clientId}"}, first: 100${cursor}) { totalCount pageInfo { hasNextPage endCursor } nodes { tokenId definition { make model year } } } }`;
}

export function vehicleName(node) {
  return [node.definition?.year, node.definition?.make, node.definition?.model].filter(Boolean).join(' ');
}

async function cmdVehicles() {
  const creds = readCreds();
  if (!creds) fail('No credentials. Run setup first.');
  const out = [];
  let after = null;
  let totalCount = 0;
  // Bounded so a pagination bug can never spin forever.
  for (let page = 0; page < 50; page++) {
    const res = await fetch(IDENTITY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: vehiclesQuery(creds.DIMO_CLIENT_ID, after) }),
    });
    const text = await res.text();
    let v;
    try {
      v = JSON.parse(text).data.vehicles;
    } catch {
      fail(`identity query failed: ${res.status} ${text.slice(0, 200)}`);
    }
    totalCount = v.totalCount ?? out.length + v.nodes.length;
    for (const n of v.nodes) out.push({ tokenId: n.tokenId, name: vehicleName(n) });
    if (!v.pageInfo?.hasNextPage) break;
    after = v.pageInfo.endCursor;
  }
  // Only reachable if the page bound above is hit; flagged so the skill never
  // reports a total it did not actually enumerate.
  const truncated = out.length < totalCount;
  console.log(JSON.stringify({ totalCount, truncated, vehicles: out }));
}

function cmdStatus() {
  const creds = readCreds();
  const cache = readCache();
  console.log(
    JSON.stringify({
      credentials: !!creds,
      clientId: creds?.DIMO_CLIENT_ID || null,
      devJwt: cache.devJwt ? (isLive(cache.devJwt) ? 'valid' : 'expired') : 'none',
    }),
  );
}

const [, , cmd, ...rest] = process.argv;
if (cmd === 'setup') cmdSetup(rest);
else if (cmd === 'status') cmdStatus();
else if (cmd === 'vehicles') await cmdVehicles();
else if (cmd === 'vehicle-jwt')
  await cmdVehicleJwt(rest.find((a) => !a.startsWith('--')), { refresh: rest.includes('--refresh') });
// Bare import (e.g. from the test file) leaves cmd undefined and argv[1] as the
// importer's path — only error when this file was actually invoked as a CLI.
else if (cmd !== undefined || process.argv[1]?.endsWith('dimo-auth.mjs'))
  fail('usage: dimo-auth.mjs <setup|status|vehicles|vehicle-jwt [tokenId] [--refresh]>');
