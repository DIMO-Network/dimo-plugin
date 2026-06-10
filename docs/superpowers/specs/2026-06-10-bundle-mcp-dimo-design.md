# Design: Bundle mcp-dimo into dimo-plugin, mobile-app-first onboarding

**Date:** 2026-06-10
**Status:** Approved
**Repos:** `dimo-plugin` (primary), `mcp-dimo` (one small change + patch release)

## Problem

Developer adoption of Claude + DIMO is low; feedback says creating a developer
account is too hard. The current plugin onboarding (SKILL.md) requires:

1. Visiting console.dimo.org, applying for a developer license, creating an app.
2. Copying a Developer JWT that expires (~10 min) and pasting it repeatedly.
3. Clicking a login.dimo.org sharing URL and hand-noting vehicle Token IDs.
4. Manual curl-based token exchange before any query.

The DIMO mobile app now mints a developer license, generates an API key, and
displays exactly the credential triple the mcp-dimo server needs
(`DIMO_CLIENT_ID`, `DIMO_PRIVATE_KEY`, `DIMO_DOMAIN`), and auto-shares the
user's vehicles with that license (dimo-driver PRs #3198, #3200). The plugin
does not use any of this yet.

## Goal

Onboarding collapses to: **open DIMO app → 2 taps → paste 3 values → restart
Claude Code.** No expiring JWT pasting, no manual token IDs, no curl.

## Architecture

### dimo-plugin changes

1. **Bundle the MCP server.** Add `.mcp.json` at the plugin root declaring
   server `dimo`:

   ```json
   {
     "mcpServers": {
       "dimo": {
         "command": "node",
         "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/launch.mjs"]
       }
     }
   }
   ```

2. **Launcher script** (`scripts/launch.mjs`, plain Node, no deps):
   - If `~/.dimo/credentials.env` exists, parse it (simple KEY=VALUE lines)
     and merge into `process.env` (existing env vars win).
   - Spawn `npx -y mcp-dimo` with that env, stdio inherited.
   - Cross-platform (no shell sourcing); mcp-dimo launch path unchanged.

3. **SKILL.md rewrite.**
   - **Phase 0 — detect state:** check `~/.dimo/credentials.env` exists and
     `check_vehicle_access_status` succeeds. If not → setup.
   - **Setup (mobile-app-first):** instruct the user:
     *Open DIMO app → Account → Advanced settings → Developer API Key →
     Generate API key → tap "Share all vehicles" → use the copy buttons.*
     Collect the three pasted values, write `~/.dimo/credentials.env` with
     mode 600, tell the user to restart Claude Code (or reconnect MCP).
   - **Fallback (collapsed section):** existing console.dimo.org path for
     users without the mobile app.
   - **Delete** old Phase 1.5 (manual vehicle sharing URL + token-ID noting)
     and Phase 2 (Developer JWT paste + curl token exchange). mcp-dimo mints
     and refreshes the Developer JWT from the private key; vehicles shared by
     the app are discovered via `check_vehicle_access_status`.
   - Usage guidance retargeted to mcp-dimo tools.

4. **references/mcp-tools.md rewrite.** Document the mcp-dimo tool surface
   (`check_vehicle_access_status`, `identity_query`, `telemetry_query`,
   `telemetry_introspect`, `vehicle commands`, attestations, batch tools).
   Remove curl/JSON-RPC instructions for the hosted telemetry MCP endpoint.
   `references/signal-reference.md` is unchanged.

5. **README.md update** reflecting the new install + setup story.

### mcp-dimo change (v2.0.5)

`getEnvConfig()` currently throws when `DIMO_CLIENT_ID` is missing, so a
fresh plugin install shows a failed/red MCP server before setup. Change:

- Start the server without credentials.
- When credentials are missing, every tool returns a clear message:
  "DIMO credentials not configured — run /dimo to set up."
- Publish as a patch release; the plugin launcher picks it up via `npx -y`.

## Credential storage

- File: `~/.dimo/credentials.env`, mode 600, KEY=VALUE format:
  `DIMO_CLIENT_ID`, `DIMO_PRIVATE_KEY`, `DIMO_DOMAIN`.
- The private key is scoped to the developer license (not the user's wallet),
  is revocable on-chain, and the mobile app holds the only original copy.
  A lost/compromised laptop file is remedied by "Generate new key" in the app
  and re-running setup.
- Environment variables already set in the parent process take precedence,
  preserving the existing mcp-dimo configuration path for advanced users.

## Error handling

- **No credentials:** tools return the setup pointer (see mcp-dimo change);
  skill Phase 0 routes to setup.
- **Invalid/rotated key (JWT mint fails):** skill instructs: app → Developer
  API Key → "Generate new key", then re-run setup with new values.
- **No vehicles shared:** `check_vehicle_access_status` returns empty → skill
  points at the app's "Share all vehicles" button (or
  `generate_vehicle_data_sharing_url` for fleet/other-owner cases).

## Testing

- Fresh-machine test: install plugin with no credentials → server starts,
  tools return setup message (not a crashed server).
- Setup test: paste triple → file written 600 → restart → 
  `check_vehicle_access_status` lists the app-shared vehicles.
- E2E: telemetry query round-trip on a shared vehicle.
- Launcher unit check on macOS + Windows (path/spawn behavior).

## Out of scope (future tracks)

- App deep link (`dimo://account/developer-api-key`) and QR pairing for
  zero-typing credential handoff.
- Hosted remote MCP server with DIMO OAuth (claude.ai connector).
