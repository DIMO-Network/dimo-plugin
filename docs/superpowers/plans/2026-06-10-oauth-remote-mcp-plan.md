# OAuth 2.1 remote MCP — engineering plan

Companion to `docs/superpowers/specs/2026-06-10-oauth-remote-mcp-design.md`.
Goal: DIMO appears as a one-click connector in claude.ai, Claude Desktop, and
Claude Code. Target: smallest path to a working connector, not a general
OAuth platform.

## Architecture decision (proposed)

Build a thin **MCP gateway** service (`dimo-mcp-gateway`, Go, standard DIMO
service layout) instead of modifying telemetry-api:

- telemetry-api keeps doing what it does; the gateway terminates MCP +
  OAuth and proxies tool calls with internally-minted Vehicle JWTs.
- The gateway is also where identity tools, command tools (consent-gated),
  and future attestation tools mount — one connector, full surface.
- Auth server work stays inside the existing DIMO auth stack; the gateway
  is a standard OAuth resource server.

## Milestones

### M1 — Authorization server (auth stack)
- `/.well-known/oauth-authorization-server` metadata document.
- Authorization-code + PKCE flow on top of the existing login.dimo.org
  session (web login works day one; app push approval is M4 polish).
- Token endpoint with refresh tokens; access tokens are JWTs carrying the
  DIMO user (wallet) and granted scopes.
- **Dynamic client registration** (RFC 7591) — required by MCP clients;
  this is what removes the developer-console step for end users entirely.
- Scopes: `vehicle:data:read` (privileges 1,3,4,5,6,8), `vehicle:commands`
  (privilege 2, separate consent screen), `vehicle:vin` (5, included in
  read), `attestations:create`.

### M2 — MCP gateway (new repo)
- Streamable-HTTP MCP server in Go; `/.well-known/oauth-protected-resource`
  pointing at M1.
- Tool surface v1: the 10 telemetry tools (proxy to telemetry-api `/mcp`
  with a service-minted Vehicle JWT per call), identity vehicle list, and
  `check_access` (vehicles + privileges for the signed-in user).
- Per-call authorization: user-token wallet → vehicles owned or shared to
  the user → SACD check → mint Vehicle JWT via token-exchange service
  credentials. Cache per (user, vehicle) with the same expiry semantics as
  the plugin script.
- Rate limiting + DCX metering hooks from day one (connector traffic is
  unmetered developer traffic otherwise).

### M3 — Connector launch
- Register with Anthropic's connector directory (claude.ai → Settings →
  Connectors); verify Claude Code `claude mcp add --transport http` and
  Desktop flows.
- dimo-plugin v0.3: `.mcp.json` points at the gateway; auth script,
  credentials file, and preview setup form deleted; skill becomes usage
  guidance only. `~/.dimo` cleanup on first run.

### M4 — Mobile approval surface
- OAuth consent screen offers "Approve in DIMO app" (push / deep link
  `dimo://approve?...`), falling back to web. The in-app developer-license
  screen gains a "Connected AI apps" list with revoke.

## Sequencing and ownership

M1 and M2 can run in parallel (M2 stubs token validation against M1's JWKS
from week one). M3 is days, not weeks, once M1+M2 are in staging. M4 is
independent app work. Suggested first PRs: auth-stack metadata + PKCE
endpoint; gateway repo scaffold with health/metadata endpoints and one
proxied tool behind a fake validator.

## Risks

- Dynamic client registration is the only genuinely new auth-stack surface;
  scope it to public clients with PKCE-only, no client secrets.
- Commands behind a connector raise the abuse bar: keep `vehicle:commands`
  out of the default scope set and require per-vehicle consent.
- Revocation: SACD revoke and OAuth token revoke must both cut access;
  gateway checks SACD at mint time and caps Vehicle JWT cache at 10 min,
  matching today's exposure window.
