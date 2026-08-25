---
name: dimo
description: This skill should be used when the user asks to "connect my DIMO vehicle", "query my vehicle data", "get vehicle telemetry", "check my car's battery", "see my vehicle signals", "show my car stats", "use DIMO", "query DIMO", or invokes /dimo. Guides users from zero to querying live telemetry from a DIMO-connected vehicle — 1-minute setup from the DIMO mobile app, automatic JWT handling, and real-time signal queries.
allowed-tools: Bash, Read, mcp__Claude_Preview__preview_start, mcp__Claude_Preview__preview_eval, mcp__Claude_Preview__preview_list
---

# DIMO Vehicle Data

Guide users from zero to querying live data from their DIMO-connected vehicle.

**Core principle:** The user should never need to touch the terminal or handle a JWT.
Credentials come from the DIMO mobile app once; the bundled auth script
(`${CLAUDE_PLUGIN_ROOT}/scripts/dimo-auth.mjs`) mints and refreshes all tokens silently.

**Data principle:** All vehicle data goes through the DIMO Telemetry MCP endpoint
(`POST https://telemetry-api.dimo.zone/mcp`) via Bash + curl. Never write raw GraphQL and
never invent query structures. `references/mcp-tools.md` has the tool list, required
parameters, response format, and error handling — **read it before your first query.**

**Signal principle:** There is no static list of signal names anywhere in this plugin, by
design. The signals a vehicle reports differ per car and change over time. **Always call
`telemetry_get_available_signals` before any query that names signals, and only use names
it returned.** For units and descriptions, call `telemetry_get_schema` (no JWT needed).

---

## Optional: the preview dashboard

Check whether the `mcp__Claude_Preview__*` tools exist in this session.

- **Available** → read `references/preview-ui.md` and follow it. It renders a setup form
  and a live signals dashboard. Do this first, before any text output.
- **Not available** → skip it entirely and run everything in chat. This is a fully
  supported path, not a degraded one. Never mention the preview, never tell the user to
  enable anything, and never block on it.

Everything below works identically either way.

---

## Phase 0: Routing

Check Node, then the auth status:

```bash
command -v node >/dev/null || echo "NODE_MISSING"
[ -d "${CLAUDE_PLUGIN_ROOT}/scripts/node_modules" ] || npm install --prefix "${CLAUDE_PLUGIN_ROOT}/scripts" --silent
node "${CLAUDE_PLUGIN_ROOT}/scripts/dimo-auth.mjs" status
```

The dependency check runs every time because a plugin update resets the install directory;
it is a no-op when `node_modules` already exists.

If Node is missing, tell the user plainly (no jargon): *"One thing first: this plugin needs
Node.js, which is free and takes a couple of minutes to install. Grab the LTS version from
[nodejs.org](https://nodejs.org), or run `brew install node` if you use Homebrew on a Mac.
Then come back and say 'continue'."* Do not proceed until `node` resolves.

- `"credentials": true` → skip setup, go to **Phase 2**.
- `"credentials": false` → **Phase 1**.

Never ask the user for JWTs or token IDs — both are derived automatically.

---

## Phase 1: Setup

**Primary path — DIMO mobile app** (takes ~1 minute). Tell the user:

> Open the DIMO app and go to **Account → Advanced settings → Developer API Key**, then tap
> **Generate API key**. The app shows a small one-time fee that comes out of your DIMO
> balance, so top up first if you're short. Once the key appears, tap **Share all
> vehicles** — that's the step that lets this plugin see your cars.
>
> Then send me three values: the **Client ID**, the **private key** (tap the eye icon to
> reveal it), and the **redirect URI** — that last one is usually
> `http://localhost:3000/callback`.
>
> Getting them from your phone to this computer: on iPhone and Mac, copying in the app
> usually lets you paste straight on the Mac. Otherwise AirDrop them, or message them to
> yourself and delete that message afterwards. The private key is a real secret.

If the preview is running, point at the form instead of asking for a paste — but accept a
chat paste either way and never make the user re-enter anything.

Store the credentials, passing them as environment variables so the private key stays out
of `ps`-visible argv:

```bash
DIMO_CLIENT_ID='<CLIENT_ID>' DIMO_PRIVATE_KEY='<PRIVATE_KEY>' DIMO_DOMAIN='<DOMAIN>' \
  node "${CLAUDE_PLUGIN_ROOT}/scripts/dimo-auth.mjs" setup
```

**Never echo the private key in chat output.** If the preview captured it, clear
`window.__dimoFormData` immediately (see `references/preview-ui.md`).

If setup fails, say which value was wrong and ask for that one again. → Phase 2.

<details>
<summary>Fallback — no DIMO mobile app (Developer Console)</summary>

1. Go to [https://console.dimo.org](https://console.dimo.org), sign in or create an account.
2. Apply for and activate a Developer License; create an application with redirect URI
   `http://localhost:3000/callback`.
3. Generate an API key (private key) for the license and note the Client ID.
4. Supply the Client ID, private key, and redirect URI (as `DIMO_DOMAIN`) as above.
5. Vehicles must be shared manually: display this link (with the real Client ID) and have
   the user sign in and share:
   `https://login.dimo.org?clientId=<CLIENT_ID>&redirectUri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&entryState=VEHICLE_MANAGER&permissions=11111111`

</details>

---

## Phase 2: Vehicle discovery

List the vehicles shared with this license (public Identity API, no JWT needed):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/dimo-auth.mjs" vehicles
```

Returns `{"totalCount":46,"truncated":false,"vehicles":[{"tokenId":183644,"name":"2025 Ram 1500"}, ...]}`.
The command pages through the whole set. If `truncated` is ever `true`, say the list is
partial rather than quoting `totalCount` as if you had enumerated it.

- **One vehicle** → use its `tokenId` silently.
- **A few (≤10)** → list them in chat and ask which to use.
- **Many (>10)** → **do not dump the list.** Say how many there are and ask the user to
  narrow it: *"You've got 46 vehicles shared with this key. Which one — you can give me a
  make, model, or year."* Then filter the list yourself and offer the matches. Only show
  the full list if the user explicitly asks for it.
- **None** → the user hasn't shared vehicles with this license. Tell them: *open the DIMO
  app → Account → Advanced settings → Developer API Key → tap "Share all vehicles"*, then
  re-run. (Console fallback: the login.dimo.org sharing link from Phase 1.)

→ Phase 3.

---

## Phase 3: Querying

Read `references/mcp-tools.md` before the first query. The Bearer token always comes from
the auth script — it caches Vehicle JWTs and re-mints the Developer JWT on expiry:

```bash
JWT=$(node "${CLAUDE_PLUGIN_ROOT}/scripts/dimo-auth.mjs" vehicle-jwt <TOKEN_ID>)
```

### Step 1 — Discover signals first, always

Never skip this. Signal names are per-vehicle; a name that works on one car errors or
returns null on another.

```bash
JWT=$(node "${CLAUDE_PLUGIN_ROOT}/scripts/dimo-auth.mjs" vehicle-jwt <TOKEN_ID>)
curl -s --max-time 30 -X POST "https://telemetry-api.dimo.zone/mcp" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"telemetry_get_available_signals","arguments":{"tokenId":<TOKEN_ID>}},"id":1}' \
  | sed 's/^data: //' | tail -n +2 | jq -r '.result.content[0].text' | jq .
