# Design: OAuth 2.1 on hosted DIMO MCP endpoints (Phase 2)

**Date:** 2026-06-10
**Status:** Draft — future track, not scheduled
**Repos:** `telemetry-api` (or a gateway in front of it), DIMO auth stack
(`auth.dimo.zone` / login portal), `dimo-plugin`, DIMO mobile app

## Problem

The current plugin (v0.2.x) reduced onboarding to one credential paste, but a
paste step still exists, the private key lives on the user's laptop, and
distribution is limited to Claude Code (claude.ai and Claude Desktop
connectors expect a remote MCP server with OAuth). The hosted MCP endpoints
already exist (`telemetry-api.dimo.zone/mcp`, identity equivalent); the only
missing piece is standards-based authorization on them.

## Goal

A user adds the DIMO connector in any MCP client (claude.ai, Claude Desktop,
Claude Code), clicks Connect, approves in the DIMO mobile app, and asks
"where's my car?". Zero credentials handled, zero local install. The
in-app developer-license feature becomes the approval surface instead of a
copy-paste source.

## Approach

Implement the MCP authorization spec (OAuth 2.1) on the hosted MCP endpoints:

1. **Authorization server.** Extend the existing DIMO auth stack
   (`auth.dimo.zone`) with the OAuth 2.1 endpoints the MCP spec requires:
   `/.well-known/oauth-authorization-server` metadata, authorization code +
   PKCE flow, token + refresh endpoints, and dynamic client registration
   (MCP clients self-register; this is what removes the developer-console
   step entirely for end users).
2. **Resource server.** `telemetry-api /mcp` validates OAuth access tokens
   as an alternative to today's Vehicle JWT bearer. Token claims carry the
   DIMO user; per-call vehicle authorization happens server-side against
   SACD grants for the user's connected license (the token-exchange logic
   moves behind the endpoint, where rev 2 of the onboarding design already
   wanted it).
3. **Login + approval UX.** The authorization page is login.dimo.org; the
   approval step pushes to the DIMO mobile app (deep link or push
   notification → approve). For users without the app, web login works as
   today.
4. **Scopes.** Map MCP scopes to SACD privilege sets — e.g.
   `vehicle:data:read` → privileges 1,3,4,5,6,8; `vehicle:commands` →
   privilege 2 (consent-gated separately; commands should never ride along
   silently with a data connection).
5. **dimo-plugin v0.3.** `.mcp.json` declares the remote server; the auth
   helper script, credentials file, and paste flow are deleted. The skill
   shrinks to usage guidance (tool selection, signal reference, data-age
   honesty). Claude Code's native OAuth handling does the rest.

## Why this beats extending v0.2

- Kills the last onboarding friction (paste) and the laptop-resident key.
- Unlocks claude.ai / Desktop connector distribution — the audiences that
  never install a CLI.
- One authorization implementation serves every MCP client, ChatGPT
  connectors included, not just Claude.

## Open questions (resolve before scheduling)

- Where the resource-server change lives: inside telemetry-api (Go) or a
  thin MCP gateway fronting telemetry + identity + commands.
- Whether existing dev-license JWTs should also be accepted at `/mcp` for
  fleet/B2B callers, or stay on the data-API surface only.
- Refresh-token lifetime vs. SACD expiry semantics (a revoked share must cut
  off an otherwise-valid token).
- Rate limiting / DCX metering for connector traffic.

## Migration

v0.2 (local auth script) keeps working unchanged; v0.3 ships when the
endpoints land. `~/.dimo` cleanup happens on first v0.3 run.
