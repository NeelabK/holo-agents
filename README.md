# Holo Agents

A web app for talking to AI hologram characters by voice. Pick a character from the carousel, connect, and have a real-time conversation with them.

<!-- Add a screenshot or GIF of the hologram carousel here -->

## Features

- **Hologram carousel** of characters (Steve Jobs, Marcus Aurelius, Rick Sanchez, Hermione Granger, MrBeast), each with its own personality and voice
- **Real-time voice conversations** powered by [Ultravox](https://ultravox.ai)
- **Custom personas** defined in `system_prompts.yaml`, so adding or tweaking a character is just a text edit
- **Token-gated access** that checks a Solana wallet's on-chain balance before allowing calls

## How it works

```
Browser                         Express server                 External services
───────                         ──────────────                 ─────────────────
1. Connect Solana wallet ──────► GET /checkWallet ────────────► Helius RPC
                                  reads the wallet's SPL           (on-chain token balances)
                                  token accounts, compares
   ◄──────────── hasEnoughHolo ── balance to the threshold

2. Pick a character
   load its persona from
   system_prompts.yaml

3. Start call ─────────────────► POST /startCall ─────────────► Ultravox API
                                  attaches the API key             creates a call with the
   ◄────────────────── joinUrl ── server-side                      persona + voice

4. Join the call over WebRTC ─────────────────────────────────► Ultravox
   (ultravox-client), with live audio, mute and a session timer
```

A few design decisions:

- **API keys never reach the browser.** The client asks the Express server to create a call, and only the server holds the Ultravox and Helius keys.
- **Token checks happen server-side**, so the gate can't be skipped by editing front-end code.
- **Personas are data, not code.** Each character is a prompt in `system_prompts.yaml` plus a voice ID in `main.js`, so new characters need no new logic.

## Tech stack

- Node.js + Express
- Ultravox (voice AI)
- Solana web3.js + Helius RPC
- Webpack

## Getting started

You'll need Node.js 20.6 or newer.

```bash
git clone https://github.com/NeelabK/holo-agents.git
cd holo-agents
npm install
cp .env.example .env
```

Open `.env` and fill in your settings:

```
ULTRAVOX_API_KEY=your-ultravox-api-key
HELIUS_API_KEY=your-helius-api-key
ACCESS_TOKEN_MINT=your-token-mint-address
MIN_TOKEN_BALANCE=1
BYPASS_WALLETS=
```

`BYPASS_WALLETS` is optional: a comma-separated list of wallets that skip the token check.

Then build the front end and start the server:

```bash
npm run build
npm start
```

and open http://localhost:3000.

## Adding a character

1. Add a persona under `system_prompts.yaml`
2. Map the character's display name to that persona in the `voiceMap` in `main.js`
3. Add a slide for them in the carousel in `index.html`
4. Rebuild with `npm run build`

## Status

This is a prototype/beta. Expect rough edges.

## Disclaimer

The characters are AI parodies made for entertainment. They aren't affiliated with or endorsed by the real people they're based on.
