# Skill-Side Auth + Mobile-App Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace console-JWT-paste onboarding with mobile-app credential setup plus a bundled auth helper script that silently maintains Developer/Vehicle JWTs.

**Architecture:** All data queries stay on the hosted Telemetry MCP endpoint (curl, Vehicle JWT bearer) exactly as today. A new `scripts/dimo-auth.mjs` CLI owns the credential lifecycle: store the 3 values from the DIMO mobile app, mint Developer JWT via the Auth API web3 challenge flow (EIP-191 signature with ethers), exchange for per-vehicle JWTs with caching. SKILL.md is rewritten so the preview form collects credentials once, vehicles are auto-discovered via the public Identity API `privileged` filter, and 401s trigger silent refresh.

**Tech Stack:** Node >= 20 (`node:test` for tests), ethers v6 (only dep, installed in `scripts/`), curl, existing Claude Preview UI.

**Repo:** `/Users/zer0stars/workspace/dimo-plugin` (all paths relative to it)

**Verified API facts (from @dimo-network/data-sdk source and dimo-driver identity schema):**
- Challenge: `POST https://auth.dimo.zone/auth/web3/generate_challenge?client_id=<CID>&domain=<DOMAIN>&scope=openid%20email&response_type=code&address=<CID>` → `{"challenge": "...", "state": "..."}`
- Sign: EIP-191 personal sign of `challenge` string with the license private key (`new ethers.Wallet(pk).signMessage(challenge)`)
- Submit: `POST https://auth.dimo.zone/auth/web3/submit_challenge`, `Content-Type: application/x-www-form-urlencoded`, fields `client_id, domain, grant_type=authorization_code, state, signature` → `{"access_token": "<DEV_JWT>", ...}`
- Vehicle JWT: `POST https://token-exchange-api.dimo.zone/v1/tokens/exchange`, Bearer DEV_JWT, JSON `{"nftContractAddress":"0xbA5738a18d83D41847dfFbDC6101d37C69c9B0cF","privileges":[1,2,3,4,5,6,7,8],"tokenId":<N>}` → `{"token":"<VEHICLE_JWT>"}`
- Vehicle discovery: `POST https://identity-api.dimo.zone/query` (public GraphQL): `vehicles(filterBy: {privileged: "<CLIENT_ID>"}, first: 100) { nodes { tokenId definition { make model year } } }`
- Mobile app screen path: DIMO app → Account → Advanced settings → Developer API Key → "Generate API key" → "Share all vehicles"; shows copyable `DIMO_CLIENT_ID`, `DIMO_PRIVATE_KEY`, `DIMO_DOMAIN` (domain defaults to `http://localhost:3000/callback`).

---

### Task 1: Auth script pure helpers + tests

**Files:**
- Create: `scripts/package.json`
- Create: `scripts/dimo-auth.mjs`
- Test: `scripts/dimo-auth.test.mjs`

- [ ] **Step 1: Create `scripts/package.json`**

```json
{
  "name": "dimo-plugin-scripts",
  "private": true,
  "type": "module",
  "dependencies": {
    "ethers": "^6.13.0"
  }
}
```

- [ ] **Step 2: Write failing tests for pure helpers**

Create `scripts/dimo-auth.test.mjs`:

