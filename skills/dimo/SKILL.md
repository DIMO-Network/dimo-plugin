---
name: dimo
description: This skill should be used when the user asks to "connect my DIMO vehicle", "query my vehicle data", "get vehicle telemetry", "check my car's battery", "see my vehicle signals", "show my car stats", "use DIMO", "query DIMO", or invokes /dimo. Guides users from zero to querying live telemetry from a DIMO-connected vehicle — covering developer onboarding, JWT exchange, and real-time signal queries.
version: 0.1.0
argument-hint: "[developer-jwt] [token-id]"
allowed-tools: Bash, mcp__Claude_Preview__preview_start, mcp__Claude_Preview__preview_eval, mcp__Claude_Preview__preview_list
---

# DIMO Vehicle Data

Guide users from zero to querying live data from their DIMO-connected vehicle.

**Core principle:** The user should never need to touch the terminal. Use the preview tool to show forms and results, and run all API calls via Bash.

**Data principle:** All vehicle data queries go through the DIMO Telemetry MCP endpoint (`POST https://telemetry-api.dimo.zone/mcp`) using the 10 defined MCP tools. Never write raw GraphQL or invent query structures. Consult `references/mcp-tools.md` for the full tool list, parameters, and curl format. Consult `references/signal-reference.md` for signal names and units when rendering results.

---

## Startup: Render the preview immediately

