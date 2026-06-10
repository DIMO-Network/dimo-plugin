# Design: Remote-first MCP for dimo-plugin, mobile-app-first onboarding

**Date:** 2026-06-10
**Status:** Approved (rev 2 — remote-first; supersedes the bundled local
mcp-dimo approach from rev 1)
**Repos:** `dimo-plugin` (primary), `telemetry-api` (auth change),
`mcp-dimo` (maintenance mode)

## Problem

Developer adoption of Claude + DIMO is low; feedback says creating a developer
account is too hard. The current plugin onboarding (SKILL.md) requires:

1. Visiting console.dimo.org, applying for a developer license, creating an app.
2. Copying a Developer JWT that expires (~10 min in practice for vehicle JWTs,
   with repeated manual exchanges) and pasting it repeatedly.
3. Clicking a login.dimo.org sharing URL and hand-noting vehicle Token IDs.
4. Manual curl-based token exchange before any query.

The DIMO mobile app now mints a developer license, generates an API key, and
displays exactly the credential triple needed for developer auth
(`DIMO_CLIENT_ID`, `DIMO_PRIVATE_KEY`, `DIMO_DOMAIN`), and auto-shares the
user's vehicles with that license (dimo-driver PRs #3198, #3200).

## Decision: remote-first

DIMO already hosts MCP endpoints on its GraphQL servers
(`https://telemetry-api.dimo.zone/mcp`, and identity equivalent). Running a
local MCP server (mcp-dimo via npx) would replicate remotely-hosted tools on
the user's machine purely to babysit JWTs. Industry direction (GitHub,
Sentry, Linear, Stripe, Cloudflare) is remote MCP + OAuth. The only
legitimately local concern is credential/JWT handling, which is a small
helper script in Phase 1 and disappears entirely in Phase 2.

## Goal

Onboarding collapses to: **open DIMO app → 2 taps → paste 3 values once.**
No expiring-JWT pasting, no manual token IDs, no curl, no local server.
Phase 2 collapses further to: **click Connect → approve in DIMO app.**

## Phase 1 — Developer JWT bearer on hosted MCP

### telemetry-api change

- `/mcp` accepts a **Developer JWT** as the Bearer token (today it requires a
  per-vehicle Vehicle JWT).
- For tool calls carrying a `tokenId` argument, the server performs the
  privilege check internally (the token-exchange logic moves server-side):
  verify the developer license (`sub`/client ID of the JWT) holds the needed
  SACD privileges for that vehicle, then execute. Existing Vehicle JWT auth
  continues to work unchanged.

### dimo-plugin changes

1. **Remote MCP config.** `.mcp.json` at plugin root:

   ```json
   {
     "mcpServers": {
       "dimo-telemetry": {
         "type": "http",
         "url": "https://telemetry-api.dimo.zone/mcp",
         "headers": { "Authorization": "Bearer ${DIMO_DEV_JWT}" }
       },
       "dimo-identity": {
         "type": "http",
         "url": "https://identity-api.dimo.zone/mcp"
       }
     }
   }
   ```

   Identity MCP is public (no auth) and provides vehicle discovery. Exact
   env-injection mechanism for the header (env expansion vs. settings file)
   is an implementation detail of the plan.

2. **Auth helper script** (`scripts/dimo-auth.mjs`, plain Node + viem via
   npx, auth only — NOT an MCP server):
   - Reads `~/.dimo/credentials.env` (`DIMO_CLIENT_ID`, `DIMO_PRIVATE_KEY`,
     `DIMO_DOMAIN`).
   - Mints a Developer JWT via the Auth API challenge flow (generate
     challenge → sign with private key → submit).
   - Caches the JWT alongside the creds file; re-mints when expired. The
     skill invokes it during setup and on 401s.

3. **SKILL.md rewrite.**
   - **Phase 0 — detect state:** creds file present and a probe call to the
     telemetry MCP succeeds → ready; otherwise setup.
   - **Setup (mobile-app-first):** instruct the user:
     *Open DIMO app → Account → Advanced settings → Developer API Key →
     Generate API key → tap "Share all vehicles" → use the copy buttons.*
     Collect the three pasted values, write `~/.dimo/credentials.env`
     (mode 600), run the auth script, confirm a live query.
   - **Fallback (collapsed section):** existing console.dimo.org path for
     users without the mobile app.
   - **Delete** old Phase 1.5 (manual sharing URL + token-ID noting) and
     Phase 2 (JWT paste + curl token exchange). Vehicles shared by the app
     are discovered via the identity MCP (vehicles privileged to the
     client ID).
   - Usage guidance retargeted from curl to native MCP tool calls.

4. **references/mcp-tools.md** updated: same 10 telemetry tools but as
   native MCP tools (no curl), plus identity MCP usage.
   `references/signal-reference.md` unchanged.

5. **README.md** updated to the new install + setup story.

### mcp-dimo (npm)

Maintenance mode. Remains the power-user path for tools not hosted yet
(vehicle commands lock/unlock/charge, minting, attestations, fleet mode).
Whether those move to hosted MCP is a separate decision.

## Phase 2 — OAuth 2.1 on hosted MCP (separate spec when scheduled)

- Implement MCP-spec OAuth 2.1 authorization on the hosted endpoints.
- Claude Code and claude.ai handle the login flow natively: user clicks
  Connect → DIMO login → approve. Zero pasted credentials; auth helper
  script deleted; unlocks claude.ai/Desktop connector distribution.
- DIMO mobile app becomes the login/approval surface (deep link or push),
  making the in-app developer-license feature the center of the flow.

## Credential storage (Phase 1)

- `~/.dimo/credentials.env`, mode 600: `DIMO_CLIENT_ID`, `DIMO_PRIVATE_KEY`,
  `DIMO_DOMAIN`; cached `DIMO_DEV_JWT` written next to it.
- Private key is scoped to the developer license (not the user's wallet),
  revocable on-chain; the mobile app holds the only original. Lost laptop →
  "Generate new key" in app, re-run setup.

## Error handling

- **No credentials:** probe fails → skill routes to setup.
- **401 / expired JWT:** skill runs auth script to re-mint; if mint fails
  (rotated/revoked key) → app "Generate new key" + re-setup.
- **No vehicles shared:** identity query returns none privileged to client
  ID → point at the app's "Share all vehicles" button.

## Testing

- telemetry-api: unit + integration for dev-JWT bearer path, privilege
  denial cases, Vehicle JWT regression.
- Plugin fresh-machine test: install → setup → live telemetry query.
- Auth script: mint, cache, refresh-on-expiry, bad-key error message.

## Out of scope

- Hosting vehicle command / minting tools on remote MCP.
- App deep link (`dimo://account/developer-api-key`) and QR pairing.
- Phase 2 OAuth implementation details (own spec).
