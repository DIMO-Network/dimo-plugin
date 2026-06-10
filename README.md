# DIMO Plugin for Claude Code

Query live telemetry from your DIMO-connected vehicle — no terminal, no console, no JWT copying.

The plugin guides you from zero to real-time vehicle signals: 1-minute credential setup from the DIMO mobile app, automatic JWT handling, and signal queries powered by the DIMO Telemetry API.

## Features

- 1-minute setup from the DIMO mobile app (Account → Advanced settings → Developer API Key)
- Automatic JWT handling — Developer and Vehicle JWTs are minted, cached, and refreshed locally; nothing to copy after setup
- Auto-discovery of vehicles shared with your developer license
- Live signal queries via the DIMO Telemetry MCP endpoint
- Full signal reference (speed, battery, fuel, tire pressure, and 80+ more)
- Dark-themed preview UI — results rendered directly in Claude Code

## Prerequisites

- The [DIMO mobile app](https://dimo.org) with at least one connected vehicle (the [Developer Console](https://console.dimo.org) works as a fallback)
- Node.js >= 20
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

## How it works

1. **Setup** (first time) — Generate a developer API key in the DIMO app, share your vehicles with one tap, paste three values into the in-browser form. Stored in `~/.dimo/credentials.env` (mode 600).
2. **Auth** — A bundled script mints a Developer JWT from your key (web3 challenge flow) and exchanges it per-vehicle; tokens auto-refresh on expiry.
3. **Signal Queries** — Queries the hosted DIMO Telemetry MCP endpoint using 10 structured tools.

## Links

- [DIMO Developer Console](https://console.dimo.org)
- [DIMO Developer Docs](https://docs.dimo.zone)
- [DIMO Network](https://dimo.zone)

## License

Apache-2.0 — Copyright © DIMO Network
