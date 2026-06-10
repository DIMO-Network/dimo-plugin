#!/usr/bin/env node
// DIMO auth helper for the dimo Claude Code plugin.
// Owns the credential lifecycle so the skill never touches the private key:
//   setup --client-id 0x.. --private-key 0x.. [--domain URL]
//   status                 → JSON state report
//   vehicle-jwt <tokenId>  → prints a valid Vehicle JWT to stdout
import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DIMO_DIR = join(homedir(), '.dimo');
const CREDS_PATH = join(DIMO_DIR, 'credentials.env');
const CACHE_PATH = join(DIMO_DIR, 'jwt-cache.json');
const AUTH_BASE = process.env.DIMO_AUTH_BASE_URL || 'https://auth.dimo.zone';
const EXCHANGE_URL =
  process.env.DIMO_TOKEN_EXCHANGE_URL || 'https://token-exchange-api.dimo.zone/v1/tokens/exchange';
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

// Accepts hex with or without 0x prefix (console keys ship raw, app keys prefixed).
export function normalizeHex(value, hexLen) {
  const v = value?.startsWith('0x') ? value.slice(2) : value;
  return v && new RegExp(`^[0-9a-fA-F]{${hexLen}}$`).test(v) ? `0x${v}` : null;
}

// Token exchange rejects requests for privileges the grant doesn't include,
// naming them like: "lacks permissions [7 8] for asset ...".
export function parseLackedPrivileges(body) {
  const m = body.match(/lacks permissions \[([\d\s]+)\]/);
  return m ? m[1].trim().split(/\s+/).map(Number) : [];
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

function writeCache(cache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache));
  chmodSync(CACHE_PATH, 0o600);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function mintDevJwt(creds) {
  const { Wallet } = await import('ethers');
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

async function cmdVehicleJwt(tokenIdArg) {
  const tokenId = Number.parseInt(tokenIdArg, 10);
  if (!Number.isInteger(tokenId)) fail('usage: dimo-auth.mjs vehicle-jwt <tokenId>');
  const creds = readCreds();
  if (!creds) fail('No credentials. Run setup first.');
  const cache = readCache();
  const cached = cache.vehicleJwts?.[tokenId];
  if (cached && isLive(cached)) {
    console.log(cached);
    return;
  }
  const devJwt = await ensureDevJwt(creds, cache);
  const exchange = (privileges) =>
    fetch(EXCHANGE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${devJwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftContractAddress: VEHICLE_NFT, privileges, tokenId }),
    });
  let privileges = ALL_PRIVILEGES;
  let res = await exchange(privileges);
  if (res.status === 403) {
    // Grant may cover fewer privileges than we ask for — drop the named ones and retry.
    const lacked = parseLackedPrivileges(await res.text());
    privileges = privileges.filter((p) => !lacked.includes(p));
    if (lacked.length && privileges.length) res = await exchange(privileges);
  }
  if (!res.ok)
    fail(
      `token exchange failed: ${res.status} ${await res.text()}\n` +
        'Confirm the vehicle is shared with this license ("Share all vehicles" in the DIMO app).',
    );
  const { token } = await res.json();
  if (!token) fail('token exchange returned no token');
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
  const clientId = normalizeHex(get('--client-id'), 40);
  const privateKey = normalizeHex(get('--private-key'), 64);
  const domain = get('--domain') || 'http://localhost:3000/callback';
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
  );
  chmodSync(CREDS_PATH, 0o600);
  writeCache({ devJwt: null, vehicleJwts: {} });
  console.log(JSON.stringify({ ok: true, credsPath: CREDS_PATH }));
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
else if (cmd === 'vehicle-jwt') await cmdVehicleJwt(rest[0]);
else if (cmd !== undefined) fail('usage: dimo-auth.mjs <setup|status|vehicle-jwt>');
else if (process.argv[1]?.endsWith('dimo-auth.mjs'))
  fail('usage: dimo-auth.mjs <setup|status|vehicle-jwt>');
