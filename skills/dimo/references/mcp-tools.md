# DIMO Telemetry MCP Tools

All vehicle data queries use the DIMO Telemetry MCP endpoint over plain HTTP (JSON-RPC 2.0).
Never write raw GraphQL. Use only the tools listed here.

## Endpoint

```
POST https://telemetry-api.dimo.zone/mcp
Content-Type: application/json
Authorization: Bearer <VEHICLE_JWT>   ← required for all data tools
```

`get_schema` is the only tool that works without a JWT.

## Call Format

```bash
curl -s -X POST "https://telemetry-api.dimo.zone/mcp" \
  -H "Authorization: Bearer <VEHICLE_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "<TOOL_NAME>",
      "arguments": { <ARGUMENTS> }
    },
    "id": 1
  }'
```

All data tools require `"tokenId": <TOKEN_ID>` (integer) in `arguments`.

## Schema Introspection (no JWT)

To inspect exact parameter schemas for any tool at runtime:

```bash
curl -s -X POST "https://telemetry-api.dimo.zone/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_schema","arguments":{}},"id":1}'
```

Use this when unsure of a tool's accepted parameters — never guess.

## Available Tools (10)

### telemetry_get_available_signals
List signal names that have stored data for the vehicle.
**Always call this first** to discover what the vehicle actually reports.

```json
{ "tokenId": 183644 }
```

Optional: `"filter": { "source": "autopi" }` to narrow by source (`autopi`, `macaron`, `ruptela`, `smartcar`, `tesla`, `compass`).

---

### telemetry_get_latest_signals
Most recent value for each signal the vehicle reports.

```json
{ "tokenId": 183644 }
```

Optional: `"filter": { "source": "autopi" }` (same source options as above)

---

### telemetry_get_signals_time_series
Aggregated signal data over a date range. Use for trends, charts, and history queries.

```json
{
  "tokenId": 183644,
  "from": "2025-04-01T00:00:00Z",
  "to": "2025-04-20T00:00:00Z",
  "interval": "1h",
  "filter": {
    "source": "autopi"
  }
}
```

`filter.source` is optional. Available sources: `autopi`, `macaron`, `ruptela`, `smartcar`, `tesla`, `compass`.

---

### telemetry_get_signals_snapshot
Latest snapshot of all accessible signals for the vehicle.

```json
{ "tokenId": 183644 }
```

---

### telemetry_get_data_summary
Overview of all data stored for the vehicle: counts, first/last seen timestamps, per-signal breakdown.

```json
{ "tokenId": 183644 }
```

Good for understanding data coverage before running other queries.

---

### telemetry_get_trip_segments
Trip and activity segments. Supports multiple detection methods:
`ignition`, `frequency`, `CUSUM`, `idling`, `refuel`, `recharge`.

```json
{
  "tokenId": 183644,
  "startTime": "2025-04-01T00:00:00Z",
  "endTime": "2025-04-20T00:00:00Z"
}
```

Optional: `"segmentType": "ignition"` to filter by detection method.

---

### telemetry_get_daily_activity
Per-day driving activity summaries over a date range.

```json
{
  "tokenId": 183644,
  "startTime": "2025-04-01T00:00:00Z",
  "endTime": "2025-04-20T00:00:00Z"
}
```

---

### telemetry_get_events
Discrete events (e.g. faults, state changes) in a time range.

```json
{
  "tokenId": 183644,
  "startTime": "2025-04-01T00:00:00Z",
  "endTime": "2025-04-20T00:00:00Z"
}
```

---

### telemetry_get_attestations
Verifiable attestations for the vehicle (signed claims from trusted sources).

```json
{ "tokenId": 183644 }
```

---

### telemetry_get_vin_credential
Latest VIN verifiable credential for the vehicle.

```json
{ "tokenId": 183644 }
```

---

## Tool Selection Guide

| User asks for | Tool |
|---|---|
| What data does my car have? | `telemetry_get_available_signals` |
| Current / latest readings | `telemetry_get_latest_signals` |
| History / trend over time | `telemetry_get_signals_time_series` |
| Snapshot at a moment | `telemetry_get_signals_snapshot` |
| Data overview / coverage | `telemetry_get_data_summary` |
| Trip history | `telemetry_get_trip_segments` |
| Daily driving summary | `telemetry_get_daily_activity` |
| Fault or event log | `telemetry_get_events` |
| Verified claims | `telemetry_get_attestations` |
| VIN certificate | `telemetry_get_vin_credential` |

## Error Handling

| HTTP / JSON-RPC error | Cause | Fix |
|---|---|---|
| 401 | Vehicle JWT expired or missing | Re-run Phase 2 JWT exchange |
| Tool returns empty result | Signal not recorded for this vehicle | Confirm via `telemetry_get_available_signals` |
| Parameter error | Wrong argument shape | Call `get_schema` to inspect tool definition |
