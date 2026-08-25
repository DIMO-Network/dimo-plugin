# Vehicle commands — currently unavailable

> **Status: disabled.** The endpoint this feature depended on,
> `devices-api.dimo.zone`, no longer resolves in DNS and has been out of service
> for some time. There is no drop-in replacement yet.
>
> **Do not offer, attempt, or promise vehicle commands.** If the user asks to lock,
> unlock, or control charging, say plainly that command support is offline right now
> and that this plugin can only read data — then offer what you *can* answer (lock
> state, charge level, location) from telemetry. Do not fall back to guessing another
> host, and do not tell the user to try again later as if it were a transient error.

Telemetry can still *report* the states commands would have changed. Discover names
with `telemetry_get_available_signals` first — not every vehicle reports these:

| User wants | Read-only answer |
|---|---|
| "Is it locked?" | `bodyLockIsLocked` |
| "Is it charging / how full?" | `powertrainTractionBatteryChargingIsCharging`, `powertrainTractionBatteryStateOfChargeCurrent` |
| "Are the windows open?" | `cabinDoorRow*WindowIsOpen` |

---

## Restoring this feature

Kept for whoever wires commands back up. **None of the below is live.**

The historical shape was:

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

Note `mcp-dimo`'s `src/tools/vehicle-commands.ts` still points at the same dead host.

### Safety rules that must be restored alongside it

These are non-negotiable preconditions for re-enabling, not documentation of a past
implementation. Commands actuate a real, physical vehicle.

1. **Explicit confirmation every time.** State exactly what will happen to which
   vehicle ("I'm about to **unlock the doors** of your **2019 Tesla Model 3**") and
   wait for the user to confirm in their next message. A general request earlier in
   the conversation is not confirmation for a specific command now.
2. **One command per confirmation.** Never batch or chain commands under a single yes.
3. **Never retry automatically.** If the response is ambiguous or times out, report it
   and let the user decide. A retried unlock is a second unlock.
4. **Report the acknowledgment, not the outcome** — "the command was accepted", not
   "the doors are locked", unless a follow-up signal confirms the new state.
5. Requires **privilege 2 (commands)** on the vehicle's grant. The auth script requests
   exactly the granted privileges, so a grant without privilege 2 yields 403 — point the
   user at the DIMO app to re-share with command access.