```javascript
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
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `cd /Users/zer0stars/workspace/dimo-plugin/scripts && node --test dimo-auth.test.mjs`
Expected: FAIL (cannot find module `./dimo-auth.mjs`)

- [ ] **Step 4: Create `scripts/dimo-auth.mjs` with helpers + CLI skeleton**

```javascript
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
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n';
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
  if (!chRes.ok) fail(`generate_challenge failed: ${chRes.status} ${await chRes.text()}`);
  const { challenge, state } = await chRes.json();
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
  const creds = readCreds() || fail('No credentials. Run setup first.');
  const cache = readCache();
  const cached = cache.vehicleJwts?.[tokenId];
  if (cached && isLive(cached)) {
    console.log(cached);
    return;
  }
  const devJwt = await ensureDevJwt(creds, cache);
  const res = await fetch(EXCHANGE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${devJwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ nftContractAddress: VEHICLE_NFT, privileges: ALL_PRIVILEGES, tokenId }),
  });
  if (!res.ok)
    fail(
      `token exchange failed: ${res.status} ${await res.text()}\n` +
        'Confirm the vehicle is shared with this license ("Share all vehicles" in the DIMO app).',
    );
  const { token } = await res.json();
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
  const clientId = get('--client-id');
  const privateKey = get('--private-key');
  const domain = get('--domain') || 'http://localhost:3000/callback';
  if (!clientId?.startsWith('0x') || !privateKey?.startsWith('0x'))
    fail('usage: dimo-auth.mjs setup --client-id 0x.. --private-key 0x.. [--domain URL]');
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
else if (cmd !== undefined || process.argv[1]?.endsWith('dimo-auth.mjs')) {
  // Allow import for tests without printing usage.
  if (cmd !== undefined) fail('usage: dimo-auth.mjs <setup|status|vehicle-jwt>');
}
```

Note: the trailing dispatch block must not run commands when the file is
imported by the test. The structure above only errors when an unknown `cmd`
is present; bare import (`cmd === undefined`) is a no-op.

- [ ] **Step 5: Run tests, verify they pass**

Run: `cd /Users/zer0stars/workspace/dimo-plugin/scripts && node --test dimo-auth.test.mjs`
Expected: 6 pass, 0 fail. (Tests import only pure helpers; no network, no ethers needed.)

- [ ] **Step 6: Smoke-test CLI surface without credentials**

```bash
cd /Users/zer0stars/workspace/dimo-plugin/scripts
node dimo-auth.mjs status        # → {"credentials":false,...} OR existing state if ~/.dimo exists
node dimo-auth.mjs bogus; echo "exit=$?"   # → usage message, exit=1
```

- [ ] **Step 7: Commit**

```bash
cd /Users/zer0stars/workspace/dimo-plugin
git add scripts/
git commit -m "feat: dimo-auth helper script — credential store, dev JWT mint, vehicle JWT exchange"
```

---

### Task 2: Live verification of the auth flow (manual, uses real creds)

**Files:** none (verification only)

- [ ] **Step 1: Install script deps**

Run: `npm install --prefix /Users/zer0stars/workspace/dimo-plugin/scripts --silent`
Expected: `ethers` in `scripts/node_modules`, no errors.

- [ ] **Step 2: Verify `node_modules` is ignored**

`scripts/node_modules` must not be committable. Check repo root `.gitignore`; if missing, add:

```
node_modules/
```

and commit: `git add .gitignore && git commit -m "chore: ignore node_modules"`

- [ ] **Step 3: Live mint + exchange (requires the 3 values from the DIMO app — ask the user to paste them, or skip if unavailable and mark this task deferred)**

```bash
node /Users/zer0stars/workspace/dimo-plugin/scripts/dimo-auth.mjs setup \
  --client-id <FROM_APP> --private-key <FROM_APP> --domain <FROM_APP>
node /Users/zer0stars/workspace/dimo-plugin/scripts/dimo-auth.mjs status
# → {"credentials":true, "devJwt":"none", ...}
node /Users/zer0stars/workspace/dimo-plugin/scripts/dimo-auth.mjs vehicle-jwt <TOKEN_ID>
# → prints a JWT; second invocation must return instantly (cache hit)
```

Then one real query:

```bash
JWT=$(node /Users/zer0stars/workspace/dimo-plugin/scripts/dimo-auth.mjs vehicle-jwt <TOKEN_ID>)
curl -s -X POST "https://telemetry-api.dimo.zone/mcp" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"telemetry_get_available_signals","arguments":{"tokenId":<TOKEN_ID>}},"id":1}'
```

Expected: signal list JSON, not 401. Fix script against real responses if field names differ (e.g. `access_token` vs `token`), re-run Task 1 tests, amend commit.

---

### Task 3: SKILL.md rewrite — preview form collects app credentials

**Files:**
- Modify: `skills/dimo/SKILL.md`

- [ ] **Step 1: Update frontmatter** (`skills/dimo/SKILL.md:1-7`)

Replace `argument-hint: "[developer-jwt] [token-id]"` with `argument-hint: ""` removed entirely, and bump `version: 0.1.0` → `version: 0.2.0`. Description stays.

- [ ] **Step 2: Replace the preview "Credentials" pane** (HTML inside the startup template, `#pane-jwt` block and its JS)

Replace the `#pane-jwt` div content (currently Developer JWT + Token ID fields, SKILL.md lines ~100-119) with:

