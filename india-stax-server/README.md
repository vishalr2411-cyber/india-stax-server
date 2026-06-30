# India STAX — Real-Time Multiplayer Investment Simulation

This is the full backend + frontend for India STAX with **true real-time multiplayer**.
You host, your teams join with a room code, everyone plays on the SAME shared 20-year
market simulation, and you (the host) see a live leaderboard updating in real time.

---

## What's inside

- `server.js` — Node.js + Express + Socket.io backend. Runs the shared game clock,
  holds all room/team state in memory, broadcasts live ticks to everyone.
- `marketData.js` — All 30 years of market data (1997–2026), stock pool, sector logic.
- `public/index.html` — Single frontend file. Detects whether you're the host or a
  joining team and renders the right view. Talks to the server over WebSockets.

---

## How to deploy (free, ~5 minutes) — Render.com

1. Go to **https://render.com** and sign up (free, no credit card needed for this tier).
2. Click **New +** → **Web Service**.
3. Choose **"Deploy an existing image or upload code"** → pick **"Upload code"** /
   drag-and-drop this entire folder (or push it to a GitHub repo first and connect that repo — either works).
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free
5. Click **Create Web Service**. Wait ~2 minutes for the first deploy.
6. You'll get a live URL like `https://india-stax.onrender.com` — **this is the link
   you share with everyone.**

**Important free-tier note:** Render's free tier spins down after 15 minutes of
inactivity and takes ~30–50 seconds to wake up on the next visit. For your event,
open the link yourself about 2 minutes before teams join so it's already "warm."

---

## Alternative: Railway.app (also free, slightly faster cold starts)

1. Go to **https://railway.app**, sign up.
2. **New Project** → **Deploy from GitHub repo** (push this folder to a new GitHub
   repo first) or use **Empty Project** → drag in the files via their CLI.
3. Railway auto-detects Node.js, runs `npm install` and `npm start` automatically.
4. Under **Settings → Networking**, click **Generate Domain** to get your public URL.

---

## How the game actually works once deployed

1. **You open the link** → click **Create** → you become the host → you get a 6-character room code.
2. **You share the link + code** with your 15 teams (any way — WhatsApp, projector, etc).
3. **Each team** opens the same link, enters their team name + your room code, and joins your lobby. You'll see their names appear live on your screen.
4. **You click "Start game for everyone"** — this is the only manual trigger. The server then:
   - Randomly picks a 20-year window from 1997–2026
   - Randomly picks 4 stocks (one per sector) and assigns them codenames
   - Starts the same shared clock for every connected device
5. **All teams trade independently** on their own device — the server holds the source of truth for everyone's cash, holdings, and net worth.
6. **You (host)** see a live, real-time leaderboard the entire time — no need to ask teams how they're doing.
7. **At Year 20, Month 12**, the game auto-ends for everyone simultaneously. Stock identities and the real historical period are revealed on every screen at once.

---

## Running locally to test first (optional)

```bash
npm install
npm start
```

Then open `http://localhost:3000` in multiple browser tabs/windows to simulate
host + multiple teams before your real event.

---

## Notes

- All game state lives in server memory — if the server restarts mid-game, that game's
  state is lost (fine for a single event; rooms are cheap to recreate).
- No database needed — this is intentionally lightweight for a one-off event.
- Capacity: comfortably handles 15 teams + 1 host on the free tiers above.