Call `preview_list` first. If a DIMO preview is already running, skip `preview_start` entirely — do not re-render, it wipes all JS state and the displayed JWT. Only call `preview_start` with the HTML below if no preview exists. This is the first action before any text output or questions.

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
textarea,input[type=number]{background:#000;color:#fff;border:1px solid #2a2a2a;padding:14px 16px;font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.04em;width:100%;resize:vertical}
textarea:focus,input[type=number]:focus{outline:none;border-color:var(--red)}
textarea{min-height:120px}
.btn-red{background:var(--red);color:#fff;border:none;padding:14px 28px;font-family:'Oswald',sans-serif;font-weight:700;font-style:italic;letter-spacing:.12em;cursor:pointer;text-transform:uppercase;font-size:14px;margin-top:8px}
.btn-red:hover{background:var(--red-dim)}
#jwtResult{margin-top:28px}
.result-card{background:var(--surface);padding:24px;border-top:3px solid var(--red)}
.result-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.25em;color:var(--muted);text-transform:uppercase;margin-bottom:12px}
.result-status{font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.15em;margin-bottom:14px}
.status-ok{color:#7DD87D}
.status-err{color:var(--red)}
.result-jwt{background:#000;border:1px solid #222;color:#ddd;font-family:'JetBrains Mono',monospace;font-size:11px;padding:14px;width:100%;resize:none;letter-spacing:.03em;min-height:80px}
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
    <button id="btn-jwt" class="tab active">JWT Exchange</button>
    <button id="btn-signals" class="tab" disabled>Signals</button>
  </div>
</nav>
<div id="pane-jwt">
  <div class="page-head">
    <div class="section-label"><span class="rule"></span><span class="label-text">Credentials</span></div>
    <div class="display">Vehicle<br>Access.</div>
    <p class="prose">Exchange your Developer JWT for a vehicle-scoped token.</p>
  </div>
  <div class="pane">
    <p class="form-note">VALUES STAY LOCAL — USED ONLY TO CALL THE DIMO TOKEN EXCHANGE API.</p>
    <div class="field-group">
      <label class="field-label">Developer JWT</label>
      <textarea id="devJwt" placeholder="Paste your Developer JWT here"></textarea>
    </div>
    <div class="field-group">
      <label class="field-label">Vehicle Token ID</label>
      <input type="number" id="tokenId" placeholder="e.g. 183644"/>
    </div>
    <button class="btn-red" id="submitBtn">Get Vehicle JWT</button>
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
  const devJwt=document.getElementById('devJwt').value.trim();
  const tokenId=document.getElementById('tokenId').value.trim();
  const r=document.getElementById('jwtResult');
  r.textContent='';
  if(!devJwt||!tokenId){
    const card=document.createElement('div');card.className='result-card';
    const msg=document.createElement('p');msg.className='result-status status-err';
    msg.textContent='BOTH FIELDS ARE REQUIRED.';
    card.appendChild(msg);r.appendChild(card);return;
  }
  window.__dimoFormData={devJwt,tokenId,submitted:true};
  btn.textContent='EXCHANGING...';btn.disabled=true;btn.style.opacity='.6';
  const card=document.createElement('div');card.className='result-card';
  const msg=document.createElement('p');msg.className='result-status';msg.style.color='#8E8E8E';
  msg.textContent='CREDENTIALS CAPTURED — CLAUDE IS EXCHANGING YOUR TOKEN';
  card.appendChild(msg);r.appendChild(card);
});
</script>
</body>
</html>
```

Once `preview_start` returns, run Phase 0 routing.

---

## Phase 0: Routing

**First, check whether the user already supplied a Developer JWT and a Token ID** (e.g. pasted a JWT string and/or a numeric Token ID in their message). If both are present, skip all questions and go straight to Phase 2 — pre-fill the preview form via `preview_eval` and trigger the exchange. The routing questions exist only to gather what the user hasn't already provided.

If credentials are missing, ask these questions in sequence in chat. Stop at the first "No":

1. **"Do you have a DIMO Developer License and a Developer JWT from the Developer Console?"**
   - No → **Phase 1** (full onboarding)
2. **"Have you shared your vehicle with your developer app and noted your vehicle's Token ID?"**
   - No → **Phase 1, Step 5** (vehicle sharing only — skip steps 1–4)
3. Both yes → **Phase 2**

---

## Phase 1: Onboarding

*Prose only — all steps happen in the DIMO Developer Console UI.*

**Step 1 — Sign in**
Go to [https://console.dimo.org](https://console.dimo.org) and sign in or create an account.

**Step 2 — Obtain a Developer License**
Follow the console prompts to apply for and activate a Developer License.

**Step 3 — Create an app and set a redirect URI**
Create a new application. Set the redirect URI to `http://localhost:3000/callback`. The console auto-generates a **Developer JWT** on save.

**Step 4 — Copy your Developer JWT**
Copy the Developer JWT and store it safely (e.g. a `.env` file or password manager).

**Step 5 — Share your vehicle**

Ask for the user's **Client ID** (shown next to the app in the console — looks like `0xabc123...`).

Construct and display this URL as a clickable link:
```
https://login.dimo.org?clientId=<CLIENT_ID>&redirectUri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&entryState=VEHICLE_MANAGER&permissions=11111111
```

Display this message: *"Click this link, sign in with your DIMO account, share the vehicle(s), and note the Token ID shown for each vehicle — you'll need it next."*

→ Once the user has the Token ID, continue to Phase 2.

---

## Phase 2: Vehicle JWT Exchange

The Developer JWT identifies the developer app but does not grant vehicle data access. Exchange it for a **Vehicle JWT** scoped to a specific vehicle token ID.

> ⚠️ The Vehicle JWT expires in ~10 minutes. Re-run this exchange any time a query returns 401.

**Step 1 — The preview form**

The preview was rendered at startup. Never re-render it from scratch.

If the user pre-supplied both credentials, pre-fill the form and trigger the button via `preview_eval`:
```javascript
document.getElementById('devJwt').value = '<DEV_JWT>';
document.getElementById('tokenId').value = '<TOKEN_ID>';
document.getElementById('submitBtn').click();
```

Otherwise tell the user: *"Fill in your Developer JWT and Token ID, click **Get Vehicle JWT**, then send me any message."*

**Step 2 — Read credentials and run the exchange via Bash**

The preview sandbox blocks external HTTP — the button captures credentials in `window.__dimoFormData` but makes no network calls. Once the user responds, read the values:
```javascript
window.__dimoFormData
```

Then run the exchange via Bash:
```bash
curl -s -X POST "https://token-exchange-api.dimo.zone/v1/tokens/exchange" \
  -H "Authorization: Bearer <DEV_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"nftContractAddress":"0xbA5738a18d83D41847dfFbDC6101d37C69c9B0cF","privileges":[1,2,3,4,5,6,7,8],"tokenId":<TOKEN_ID>}'
```

**Step 3 — Inject the result into the preview**

On success, store the token in context and update the UI via `preview_eval` using safe DOM methods (no innerHTML):
```javascript
(()=>{
  const token='<VEHICLE_JWT>';
  const tokenId='<TOKEN_ID>';
  window.__dimoVehicleJwt=token;
  window.__dimoTokenId=tokenId;
  const r=document.getElementById('jwtResult');
  while(r.firstChild)r.removeChild(r.firstChild);
  const card=document.createElement('div');card.className='result-card';
  const lbl=document.createElement('p');lbl.className='result-label';lbl.textContent='VEHICLE JWT';
  const st=document.createElement('p');st.className='result-status status-ok';st.textContent='VEHICLE JWT GENERATED — VALID FOR ~10 MINUTES';
  const ta=document.createElement('textarea');ta.className='result-jwt';ta.readOnly=true;ta.value=token;ta.rows=4;
  const cp=document.createElement('button');cp.className='btn-ghost';cp.textContent='COPY';
  cp.addEventListener('click',()=>{navigator.clipboard.writeText(token);cp.textContent='COPIED';setTimeout(()=>cp.textContent='COPY',2000);});
  card.append(lbl,st,ta,cp);r.appendChild(card);
  const btn=document.getElementById('submitBtn');
  btn.textContent='REFRESH JWT';btn.disabled=false;btn.style.opacity='1';
  const btnSig=document.getElementById('btn-signals');
  btnSig.disabled=false;
  document.getElementById('pane-jwt').hidden=true;
  document.getElementById('pane-signals').hidden=false;
  document.getElementById('btn-jwt').classList.remove('active');
  btnSig.classList.add('active');
})()
```

On error, surface the message in the preview:
```javascript
(()=>{
  const r=document.getElementById('jwtResult');
  while(r.firstChild)r.removeChild(r.firstChild);
  const card=document.createElement('div');card.className='result-card';
  const msg=document.createElement('p');msg.className='result-status status-err';
  msg.textContent='ERROR: <MESSAGE>';
  card.appendChild(msg);r.appendChild(card);
  const btn=document.getElementById('submitBtn');
  btn.textContent='GET VEHICLE JWT';btn.disabled=false;btn.style.opacity='1';
})()
```

**Source of truth:** After a successful exchange, store `devJwt`, `tokenId`, and `vehicleJwt` explicitly in your context. `window.__dimoVehicleJwt` is a convenience cache only — never read the JWT back from the preview window. The preview can restart or refresh at any time, wiping all JS state.

**Never ask the user to re-paste or re-fill the form** if credentials exist anywhere in the conversation context.

### Preview JS state loss (window vars gone, UI still visible)

Do NOT call `preview_start` — the UI is still rendered. Just re-run the Bash exchange with credentials from context and inject the fresh token via `preview_eval`.

### Preview fully gone (preview_list shows nothing)

1. Call `preview_start` with the inline HTML template
2. Re-run the Bash exchange immediately using `devJwt` and `tokenId` from context
3. Inject the result via `preview_eval` — do not prompt the user for anything

→ Proceed to Phase 3.

---

## Phase 3: Vehicle Queries via MCP

Before querying, confirm the Vehicle JWT is in your context. Do not read it from `window.__dimoVehicleJwt` — that variable is unreliable across preview refreshes. If it is missing from context, follow the restart recovery steps in Phase 2.

All queries use the DIMO Telemetry MCP endpoint. See `references/mcp-tools.md` for the full tool reference, curl format, and parameter details.

> ⚠️ If any query returns 401, the Vehicle JWT has expired. Re-run the Bash exchange silently using `devJwt` and `tokenId` already in context, then inject the new token into the preview via `preview_eval` and retry the query — do not ask the user to re-fill the form.

**Never write raw GraphQL or invent query structures.** Use only the 10 defined MCP tools. If unsure of a tool's parameters, call `get_schema` (no JWT required) to introspect — see `references/mcp-tools.md`.

### Step 1 — Discover available signals

Always start with `telemetry_get_available_signals` to see what this specific vehicle reports:

```bash
curl -s -X POST "https://telemetry-api.dimo.zone/mcp" \
  -H "Authorization: Bearer <VEHICLE_JWT>" \
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

---

## Error Reference

| Error | Fix |
|---|---|
| 401 on MCP query | Vehicle JWT expired — re-run Phase 2 |
| 401 on token exchange | Developer JWT invalid — re-copy from console |
| Signal not in result | Confirm via `telemetry_get_available_signals` — vehicle may not report it |
| Token ID not recognized | Confirm vehicle is shared with the developer app in the console |
| Tool parameter error | Call `get_schema` (no JWT) to introspect tool definitions |

---

## Additional Resources

- **`references/mcp-tools.md`** — Full MCP tool list, parameters, curl format, and tool selection guide
- **`references/signal-reference.md`** — All signal field names, units, and descriptions
