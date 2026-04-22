# DIMO Plugin for Claude Code

Query live telemetry from your DIMO-connected vehicle — no terminal required.

The plugin guides you from zero to real-time vehicle signals: developer onboarding, JWT exchange via an in-browser UI, and signal queries powered by the DIMO Telemetry API.

## Features

- Step-by-step DIMO Developer Console onboarding
- In-browser Vehicle JWT exchange (no copy-paste, auto-refreshable)
- Live signal queries via the DIMO Telemetry MCP endpoint
- Full signal reference (speed, battery, fuel, tire pressure, and 80+ more)
- Dark-themed preview UI — results rendered directly in Claude Code

## Prerequisites

- A [DIMO](https://dimo.zone) account with at least one connected vehicle
- Access to the [DIMO Developer Console](https://console.dimo.org)
- Claude Code with the Claude Preview capability enabled

## Installation

```bash
# 1. Add the DIMO marketplace (one-time)
claude plugin marketplace add DIMO-Network/dimo-plugin

# 2. Install the plugin
claude plugin install dimo
```

## Usage

Trigger the skill in any of these ways:

- **Slash command:** `/dimo`
- **Natural language:** "Query my DIMO vehicle data", "Check my car's battery", "Show my vehicle signals"

If you already have a Developer JWT and Token ID, pass them directly:

```
/dimo <developer-jwt> <token-id>
```

The skill will skip onboarding questions and go straight to the JWT exchange.

## How it works

1. **Onboarding** (first time) — Creates a DIMO developer app and shares your vehicle
2. **JWT Exchange** — Trades your Developer JWT for a vehicle-scoped token via an in-browser form
3. **Signal Queries** — Queries the DIMO Telemetry API using 10 structured MCP tools

The Vehicle JWT expires every ~10 minutes. Re-submit the form in the JWT Exchange tab to refresh it.

## Links

- [DIMO Developer Console](https://console.dimo.org)
- [DIMO Developer Docs](https://docs.dimo.zone)
- [DIMO Network](https://dimo.zone)

## License

Apache-2.0 — Copyright © DIMO Network
