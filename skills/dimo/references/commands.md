# Vehicle commands

Commands actuate the real, physical vehicle. They go to the DIMO Devices API
with the same Vehicle JWT the telemetry tools use.

## Safety rules (non-negotiable)

1. **Explicit confirmation every time.** Before sending any command, state
   exactly what will happen to which vehicle ("I'm about to **unlock the
   doors** of your **2019 Tesla Model 3**") and wait for the user to confirm
   in their next message. A general request earlier in the conversation is
   not confirmation for a specific command now.
2. **One command per confirmation.** Never batch or chain commands under a
   single yes.
3. **Never retry a command automatically.** If the response is ambiguous or
   times out, report it and let the user decide. A retried unlock is a
   second unlock.
4. Commands require **privilege 2 (commands)** on the vehicle's grant. The
   auth script requests exactly the granted privileges, so if the grant
   lacks privilege 2 the call returns 403 — point the user at the DIMO app
   to re-share with command access.

## Endpoint

```
POST https://devices-api.dimo.zone/v1/vehicle/<TOKEN_ID>/commands/<COMMAND>
Authorization: Bearer <VEHICLE_JWT>
Content-Type: application/json
Body: {}
```

| Command | Path |
|---|---|
| Lock doors | `doors/lock` |
| Unlock doors | `doors/unlock` |
| Start charging | `charge/start` |
| Stop charging | `charge/stop` |

```bash
JWT=$(node "${CLAUDE_PLUGIN_ROOT}/scripts/dimo-auth.mjs" vehicle-jwt <TOKEN_ID>)
curl -s --max-time 30 -X POST "https://devices-api.dimo.zone/v1/vehicle/<TOKEN_ID>/commands/doors/lock" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d '{}'
```

A successful response returns a command acknowledgment from the device
backend; actual execution on the vehicle can lag by a few seconds. Report
the acknowledgment honestly — "the command was accepted" rather than "the
doors are locked" — unless a follow-up signal confirms the new state.

## Errors

| Response | Meaning | What to tell the user |
|---|---|---|
| 403 | Grant lacks privilege 2 (commands) | Re-share the vehicle in the DIMO app with command access |
| 404 | Vehicle/command not found or not supported by this connection type | This vehicle's connection doesn't support that command |
| 5xx / timeout | Backend or vehicle unreachable | Command not confirmed — do not assume it ran, do not auto-retry |
