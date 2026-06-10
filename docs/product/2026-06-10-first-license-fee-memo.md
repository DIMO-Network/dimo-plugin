# Decision memo: the developer-license fee blocks the first "wow"

**For:** Yev / product + tokenomics
**Context:** Claude plugin onboarding is now ~1 minute, but the first step
mints a developer license with an on-chain fee paid in DIMO from the user's
in-app balance. A new user who wants to ask "where's my car?" hits a paywall
before seeing any value. Conversion folklore and our own adoption feedback
say this is the single biggest remaining drop-off.

## Constraint

`DevLicenseDimo.issueInDimo` charges `licenseCostInUsd1e18` (admin-settable)
in DIMO at spot price. The fee exists to deter squatting and sybil license
farming, and it feeds protocol revenue. Removing it globally invites spam.

## Options

**A. First license free, app-sponsored (recommended).**
The app's paymaster/sponsor wallet covers the fee for a user's first
license, gated by: account age or at least one connected vehicle, one per
wallet, normal price afterward. No contract change if implemented as an
app-side top-up/rebate at mint time; cleaner long-term as a contract-level
`issueSponsored` allowance held by the app's license.
- Cost: bounded (one fee × converting users — exactly the users we want).
- Sybil risk: low with the connected-vehicle gate; a vehicle NFT is a far
  stronger sybil cost than the license fee.

**B. Fee rebate after activity.**
Pay normally, refunded in DIMO after N successful API days. Keeps the
deterrent fully intact.
- Worse conversion: the paywall still hits at minute one; rebates don't fix
  first-session drop-off. More moving parts (tracking, payout).

**C. Free tier at the API layer instead.**
Skip the license for read-only personal use: the hosted OAuth connector
(see oauth plan) authenticates the *user*, not a developer license, so the
consumer path never mints a license at all. The fee then only applies to
actual developers shipping apps — its intended audience.
- This is the structurally right end state, but it waits on the OAuth
  gateway. Doesn't help the plugin path this quarter.

## Recommendation

A now, C as the end state. Ship A behind a feature flag in the app
(sponsor first mint when `vehicleCount >= 1`), measure conversion delta on
the Developer API Key screen, and let the OAuth connector eventually make
the consumer fee question moot. B only if A's sponsorship budget proves
abusable, which the vehicle gate should prevent.

## What's needed to ship A

- Product sign-off on gate (≥1 connected vehicle, one per wallet).
- App: sponsor flow in `useDeveloperLicense` mint path + LaunchDarkly flag.
- Treasury: sponsor wallet funding + monthly cap alert.
- Analytics: funnel events on the fee screen (already have
  `AnalyticEventNames` infra) to measure before/after.
