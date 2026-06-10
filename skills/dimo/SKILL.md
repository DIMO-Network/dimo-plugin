---
name: dimo
description: This skill should be used when the user asks to "connect my DIMO vehicle", "query my vehicle data", "get vehicle telemetry", "check my car's battery", "see my vehicle signals", "show my car stats", "use DIMO", "query DIMO", or invokes /dimo. Guides users from zero to querying live telemetry from a DIMO-connected vehicle — 1-minute setup from the DIMO mobile app, automatic JWT handling, and real-time signal queries.
version: 0.2.1
allowed-tools: Bash, mcp__Claude_Preview__preview_start, mcp__Claude_Preview__preview_eval, mcp__Claude_Preview__preview_list
---

# DIMO Vehicle Data

Guide users from zero to querying live data from their DIMO-connected vehicle.

**Core principle:** The user should never need to touch the terminal or handle a JWT. Credentials come from the DIMO mobile app once; the bundled auth script (`${CLAUDE_PLUGIN_ROOT}/scripts/dimo-auth.mjs`) mints and refreshes all tokens silently. Use the preview tool to show forms and results, and run all API calls via Bash.

**Data principle:** All vehicle data queries go through the DIMO Telemetry MCP endpoint (`POST https://telemetry-api.dimo.zone/mcp`) using the 10 defined MCP tools. Never write raw GraphQL against telemetry and never invent query structures. Consult `references/mcp-tools.md` for the full tool list, parameters, and curl format. Consult `references/signal-reference.md` for signal names and units when rendering results.

---

## Startup: Render the preview immediately

