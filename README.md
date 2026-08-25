# DIMO Plugin for Claude Code

Ask Claude about your car. "Where's my car?", "How's the battery?", "Show me last week's trips." If your vehicle is connected to DIMO, this plugin answers from live telemetry.

Setup takes about a minute and happens mostly in the DIMO mobile app. You paste three values once. After that, tokens renew themselves in the background and you just ask questions.

## What it does

- Walks you through creating an API key in the DIMO app (it's under Account → Advanced settings → Developer API Key; yes, we know that's buried)
- Finds the vehicles you've shared with that key automatically, so you never have to look up a token ID
- Queries live signals through the DIMO Telemetry API: location, battery, fuel, tire pressure, trips, fault codes, and 117 signals in total. It asks your specific car what it reports before querying, so you never get told about a sensor your car doesn't have.
- Handles the JWT minting and refreshing for you. You will never see a token, and that's the point.
- Renders results in a dashboard view when Claude Code's preview capability is available, and in plain chat when it isn't — both work the same

## What you need

- The DIMO mobile app with at least one connected vehicle. Heads up: creating the API key has a small one-time fee, paid from your in-app DIMO balance. If you don't have the app, the [Developer Console](https://console.dimo.org) works too, with a few extra steps.
- Node.js 20 or newer

## Install

```bash
# Add the DIMO marketplace (one time)
claude plugin marketplace add DIMO-Network/dimo-plugin

# Install the plugin
claude plugin install dimo@dimo-vehicle
```

## Using it

Type `/dimo`, or just ask something like "check my car's battery." The first run walks you through setup. Every run after that goes straight to your data.

## What it doesn't do

Read-only. Locking, unlocking, and charge control ran through an endpoint that is no
longer in service, so the plugin won't offer them. It can still tell you whether the
car is locked or charging, if your vehicle reports those signals.

## How it works under the hood

Your API key lives in `~/.dimo/credentials.env` on your machine, readable only by you. A small bundled script signs a challenge with that key to get a Developer JWT, then trades it for short-lived per-vehicle tokens as queries need them. Expired tokens get replaced quietly. Nothing leaves your machine except the API calls to DIMO itself.

If the key ever leaks or you lose the laptop, open the app and tap "Generate new key." The old one stops working and the new one takes its place after a quick re-setup.

## Links

- [DIMO Developer Console](https://console.dimo.org)
- [DIMO Developer Docs](https://docs.dimo.zone)
- [DIMO Network](https://dimo.zone)

## License

Apache-2.0, Copyright © DIMO Network