```html
<div id="pane-jwt">
  <div class="page-head">
    <div class="section-label"><span class="rule"></span><span class="label-text">Credentials</span></div>
    <div class="display">Connect<br>DIMO.</div>
    <p class="prose">In the DIMO app: Account → Advanced settings → Developer API Key → Generate API key. Then paste the three values below.</p>
  </div>
  <div class="pane">
    <p class="form-note">VALUES STAY ON THIS MACHINE — STORED IN ~/.dimo/credentials.env (CHMOD 600).</p>
    <div class="field-group">
      <label class="field-label">DIMO_CLIENT_ID</label>
      <textarea id="clientId" rows="1" placeholder="0x..."></textarea>
    </div>
    <div class="field-group">
      <label class="field-label">DIMO_PRIVATE_KEY</label>
      <textarea id="privateKey" rows="1" placeholder="0x... (tap the eye icon in the app to reveal, then copy)"></textarea>
    </div>
    <div class="field-group">
      <label class="field-label">DIMO_DOMAIN</label>
      <textarea id="domain" rows="1" placeholder="http://localhost:3000/callback"></textarea>
    </div>
    <button class="btn-red" id="submitBtn">Save credentials</button>
    <div id="jwtResult"></div>
  </div>
</div>
```

And replace the `submitBtn` click handler JS (currently capturing `devJwt`/`tokenId`) with:

```javascript
document.getElementById('submitBtn').addEventListener('click',()=>{
  const btn=document.getElementById('submitBtn');
  const clientId=document.getElementById('clientId').value.trim();
  const privateKey=document.getElementById('privateKey').value.trim();
  const domain=document.getElementById('domain').value.trim()||'http://localhost:3000/callback';
  const r=document.getElementById('jwtResult');
  r.textContent='';
  if(!clientId.startsWith('0x')||!privateKey.startsWith('0x')){
    const card=document.createElement('div');card.className='result-card';
    const msg=document.createElement('p');msg.className='result-status status-err';
    msg.textContent='CLIENT ID AND PRIVATE KEY MUST START WITH 0x.';
    card.appendChild(msg);r.appendChild(card);return;
  }
  window.__dimoFormData={clientId,privateKey,domain,submitted:true};
  btn.textContent='SAVED — TELL CLAUDE';btn.disabled=true;btn.style.opacity='.6';
  const card=document.createElement('div');card.className='result-card';
  const msg=document.createElement('p');msg.className='result-status';msg.style.color='#8E8E8E';
  msg.textContent='CREDENTIALS CAPTURED — SEND ANY MESSAGE TO CONTINUE';
  card.appendChild(msg);r.appendChild(card);
});
```

Tab label `JWT Exchange` → `Setup`. Everything else in the template (signals pane, loader, styles) unchanged.

- [ ] **Step 3: Replace Phase 0 routing**

New Phase 0 text:

```markdown
## Phase 0: Routing

Run the auth status check first:

​```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/dimo-auth.mjs" status
​```

- `"credentials": true` → skip setup; go to **Phase 2 (Vehicle discovery)**.
- `"credentials": false` → **Phase 1 (Setup)**.

Never ask the user for JWTs or token IDs — both are derived automatically.
```

- [ ] **Step 4: Replace Phase 1 with mobile-app-first setup**

```markdown
## Phase 1: Setup

**Primary path — DIMO mobile app** (takes ~1 minute):

Tell the user:

> Open the **DIMO app** → **Account** → **Advanced settings** → **Developer API Key** → **Generate API key**. There is a one-time DIMO fee paid from your in-app balance. When the key appears, tap **Share all vehicles** so this license can read your cars. Then use the copy buttons to paste the three values (`DIMO_CLIENT_ID`, `DIMO_PRIVATE_KEY`, `DIMO_DOMAIN`) into the form on the left and press **Save credentials**.

Wait for the user's message, then read the captured values:

​```javascript
window.__dimoFormData
​```

Install script dependencies if needed, then store the credentials:

​```bash
[ -d "$CLAUDE_PLUGIN_ROOT/scripts/node_modules" ] || npm install --prefix "$CLAUDE_PLUGIN_ROOT/scripts" --silent
node "$CLAUDE_PLUGIN_ROOT/scripts/dimo-auth.mjs" setup \
  --client-id '<CLIENT_ID>' --private-key '<PRIVATE_KEY>' --domain '<DOMAIN>'
