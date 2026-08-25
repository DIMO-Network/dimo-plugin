# DIMO Telemetry MCP Tools

All vehicle data queries use the DIMO Telemetry MCP endpoint over plain HTTP (JSON-RPC 2.0).
Never write raw GraphQL by hand. Use the tools listed here.

Everything below was verified against the live endpoint. Where a tool has required
parameters, they are listed — omitting one returns a JSON-RPC `-32602` error, not data.

## Endpoint

```
POST https://telemetry-api.dimo.zone/mcp
Content-Type: application/json
Authorization: Bearer <VEHICLE_JWT>   ← required for all data tools
```

Obtain the Vehicle JWT from the bundled auth script — never ask the user for it:

```bash
JWT=$(node "${CLAUDE_PLUGIN_ROOT}/scripts/dimo-auth.mjs" vehicle-jwt <TOKEN_ID>)
```

The script caches tokens and silently re-mints on expiry. `telemetry_get_schema` is the
only tool that works without a JWT.

## Call format

```bash
curl -s --max-time 30 -X POST "https://telemetry-api.dimo.zone/mcp" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"<TOOL>","arguments":{<ARGS>}},"id":1}'
```

## Reading the response — three layers, not one

This trips up every first attempt. The response is **Server-Sent Events**, and the payload
is JSON nested inside JSON:

```
event: message
data: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\"data\":{...}}"}]}}
```

1. Strip the SSE framing — the payload is the `data: ` line, not the whole body.
2. Parse it as JSON-RPC. `result.content[0].text` is a **string**.
3. Parse *that* string as JSON to get `{ "data": ..., "errors": [...] }`.

Piping the raw body straight into `jq` fails. Unwrap it in one step:

```bash
| sed 's/^data: //' | tail -n +2 | jq -r '.result.content[0].text' | jq .
```

**API errors come back as HTTP 200.** Do not branch on status code alone — a permission
problem, a bad date range, and a missing signal all return `200` with an `errors` array
inside layer 3. Always check for `errors` before reporting data.

```json
{"errors":[{"message":"date range exceeds maximum of 32 days","path":["dailyActivity"]}],"data":null}
```

The exceptions, which *are* real HTTP statuses:

| Status | Body | Meaning |
|---|---|---|
| 401 | `{"message":"JWT is invalid."}` | Malformed or expired bearer — re-mint with `vehicle-jwt <id> --refresh`, retry once |
| 200 | `errors: [{"message":"unauthorized: jwt missing"}]` | `Authorization` header absent |
| 200 | `error: {"code":-32602,...}` | Wrong arguments — a required property is missing |

## Signal names: always discover, never assume

There is no static list of signal names in this plugin, on purpose — the set differs per
vehicle and changes over time. **Call `telemetry_get_available_signals` before any tool that
takes signal names**, and only pass names it returned. If you need units or descriptions,
call `telemetry_get_schema` (no JWT) — it returns the full field table with units,
descriptions, and the privilege each signal requires.

## The 12 tools

### telemetry_get_available_signals — start here
Signal names that have stored data for this vehicle.
**Required:** `tokenId`. **Optional:** `filter`.

```json
{ "tokenId": 190284 }
```

Returns e.g. `["currentLocationCoordinates","isIgnitionOn","speed", ...]`. An empty array
means the vehicle has never reported — say so rather than querying on.

---

### telemetry_get_latest_signals
Most recent value for the named signals.
**Required:** `tokenId`, **`signalNames`**. **Optional:** `filter`.

`signalNames` is required. A call with only `tokenId` fails.

```json
{
  "tokenId": 190284,
  "signalNames": ["speed", "currentLocationCoordinates", "powertrainTransmissionTravelledDistance"]
}
```

Each signal returns `{timestamp, value}`; the response also carries a top-level `lastSeen`.

---

### telemetry_get_signals_snapshot
Latest value of every accessible signal in one call — `availableSignals` + `signalsLatest`
combined. Use this when you want everything and don't yet know the signal names.
**Required:** `tokenId`. **Optional:** `filter`.

```json
{ "tokenId": 190284 }
```

---

### telemetry_get_signals_time_series
Aggregated signal data over a date range. Use for trends, charts, history.
**Required:** `tokenId`, `from`, `to`, `interval`, **`signalRequests`**. **Optional:** `filter`.

`signalRequests` is required — a call without it fails.

```json
{
  "tokenId": 190284,
  "from": "2026-08-18T00:00:00Z",
  "to": "2026-08-25T00:00:00Z",
  "interval": "24h",
  "signalRequests": [
    { "name": "speed", "agg": "MAX" },
    { "name": "currentLocationCoordinates", "agg": "LAST" }
  ]
}
```

- `interval` is a duration string: `ms`, `s`, `m`, `h`. **Days are not a valid unit — use
  `"24h"`, never `"1d"`.**
- `agg` for float signals: `AVG`, `MED`, `MAX`, `MIN`, `RAND`, `FIRST`, `LAST`.
- `agg` for location signals: `AVG`, `RAND`, `FIRST`, `LAST`.

---

### telemetry_get_data_summary
Coverage overview: total signal count, available signal names, first/last seen, per-signal
and per-event breakdown. Cheap way to check whether a vehicle has data at all.
**Required:** `tokenId`. **Optional:** `filter`.

