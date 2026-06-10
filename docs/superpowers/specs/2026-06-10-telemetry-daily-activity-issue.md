# Drafted issue for DIMO-Network/telemetry-api (not yet filed)

File with:

```sh
gh issue create --repo DIMO-Network/telemetry-api \
  --title "MCP: telemetry_get_daily_activity hangs / returns empty body with valid params" \
  --body-file docs/superpowers/specs/2026-06-10-telemetry-daily-activity-issue.md
```

(strip this header first, or paste the body below into GitHub)

---

## Repro

Against production `https://telemetry-api.dimo.zone/mcp` with a valid Vehicle JWT (vehicle 107505, actively reporting):

```
POST /mcp
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"telemetry_get_daily_activity","arguments":{"tokenId":107505,"from":"2026-06-08T00:00:00Z","to":"2026-06-10T00:00:00Z","mechanism":"ignitionDetection"}},"id":1}
```

- Param validation passes (an invalid `mechanism` correctly returns `-32602` with the enum list, so the request shape is right).
- With valid params the connection returns an empty body / hangs past 60s (`curl --max-time 60` exits with no output). Reproduced twice, including a 2-day range.
- Other tools on the same endpoint and JWT respond fine (`telemetry_get_signals_snapshot`, `telemetry_get_available_signals`, `telemetry_get_latest_signals`).

Observed 2026-06-10 while testing the Claude plugin (DIMO-Network/dimo-plugin). `telemetry_get_trip_segments` shares the mechanism/config input shape and may be affected too — untested.

## Expected

Either a result within a reasonable timeout or a JSON-RPC error.