​```

Immediately clear the captured secret from the preview:

​```javascript
delete window.__dimoFormData;
​```

Do not echo the private key in chat output. → Phase 2.

<details>
<summary>Fallback — no DIMO mobile app (Developer Console)</summary>

1. Go to [https://console.dimo.org](https://console.dimo.org), sign in or create an account.
2. Apply for and activate a Developer License, create an application with redirect URI `http://localhost:3000/callback`.
3. Generate an API key (private key) for the license and note the Client ID.
4. Paste Client ID, private key, and the redirect URI into the form as above.
5. Vehicles must be shared manually: display this link (with the real client ID) and have the user sign in and share:
   `https://login.dimo.org?clientId=<CLIENT_ID>&redirectUri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&entryState=VEHICLE_MANAGER&permissions=11111111`
</details>
```

- [ ] **Step 5: Replace Phase 2 with vehicle discovery**

```markdown
## Phase 2: Vehicle discovery

Get the client ID from `status`, then query the public Identity API for vehicles shared with this license:

​```bash
curl -s -X POST "https://identity-api.dimo.zone/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ vehicles(filterBy: {privileged: \"<CLIENT_ID>\"}, first: 100) { nodes { tokenId definition { make model year } } } }"}'
​```

- **One vehicle** → use its `tokenId` silently.
- **Multiple** → list them (year make model + tokenId) and ask which to use.
- **None** → the user hasn't shared vehicles with this license. Tell them: *open the DIMO app → Account → Advanced settings → Developer API Key → tap "Share all vehicles"*, then re-run this query. (Console fallback: the login.dimo.org sharing link from Phase 1.)

→ Phase 3.
```

- [ ] **Step 6: Replace Phase 3 auth mechanics, keep query/render guidance**

Phase 3 keeps the existing tool table, signal discovery order, and `#signalsContent` render rules, with these changes:

- Bearer acquisition (replaces "confirm the Vehicle JWT is in your context"):

​```bash
JWT=$(node "$CLAUDE_PLUGIN_ROOT/scripts/dimo-auth.mjs" vehicle-jwt <TOKEN_ID>)
curl -s -X POST "https://telemetry-api.dimo.zone/mcp" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"telemetry_get_available_signals","arguments":{"tokenId":<TOKEN_ID>}},"id":1}'
​```

- 401 rule: re-run the same `vehicle-jwt` command (the script refreshes expired tokens automatically) and retry the query once. Never ask the user for tokens.
- Delete all `window.__dimoVehicleJwt` / form-refill / "re-run Phase 2 exchange" recovery prose — preview state loss now only affects rendering, never auth. Keep the "preview fully gone → re-render template" instruction, minus credential re-entry.
- After Phase 1 setup completes (or Phase 0 says ready), enable the Signals tab via `preview_eval`:

​```javascript
const b=document.getElementById('btn-signals');b.disabled=false;
​```

- [ ] **Step 7: Update the Error Reference table**

```markdown
| Error | Fix |
|---|---|
| 401 on MCP query | Re-run `dimo-auth.mjs vehicle-jwt <tokenId>` (auto-refreshes), retry once |
| `submit_challenge failed` from script | API key rotated/revoked — app → Developer API Key → "Generate new key", re-run Phase 1 |
| `token exchange failed` from script | Vehicle not shared with this license — app → "Share all vehicles" |
| Empty vehicle list in Phase 2 | Same — share vehicles in the app, re-query |
| Signal not in result | Confirm via `telemetry_get_available_signals` — vehicle may not report it |
| Tool parameter error | Call `get_schema` (no JWT) to introspect tool definitions |
```

- [ ] **Step 8: Sanity pass**

Read the rewritten SKILL.md top to bottom: no remaining references to "Developer JWT" pastes, `__dimoFormData.devJwt`, `tokenId` form field, or Phase 1.5. The "Core principle" and "Data principle" header lines stay (update the core principle to mention the bundled auth script).

- [ ] **Step 9: Commit**

```bash
git add skills/dimo/SKILL.md
git commit -m "feat!: mobile-app-first onboarding — bundled auth script replaces JWT paste flow"
```

---

### Task 4: references/mcp-tools.md auth section

**Files:**
- Modify: `skills/dimo/references/mcp-tools.md:6-33`

- [ ] **Step 1: Update the Endpoint + Call Format sections**

Replace lines 6-14 ("## Endpoint" block) with:

