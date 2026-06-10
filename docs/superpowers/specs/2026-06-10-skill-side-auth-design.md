# Design: dimo-plugin mobile-app-first onboarding, skill-side auth

**Date:** 2026-06-10
**Status:** Approved (rev 3 — no backend changes, no local MCP server;
auth handled in the skill via a bundled helper script)
**Repos:** `dimo-plugin` only

## Problem

Developer adoption of Claude + DIMO is low; feedback says creating a
developer account is too hard. The current plugin onboarding (SKILL.md)
requires:

1. Visiting console.dimo.org, applying for a developer license, creating an
   app.
2. Copying a Developer JWT from the console and pasting it into the skill.
3. Clicking a login.dimo.org sharing URL and hand-noting vehicle Token IDs.
4. Manual curl-based token exchange, repeated as Vehicle JWTs expire
   (~10 minutes).

The DIMO mobile app now mints a developer license, generates an API key,
and displays exactly the credential triple needed for developer auth
(`DIMO_CLIENT_ID`, `DIMO_PRIVATE_KEY`, `DIMO_DOMAIN`), and auto-shares the
user's vehicles with that license (dimo-driver PRs #3198, #3200).

## Decision

- **Tools stay remote.** All data access continues through the hosted MCP
  endpoint (`POST https://telemetry-api.dimo.zone/mcp`) exactly as the
  skill does today. No local MCP server; no replication of hosted tools.
- **No backend changes.** telemetry-api keeps requiring a Vehicle JWT
  bearer. The dev JWT → vehicle JWT exchange is orchestrated by the skill.
- **The skill owns auth**, backed by one small bundled helper script whose
  only job is the credential lifecycle (signing requires code; everything
  else is curl).
- The mobile app becomes the primary credential source; console.dimo.org
  becomes the fallback.

## Goal

Onboarding collapses to: **open DIMO app → 2 taps → paste 3 values once.**
After that, the skill silently maintains all JWTs. No expiring-JWT pasting,
no manual token IDs.

## Components

### 1. Auth helper script (`scripts/dimo-auth.mjs`)

Plain Node (deps via npx, e.g. viem for signing). NOT an MCP server — a
CLI the skill shells out to.

- `setup` — prompts/accepts the three values, writes
  `~/.dimo/credentials.env` (mode 600).
- `vehicle-jwt <tokenId>` — ensures a valid Developer JWT (mint via Auth
  API challenge flow: generate challenge → sign with private key → submit;
  cached until expiry), then exchanges it at
  `token-exchange-api.dimo.zone/v1/tokens/exchange` for a Vehicle JWT
  (cached until its ~10-min expiry). Prints the Vehicle JWT to stdout.
- `status` — reports creds present/missing, JWT validity.

The skill never handles the private key directly; it only consumes tokens
from the script.

### 2. SKILL.md rewrite

- **Phase 0 — detect state:** run `dimo-auth.mjs status`. Ready → query
  flow. Missing creds → setup.
- **Setup (mobile-app-first):** instruct the user:
  *Open DIMO app → Account → Advanced settings → Developer API Key →
  Generate API key → tap "Share all vehicles" → use the copy buttons.*
  Collect the three pasted values, run `setup`, confirm with a live query.
- **Fallback (collapsed):** existing console.dimo.org path for users
  without the mobile app.
- **Vehicle discovery:** Identity API (public GraphQL) query for vehicles
  privileged to the client ID — replaces hand-noted Token IDs. The app
  already granted the SACDs via "Share all vehicles".
- **Query flow:** unchanged hosted-MCP curl pattern from
  `references/mcp-tools.md`, except the Bearer token comes from
  `dimo-auth.mjs vehicle-jwt <tokenId>` instead of a user paste. On 401,
  re-run the script (it refreshes) and retry once.
- **Delete** old Phase 1.5 (sharing URL + token-ID noting) and Phase 2
  (Developer JWT paste form).

### 3. references/mcp-tools.md

Tool list and curl format unchanged; auth section updated to source the
Bearer from the helper script.
`references/signal-reference.md` unchanged.

### 4. README.md

Updated install + setup story (mobile app front and center).

## Credential storage

- `~/.dimo/credentials.env`, mode 600: `DIMO_CLIENT_ID`,
  `DIMO_PRIVATE_KEY`, `DIMO_DOMAIN`. Cached JWTs in `~/.dimo/` beside it.
- Private key is scoped to the developer license (not the user's wallet),
  revocable on-chain; the mobile app holds the only original. Lost laptop →
  "Generate new key" in app, re-run setup.

## Error handling

- **No credentials:** `status` says missing → skill routes to setup.
- **Mint fails (rotated/revoked key):** point at app "Generate new key",
  re-run setup.
- **401 mid-session:** script refresh + single retry; persistent failure →
  re-setup guidance.
- **No vehicles shared:** identity query returns none privileged to the
  client ID → point at the app's "Share all vehicles" button.

## Testing

- Script: mint, cache, refresh-on-expiry, exchange, bad-key errors —
  against testnet/dev env where possible.
- Fresh-machine walkthrough: install plugin → app setup path → live
  telemetry query, zero manual JWT handling.
- Fallback path still works (console creds pasted into `setup`).

## Future (separate specs)

- OAuth 2.1 on hosted `/mcp` endpoints → native remote MCP config in
  `.mcp.json`, claude.ai connector distribution, helper script deleted,
  mobile app as login/approval surface.
- App deep link (`dimo://account/developer-api-key`) and QR pairing for
  zero-typing handoff.
- Hosting command/minting tools remotely (today: mcp-dimo npm for power
  users).