```

The response is SSE-wrapped with JSON nested inside JSON — that pipeline unwraps all three
layers. See "Reading the response" in `references/mcp-tools.md`.

Cache the returned list for this vehicle and reuse it for the rest of the conversation.
Re-run it only if the user says data should exist that you didn't see.

- **Empty array** → the vehicle has never reported. Say so plainly and stop; don't keep
  querying a silent car.
- Map the user's question onto names that are actually in the list. If they ask for
  something the vehicle doesn't report (say, tire pressure on a car that only sends
  location), tell them it isn't reported rather than returning nothing.

### Step 2 — Query

Pick the tool from `references/mcp-tools.md`. The two most common ones have required
arguments that are easy to miss:

- `telemetry_get_latest_signals` requires **`signalNames`** — an array of names from Step 1.
- `telemetry_get_signals_time_series` requires **`signalRequests`** — `[{name, agg}]`, plus
  `interval` as a duration string (`"24h"`, never `"1d"`).

`telemetry_get_signals_snapshot` needs neither and returns everything at once — a good
default when the user asks a broad "how's my car?" question.

**Check for errors before reporting data.** API errors arrive as HTTP 200 with an `errors`
array in the innermost JSON. A 401 with `JWT is invalid.` means re-run
`vehicle-jwt <TOKEN_ID> --refresh` and retry **once**; if it fails again the key was
likely rotated — see the Error Reference. Never ask the user for tokens.

### Step 3 — Report

**Always show data age.** Every signal carries a `timestamp`, and snapshots a `lastSeen`.
If data is older than ~1 hour, say so next to the answer (*"last reported 3 weeks ago — the
car hasn't sent data since"*). Never present a stale value as the current state.

Get units from `telemetry_get_schema` rather than guessing — note that speeds are km/h,
pressures kPa, temperatures °C, and convert if the user's phrasing suggests they want
imperial. For location, give a human-readable place alongside the coordinates.

If the preview is running, append a `.signal-card` per query (see
`references/preview-ui.md`). Otherwise format the results directly in chat.

### Vehicle commands (lock, unlock, charge)

**Not available.** The `devices-api.dimo.zone` endpoint these depended on is out of
service. If the user asks to lock, unlock, or control charging, say plainly that command
support is offline and that this plugin can read data only — then offer what telemetry
*can* tell them (lock state, charge level, location). Do not attempt a request. See
`references/commands.md`.

### After the first successful query

Tell the user setup is done for good — credentials are stored, tokens renew automatically —
and show a few example asks grounded in what *their* vehicle actually reports:

- "Where is my car right now?"
- "What's my battery / fuel level?"
- "Show my trips from last week"
- "Any fault codes on my car?"

---

## Error Reference

| Error | Fix |
|---|---|
| HTTP 401 `JWT is invalid.` on a query | `dimo-auth.mjs vehicle-jwt <tokenId> --refresh`, retry once |
| 200 with `errors[]` in the innermost JSON | Read the message — usually a privilege gap or a bad argument, not an auth problem |
| `-32602 missing properties` | A required argument was omitted — check `references/mcp-tools.md` |
| `date range exceeds maximum of 32 days` | Split `telemetry_get_daily_activity` into ≤32-day windows |
| `submit_challenge failed` from script | API key rotated/revoked — app → Developer API Key → "Generate new key", re-run Phase 1 |
| `generate_challenge failed` from script | `DIMO_CLIENT_ID`/`DIMO_DOMAIN` don't match a real license — re-copy from the app, re-run Phase 1 |
| `token exchange failed` from script | Vehicle not shared with this license — app → "Share all vehicles" |
| Empty vehicle list in Phase 2 | Same — share vehicles in the app, re-query |
| Signal missing from results | Confirm with `telemetry_get_available_signals`; the vehicle may not report it |

---

## Additional Resources

- **`references/mcp-tools.md`** — the 12 MCP tools, required parameters, response format, error handling
- **`references/preview-ui.md`** — optional dashboard: HTML template and `preview_eval` snippets
- **`references/commands.md`** — why vehicle commands are disabled, and what to say instead