```markdown
## Endpoint

​```
POST https://telemetry-api.dimo.zone/mcp
Content-Type: application/json
Authorization: Bearer <VEHICLE_JWT>   ← required for all data tools
​```

Obtain the Vehicle JWT from the bundled auth script — never ask the user for it:

​```bash
JWT=$(node "$CLAUDE_PLUGIN_ROOT/scripts/dimo-auth.mjs" vehicle-jwt <TOKEN_ID>)
​```

The script caches tokens and silently re-mints on expiry. `get_schema` is the only tool that works without a JWT.
```

Tool list (the 10 tools), call format, and introspection sections unchanged.

- [ ] **Step 2: Commit**

```bash
git add skills/dimo/references/mcp-tools.md
git commit -m "docs: source Vehicle JWT from bundled auth script in tool reference"
```

---

### Task 5: README + version bump

**Files:**
- Modify: `README.md`
- Modify: `.claude-plugin/plugin.json` (version `0.1.0` → `0.2.0`)

- [ ] **Step 1: Rewrite README onboarding sections**

Update Features / Prerequisites / How it works to the new story:

```markdown
## Features

- 1-minute setup from the DIMO mobile app (Account → Advanced settings → Developer API Key)
- Automatic JWT handling — Developer and Vehicle JWTs are minted, cached, and refreshed locally; nothing to copy after setup
- Auto-discovery of vehicles shared with your developer license
- Live signal queries via the DIMO Telemetry MCP endpoint
- Full signal reference (speed, battery, fuel, tire pressure, and 80+ more)
- Dark-themed preview UI — results rendered directly in Claude Code

## Prerequisites

- The [DIMO mobile app](https://dimo.org) with at least one connected vehicle (Developer Console works as a fallback)
- Node.js >= 20
- Claude Code with the Claude Preview capability enabled

## How it works

1. **Setup** (first time) — Generate a developer API key in the DIMO app, share your vehicles with one tap, paste three values into the in-browser form. Stored in `~/.dimo/credentials.env` (mode 600).
2. **Auth** — A bundled script mints a Developer JWT from your key (web3 challenge flow) and exchanges it per-vehicle; tokens auto-refresh on expiry.
3. **Signal Queries** — Queries the hosted DIMO Telemetry MCP endpoint using 10 structured tools.
```

Remove the `/dimo <developer-jwt> <token-id>` arguments example and the "Vehicle JWT expires every ~10 minutes — re-submit the form" line. Installation and Links sections stay.

- [ ] **Step 2: Bump plugin version**

In `.claude-plugin/plugin.json`: `"version": "0.2.0"`. Also update `description` to: `"Query live telemetry from your DIMO-connected vehicle. 1-minute setup from the DIMO mobile app — no console, no JWT copying."`

- [ ] **Step 3: Commit**

```bash
git add README.md .claude-plugin/plugin.json
git commit -m "docs: mobile-app-first README, bump plugin to 0.2.0"
```

---

### Task 6: End-to-end walkthrough (manual)

**Files:** none

- [ ] **Step 1: Fresh-state dry run**

Temporarily move `~/.dimo` aside (`mv ~/.dimo ~/.dimo.bak`), then in a new Claude Code session run `/dimo` and follow the flow: status → setup instructions → paste values → vehicle discovery → one telemetry query. Restore with `mv ~/.dimo.bak ~/.dimo` if needed.

- [ ] **Step 2: Verify security posture**

```bash
ls -l ~/.dimo/   # credentials.env and jwt-cache.json must be -rw-------
```

And confirm the private key never appeared in chat output during the walkthrough.

- [ ] **Step 3: Push**

```bash
git push origin main
```

---

## Self-Review Notes

- Spec coverage: script (Task 1-2), SKILL.md rewrite incl. Phase 0/setup/fallback/discovery/401 (Task 3), mcp-tools.md (Task 4), README (Task 5), testing (Tasks 1, 2, 6). Credential storage + error handling embedded in Task 1 code and Task 3 Step 7.
- `~/.dimo/credentials.env` name/format matches spec; cached JWTs beside it as spec requires.
- Helper names consistent across tasks: `parseEnvFile`, `serializeEnvFile`, `jwtExpiry`, `isLive`; CLI commands `setup`/`status`/`vehicle-jwt` used identically in Tasks 1-4.
- Task 2 Step 3 depends on real credentials; marked deferrable.