```json
{ "tokenId": 190284 }
```

---

### telemetry_get_trip_segments
Trip and activity segments.
**Required:** `tokenId`, `from`, `to`, `mechanism`.
**Optional:** `config`, `signalRequests`, `eventRequests`, `limit`, `after`.

```json
{
  "tokenId": 190284,
  "from": "2026-08-18T00:00:00Z",
  "to": "2026-08-25T00:00:00Z",
  "mechanism": "ignitionDetection"
}
```

`mechanism`: `ignitionDetection`, `frequencyAnalysis`, `changePointDetection`, `idling`,
`refuel`, `recharge`.

---

### telemetry_get_daily_activity
Per-day driving summaries.
**Required:** `tokenId`, `from`, `to`, `mechanism`.
**Optional:** `config`, `signalRequests`, `eventRequests`, `timezone`.

```json
{
  "tokenId": 190284,
  "from": "2026-07-25T00:00:00Z",
  "to": "2026-08-25T00:00:00Z",
  "mechanism": "ignitionDetection"
}
```

> **Hard limit: 32 days.** A wider range returns HTTP 200 with
> `"date range exceeds maximum of 32 days"` in the `errors` array. Split longer spans into
> consecutive ≤32-day windows. Heavy computation — always pass `--max-time 30` to curl.

---

### telemetry_get_events
Discrete events (faults, state changes) in a time range.
**Required:** `tokenId`, `from`, `to`. **Optional:** `filter`.

```json
{ "tokenId": 190284, "from": "2026-08-01T00:00:00Z", "to": "2026-08-25T00:00:00Z" }
```

---

### telemetry_get_attestations
Verifiable attestations (signed claims from trusted sources).
**Required:** none. **Optional:** `tokenId`, `subject`, `filter`.

```json
{ "tokenId": 190284 }
```

---

### telemetry_get_vin_credential
Latest VIN verifiable credential.
**Required:** `tokenId`.

```json
{ "tokenId": 190284 }
```

---

### telemetry_get_schema — no JWT needed
Returns the full GraphQL schema: all 117 signal fields with units, descriptions, and the
privilege each requires, plus every input type and enum. Use it for units when rendering,
and whenever you are unsure of an argument shape.
**Required:** none.

```bash
curl -s --max-time 30 -X POST "https://telemetry-api.dimo.zone/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"telemetry_get_schema","arguments":{}},"id":1}'
```

---

### telemetry_query — escape hatch, avoid
Raw GraphQL passthrough. **Required:** `query`. **Optional:** `variables`.
Only reach for this if a typed tool genuinely cannot express the request, and read
`telemetry_get_schema` first. The typed tools above cover every documented use case.

---

## The `filter` argument

`filter.source` is a **source ethr DID**, not a friendly name:

```json
{ "tokenId": 190284, "filter": { "source": "did:ethr:137:0xcd445F4c6bDAD32b68a2939b912150Fe3C88803E" } }
```

Passing a word like `"tesla"` or `"autopi"` does **not** error — it silently matches
nothing and returns `null`. Omit `filter` unless you have a real DID in hand; source DIDs
appear in `telemetry_get_data_summary` output.

## Inspecting schemas at runtime

Two ways, both without a JWT:

- `telemetry_get_schema` (a `tools/call`) — GraphQL types, signal fields, units.
- `tools/list` (a JSON-RPC **method**, not a tool) — exact `inputSchema` per tool:

```bash
curl -s --max-time 30 -X POST "https://telemetry-api.dimo.zone/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
```

## Tool selection

| User asks for | Tool |
|---|---|
| What data does my car have? | `telemetry_get_available_signals` |
| Current / latest readings | `telemetry_get_latest_signals` (needs `signalNames`) |
| Everything at once, names unknown | `telemetry_get_signals_snapshot` |
| History / trend over time | `telemetry_get_signals_time_series` (needs `signalRequests`) |
| Data overview / coverage | `telemetry_get_data_summary` |
| Trip history | `telemetry_get_trip_segments` |
| Daily driving summary | `telemetry_get_daily_activity` (≤32 days) |
| Fault or event log | `telemetry_get_events` |
| Verified claims | `telemetry_get_attestations` |
| VIN certificate | `telemetry_get_vin_credential` |
| Signal units / descriptions | `telemetry_get_schema` |

## Error reference

| Symptom | Cause | Fix |
|---|---|---|
| HTTP 401, `JWT is invalid.` | Bearer expired or malformed | `vehicle-jwt <id> --refresh`, retry once |
| 200, `unauthorized: jwt missing` | No `Authorization` header sent | Add the bearer |
| 200, `-32602 missing properties` | Required argument omitted | Check the required list above; `tools/list` for exact schema |
| 200, `date range exceeds maximum of 32 days` | `daily_activity` window too wide | Split into ≤32-day windows |
| 200, `errors[].message` mentions a privilege | Grant lacks that privilege | Re-share the vehicle in the DIMO app |
| `data` present but signal absent / `null` | Vehicle never reported it | Confirm with `telemetry_get_available_signals` |
| Empty array from `available_signals` | Vehicle has no stored data | Tell the user plainly; do not keep querying |