Call `preview_list` first. If a DIMO preview is already running, skip `preview_start` entirely — do not re-render, it wipes all JS state. Only call `preview_start` with the HTML below if no preview exists. This is the first action before any text output or questions.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Oswald:ital,wght@0,700;1,700&family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#000;--surface:#0E0E0E;--text:#fff;--muted:#8E8E8E;--red:#ED1C24;--red-dim:#B20C13}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh}
.nav{position:sticky;top:0;padding:12px 32px;display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,.92);backdrop-filter:blur(10px);border-bottom:1px solid #1a1a1a;font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.15em;font-size:13px;z-index:50}
.logo{display:flex;align-items:center;gap:12px;font-style:italic;font-size:16px}
.logo .x{color:var(--muted);font-size:11px;font-style:normal}
.logo .dimo{font-size:12px;letter-spacing:.25em;font-style:normal}
.nav-tabs{display:flex}
.tab{color:var(--muted);background:none;border:none;cursor:pointer;padding:10px 20px;font-family:'Oswald',sans-serif;font-weight:700;font-style:italic;text-transform:uppercase;letter-spacing:.2em;font-size:11px;transition:color .15s;position:relative}
.tab:hover:not(:disabled){color:#fff}
.tab.active{color:#fff}
.tab.active::after{content:"";position:absolute;left:20px;right:20px;bottom:-4px;height:2px;background:var(--red)}
.tab:disabled{color:#333;cursor:not-allowed}
.page-head{padding:40px 48px 28px;border-bottom:1px solid #111}
.section-label{display:flex;align-items:center;gap:16px;font-size:11px;letter-spacing:.28em;margin-bottom:16px}
.rule{width:48px;height:3px;background:var(--red)}
.label-text{font-family:'JetBrains Mono',monospace;color:var(--red);text-transform:uppercase}
.display{font-family:'Oswald',sans-serif;font-weight:700;font-style:italic;font-size:clamp(36px,6vw,64px);line-height:.9;letter-spacing:-.02em;text-transform:uppercase;margin-bottom:12px}
.prose{font-size:14px;line-height:1.6;color:#aaa;font-family:'JetBrains Mono',monospace;letter-spacing:.02em}
.pane{padding:40px 48px}
.form-note{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.15em;color:var(--muted);margin-bottom:28px;border-left:3px solid #1a1a1a;padding-left:14px}
.field-group{display:flex;flex-direction:column;gap:6px;margin-bottom:20px}
.field-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.25em;color:var(--muted);text-transform:uppercase}
textarea{background:#000;color:#fff;border:1px solid #2a2a2a;padding:14px 16px;font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.04em;width:100%;resize:vertical;min-height:48px}
textarea:focus{outline:none;border-color:var(--red)}
.btn-red{background:var(--red);color:#fff;border:none;padding:14px 28px;font-family:'Oswald',sans-serif;font-weight:700;font-style:italic;letter-spacing:.12em;cursor:pointer;text-transform:uppercase;font-size:14px;margin-top:8px}
.btn-red:hover{background:var(--red-dim)}
#jwtResult{margin-top:28px}
.result-card{background:var(--surface);padding:24px;border-top:3px solid var(--red)}
.result-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.25em;color:var(--muted);text-transform:uppercase;margin-bottom:12px}
.result-status{font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.15em;margin-bottom:14px}
.status-ok{color:#7DD87D}
.status-err{color:var(--red)}
.btn-ghost{background:transparent;border:1px solid #444;color:#ccc;padding:8px 18px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.2em;cursor:pointer;margin-top:10px;text-transform:uppercase}
.btn-ghost:hover{border-color:#888;color:#fff}
#signalsContent{display:flex;flex-direction:column;gap:16px}
.signal-card{background:var(--surface);border-top:3px solid var(--red);padding:20px 24px}
.signal-card-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.28em;color:var(--muted);text-transform:uppercase;margin-bottom:14px}
.hud-row{display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-bottom:1px solid #1a1a1a;font-family:'JetBrains Mono',monospace;font-size:13px;gap:20px}
.hud-row:last-child{border-bottom:none}
.hud-k{color:var(--muted);letter-spacing:.15em;font-size:10px;text-transform:uppercase;flex-shrink:0}
.hud-v{color:#fff;text-align:right}
.hud-ts{color:#555;font-size:10px;letter-spacing:.05em;margin-left:12px}
.empty-state{font-family:'JetBrains Mono',monospace;font-size:12px;color:#333;letter-spacing:.15em;text-transform:uppercase;padding:40px 0;text-align:center;border:1px solid #111}
#loading-overlay{position:fixed;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;z-index:999;transition:opacity .4s ease}
#loading-overlay.hidden{opacity:0;pointer-events:none}
.loader-logo{font-family:'Oswald',sans-serif;font-weight:700;font-style:italic;font-size:18px;letter-spacing:.25em;text-transform:uppercase;color:#fff}
.loader-logo span{color:var(--muted);font-style:normal;font-size:11px;margin:0 8px}
.spinner{width:36px;height:36px;border:2px solid #1a1a1a;border-top-color:var(--red);border-radius:50%;animation:spin .7s linear infinite}
.loader-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.3em;color:var(--muted);text-transform:uppercase}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div id="loading-overlay">
  <div class="loader-logo"><span>DIMO</span><span>×</span><span>TELEMETRY</span></div>
  <div class="spinner"></div>
  <div class="loader-label">Initialising</div>
</div>
<nav class="nav">
  <div class="logo"><span>DIMO</span><span class="x">×</span><span class="dimo">TELEMETRY</span></div>
  <div class="nav-tabs">
    <button id="btn-jwt" class="tab active">Setup</button>
    <button id="btn-signals" class="tab" disabled>Signals</button>
  </div>
</nav>
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
<div id="pane-signals" hidden>
  <div class="page-head">
    <div class="section-label"><span class="rule"></span><span class="label-text">Live Data</span></div>
    <div class="display">Signals.</div>
    <p class="prose">Real-time telemetry from your vehicle.</p>
  </div>
  <div class="pane">
    <div id="signalsContent"><div class="empty-state">· NO DATA YET ·</div></div>
  </div>
</div>
<script>
window.addEventListener('load',()=>{
  const ol=document.getElementById('loading-overlay');
  ol.classList.add('hidden');
  setTimeout(()=>ol.remove(),450);
});
document.getElementById('btn-jwt').addEventListener('click',()=>{
  document.getElementById('pane-jwt').hidden=false;
  document.getElementById('pane-signals').hidden=true;
  document.getElementById('btn-jwt').classList.add('active');
  document.getElementById('btn-signals').classList.remove('active');
});
document.getElementById('btn-signals').addEventListener('click',()=>{
  if(document.getElementById('btn-signals').disabled)return;
  document.getElementById('pane-jwt').hidden=true;
  document.getElementById('pane-signals').hidden=false;
  document.getElementById('btn-jwt').classList.remove('active');
  document.getElementById('btn-signals').classList.add('active');
});
document.getElementById('submitBtn').addEventListener('click',()=>{
  const btn=document.getElementById('submitBtn');
  const clientId=document.getElementById('clientId').value.trim();
  const privateKey=document.getElementById('privateKey').value.trim();
  const domain=document.getElementById('domain').value.trim()||'http://localhost:3000/callback';
  const r=document.getElementById('jwtResult');
  r.textContent='';
  const okHex=(v,n)=>new RegExp('^(0x)?[0-9a-fA-F]{'+n+'}$').test(v.replace(/^["']|["']$/g,'').replace(/^[A-Z_]+=/,''));
  if(!okHex(clientId,40)||!okHex(privateKey,64)){
    const card=document.createElement('div');card.className='result-card';
    const msg=document.createElement('p');msg.className='result-status status-err';
    msg.textContent='CHECK THE VALUES — CLIENT ID IS 42 CHARS (0x + 40), PRIVATE KEY 66 (0x + 64). PASTE THE FULL VALUE.';
    card.appendChild(msg);r.appendChild(card);return;
  }
  window.__dimoFormData={clientId,privateKey,domain,submitted:true};
  btn.textContent='SAVED ✓';btn.disabled=true;btn.style.opacity='.6';
  const card=document.createElement('div');card.className='result-card';
  const msg=document.createElement('p');msg.className='result-status';msg.style.color='#8E8E8E';
  msg.textContent='CREDENTIALS CAPTURED — SEND ANY MESSAGE TO CONTINUE';
  card.appendChild(msg);r.appendChild(card);
});
</script>
</body>
</html>
```

Once `preview_start` returns, run Phase 0 routing.

---

## Phase 0: Routing

Check that Node.js is available, then run the auth status check:

```bash
command -v node >/dev/null || echo "NODE_MISSING"
[ -d "${CLAUDE_PLUGIN_ROOT}/scripts/node_modules" ] || npm install --prefix "${CLAUDE_PLUGIN_ROOT}/scripts" --silent
node "${CLAUDE_PLUGIN_ROOT}/scripts/dimo-auth.mjs" status
```

The dependency check runs every time because a plugin update resets the install directory; it is a no-op when `node_modules` already exists.

If Node is missing, tell the user plainly (no jargon): *"One thing first: this plugin needs Node.js, which is free and takes a couple of minutes to install. Grab the LTS version from [nodejs.org](https://nodejs.org), or run `brew install node` if you use Homebrew on a Mac. Then come back and say 'continue'."* Do not proceed until `node` resolves.

- `"credentials": true` → skip setup; enable the Signals tab (see Phase 3) and go to **Phase 2 (Vehicle discovery)**.
- `"credentials": false` → **Phase 1 (Setup)**.

Never ask the user for JWTs or token IDs — both are derived automatically.

---

## Phase 1: Setup

**Primary path — DIMO mobile app** (takes ~1 minute):

Tell the user:

> Open the DIMO app and go to **Account → Advanced settings → Developer API Key**, then tap **Generate API key**. The app shows a small one-time fee that comes out of your DIMO balance, so top up first if you're short. Once the key appears, tap **Share all vehicles**. That's the step that lets this plugin see your cars. Then copy each of the three values into the form on the left and hit **Save credentials**.
>
> Getting the values from your phone to this computer: on iPhone and Mac, copying in the app usually lets you paste straight on the Mac. Otherwise AirDrop them, or message them to yourself and delete that message afterwards. The private key is a real secret.

Wait for the user's message, then read the captured values via `preview_eval`:

```javascript
window.__dimoFormData
```

If the user pasted the three values directly in chat instead of using the form, use those — do not make them re-enter anything.

Store the credentials, passing them as environment variables (keeps the private key out of `ps`-visible argv):

```bash
DIMO_CLIENT_ID='<CLIENT_ID>' DIMO_PRIVATE_KEY='<PRIVATE_KEY>' DIMO_DOMAIN='<DOMAIN>' \
  node "${CLAUDE_PLUGIN_ROOT}/scripts/dimo-auth.mjs" setup
```

Immediately clear the captured secret from the preview:

```javascript
delete window.__dimoFormData;
```

**Never echo the private key in chat output.**

If setup fails (bad value), tell the user what was wrong and re-enable the form so they can correct it:

```javascript
(()=>{const b=document.getElementById('submitBtn');b.disabled=false;b.style.opacity='1';b.textContent='Save credentials';})()
```

→ Phase 2.

<details>
<summary>Fallback — no DIMO mobile app (Developer Console)</summary>

1. Go to [https://console.dimo.org](https://console.dimo.org), sign in or create an account.
2. Apply for and activate a Developer License; create an application with redirect URI `http://localhost:3000/callback`.
3. Generate an API key (private key) for the license and note the Client ID.
4. Paste the Client ID, private key, and redirect URI (as `DIMO_DOMAIN`) into the form as above.
5. Vehicles must be shared manually: display this link (with the real Client ID) and have the user sign in and share:
   `https://login.dimo.org?clientId=<CLIENT_ID>&redirectUri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&entryState=VEHICLE_MANAGER&permissions=11111111`

</details>

---

## Phase 2: Vehicle discovery

Get the client ID from `status`, then query the public Identity API for vehicles shared with this license:

```bash
curl -s -X POST "https://identity-api.dimo.zone/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ vehicles(filterBy: {privileged: \"<CLIENT_ID>\"}, first: 100) { nodes { tokenId definition { make model year } } } }"}'
```

- **One vehicle** → use its `tokenId` silently.
- **Multiple** → list them in chat (year make model + tokenId) and ask which to use.
- **None** → the user hasn't shared vehicles with this license. Tell them: *open the DIMO app → Account → Advanced settings → Developer API Key → tap "Share all vehicles"*, then re-run this query. (Console fallback: the login.dimo.org sharing link from Phase 1.)

→ Phase 3.

---

## Phase 3: Vehicle Queries via MCP

Enable the Signals tab and switch to it via `preview_eval` (once, after setup/discovery succeeds):

```javascript
(()=>{
  const b=document.getElementById('btn-signals');
  b.disabled=false;
  document.getElementById('pane-jwt').hidden=true;
  document.getElementById('pane-signals').hidden=false;
  document.getElementById('btn-jwt').classList.remove('active');
  b.classList.add('active');
})()
```

All queries use the DIMO Telemetry MCP endpoint. The Bearer token always comes from the auth script — it caches Vehicle JWTs and silently re-mints the Developer JWT on expiry:

```bash
JWT=$(node "${CLAUDE_PLUGIN_ROOT}/scripts/dimo-auth.mjs" vehicle-jwt <TOKEN_ID>)
```

> ⚠️ If any query returns 401, re-run with `vehicle-jwt <TOKEN_ID> --refresh` (forces new tokens even if the cache thinks they're valid — covers revoked keys and clock skew) and retry the query once. If it still fails, the key was likely rotated: route to the Error Reference. Never ask the user for tokens.

**Never write raw GraphQL against telemetry or invent query structures.** Use only the 10 defined MCP tools. If a tool returns a parameter error, call `tools/list` (no JWT required) and read the tool's `inputSchema` — see `references/mcp-tools.md`.

### Step 1 — Discover available signals

Always start with `telemetry_get_available_signals` to see what this specific vehicle reports:

```bash
JWT=$(node "${CLAUDE_PLUGIN_ROOT}/scripts/dimo-auth.mjs" vehicle-jwt <TOKEN_ID>)
curl -s -X POST "https://telemetry-api.dimo.zone/mcp" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"telemetry_get_available_signals","arguments":{"tokenId":<TOKEN_ID>}},"id":1}'
```

Render the returned signal list in `#signalsContent` as a `.signal-card`. Ask what signals to explore.

### Step 2 — Query with the right tool

Select the tool based on the user's request (quick reference below). Full parameters in `references/mcp-tools.md`:

| User wants | MCP tool |
|---|---|
| Latest readings | `telemetry_get_latest_signals` |
| History / trend | `telemetry_get_signals_time_series` |
| Point-in-time snapshot | `telemetry_get_signals_snapshot` |
| Data coverage overview | `telemetry_get_data_summary` |
| Trip history | `telemetry_get_trip_segments` |
| Daily driving summary | `telemetry_get_daily_activity` |
| Fault / event log | `telemetry_get_events` |
| Verified attestations | `telemetry_get_attestations` |
| VIN credential | `telemetry_get_vin_credential` |

Only request signals the vehicle reported in `telemetry_get_available_signals`. Cross-reference signal names and units with `references/signal-reference.md` when rendering results.

### Step 3 — Render results

Use `preview_eval` to **append** a new `.signal-card` to `#signalsContent` after each query — never replace existing cards. Include the tool name, query timestamp, and formatted signal values with units.

**Always show data age.** Every signal carries a `timestamp` (and snapshots a `lastSeen`). If the data is older than ~1 hour, say so in plain words next to the answer (e.g. *"last reported 3 weeks ago — the car hasn't sent data since"*). Never present stale values as the current state. For location answers, give a human-readable place (city/area) alongside coordinates when possible.

### After the first successful query

Tell the user setup is done for good — credentials are stored and tokens renew automatically — and show 3-4 example asks so they know what's possible, e.g.:

- "Where is my car right now?"
- "What's my battery / fuel level?"
- "Show my trips from last week"
- "Any fault codes on my car?"

### Preview fully gone (preview_list shows nothing)

Call `preview_start` with the inline HTML template, re-enable the Signals tab via the Phase 3 snippet, and continue. Credentials live on disk — never re-ask for them. Preview state loss only affects rendering, never auth.

---

## Error Reference

| Error | Fix |
|---|---|
| 401 on MCP query | Re-run `dimo-auth.mjs vehicle-jwt <tokenId> --refresh`, retry once |
| `submit_challenge failed` from script | API key rotated/revoked — app → Developer API Key → "Generate new key", re-run Phase 1 |
| `generate_challenge failed` from script | `DIMO_CLIENT_ID`/`DIMO_DOMAIN` don't match a real license — re-copy from the app, re-run Phase 1 |
| `token exchange failed` from script | Vehicle not shared with this license — app → "Share all vehicles" |
| Empty vehicle list in Phase 2 | Same — share vehicles in the app, re-query |
| Signal not in result | Confirm via `telemetry_get_available_signals` — vehicle may not report it |
| Tool parameter error | Call `tools/list` (no JWT) and follow the tool's `inputSchema` exactly |

---

## Additional Resources

- **`references/mcp-tools.md`** — Full MCP tool list, parameters, curl format, and tool selection guide
- **`references/signal-reference.md`** — All signal field names, units, and descriptions
