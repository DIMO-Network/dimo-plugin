# Optional preview dashboard

The plugin works fully without this. It is a nicety, not a dependency — everything
below is skipped when the `mcp__Claude_Preview__*` tools are absent from the session.

## When to use it

Only if `preview_list`, `preview_start`, and `preview_eval` are all available.

1. Call `preview_list` first. **If a DIMO preview is already running, stop — do not
   re-render.** `preview_start` wipes all JS state, including captured credentials.
2. Otherwise call `preview_start` with the HTML below.

## Credential capture

After the user submits the form, read the values with `preview_eval`:

```javascript
window.__dimoFormData
```

Then immediately clear them:

```javascript
delete window.__dimoFormData;
```

If setup fails, re-enable the form so the user can correct it:

```javascript
(()=>{const b=document.getElementById('submitBtn');b.disabled=false;b.style.opacity='1';b.textContent='Save credentials';})()
```

## Enabling the Signals tab

Once setup and vehicle discovery succeed, run this once:

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

## Rendering results

**Append** a new `.signal-card` to `#signalsContent` after each query — never replace
existing cards. Include the tool name, the query timestamp, and formatted values with
units (units come from `telemetry_get_schema`).

If the preview disappears mid-session, call `preview_start` again with the template,
re-run the Signals-tab snippet, and continue. Credentials live on disk — never re-ask
for them. Losing the preview only affects rendering, never auth.

## Template

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
