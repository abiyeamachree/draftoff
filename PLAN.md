# DraftOff — Multiplayer Football Draft

A real-time multiplayer web app where players join a lobby, take part in a live **snake draft** of footballers from across football history (sourced from the SoFIFA dataset already in this repo), then have their squads play out a simulated **knockout or round-robin tournament**.

This document is the architectural plan. The web client and socket contract exist as scaffolding; the Python backend is not yet implemented.

---

## 1. Guiding principles

- **Server-authoritative.** The Python/Socket.IO server is the single source of truth for all game state. The frontend renders state it receives and *requests* actions; it never mutates authoritative state locally. Every pick, timer expiry, and tournament advance is decided and validated on the server.
- **Never trust the client.** All inputs (pick a player, change a setting, start the draft) are re-validated server-side against the current authoritative state.
- **No race conditions on picks.** Each lobby's draft is processed through a **single serialized queue** (one async mutex per lobby). Two clients clicking "draft" simultaneously can never both succeed — the second is rejected because it is no longer that player's turn / the player is gone.
- **Modular engine.** Pure game logic (snake ordering, match simulation, bracket generation, team rating) lives in the Python backend as framework-free functions/modules. They take state in and return state/results out, so they are unit-testable without Socket.IO or the DB. The frontend only receives results via the socket contract in `packages/shared`.
- **Clean separation.** Lobby, Draft, Simulation, and Tournament concerns are separate managers/modules and never reach into each other's internals — they communicate through the authoritative game state object.

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js (App Router) + React + TypeScript |
| Styling | TailwindCSS |
| Realtime | Socket.IO (client + server) |
| Backend | **Python** (FastAPI or Flask) + `python-socketio` |
| DB | PostgreSQL (SQLAlchemy + Alembic, or similar) |
| Shared contract | `packages/shared` (TypeScript types + socket event names for the web client) |
| Monorepo | pnpm workspaces (web + shared); Python backend in `apps/server/` |

### 2.1 Deployment (cheapest path)

Goal: **$0 while building**, only pay when real users need it.

| Piece | Where | Cost |
|-------|-------|------|
| Website (Next.js) | **Vercel** free tier | Free |
| Game server (Socket.IO) | **Render** or **Railway** free/hobby tier | Free → ~$5/mo if you need it always-on |
| Database | **Neon** Postgres free tier | Free |

**Why the game server can't live on Vercel:** Vercel spins your code down when nobody's hitting it. A live draft needs the server running the whole time — timers ticking, picks syncing, everyone connected. That needs an always-on Python process on Render/Railway, not serverless.

**Skip for now (add only when you actually need them):**

| Service | What it's for | Why skip now |
|---------|---------------|--------------|
| **Redis** | Sharing lobby state across multiple server machines | One server is enough until you have lots of concurrent lobbies or need zero-downtime deploys |
| **Cloudflare R2** | Storing files (player photos, avatars, exports) outside the database | You don't have user-uploaded files yet. Player data comes from the SoFIFA CSV in Postgres. R2 is for *files* — images, PDFs, backups — not live game state. Add it later if you want custom avatars or cached player headshots from URLs |

### 2.2 Live state vs database (don't write to Postgres on every pick)

A lobby is temporary. During gameplay the server keeps authoritative state **in memory** and broadcasts instantly. Postgres is for durability, not realtime speed.

**Wrong pattern:**
```
Pick Messi → write DB → read DB → broadcast
```

**Correct pattern:**
```
Pick Messi → update in-memory lobby → broadcast instantly → persist in background
```

**When to hit Postgres:**
- **Every pick:** one small append-only `DraftPick` insert (fire-and-forget, off the hot path) so you can recover if the server crashes mid-draft.
- **Lobby snapshots:** on status changes (`LOBBY → DRAFTING → SIMULATING → FINISHED`) and optionally a debounced periodic flush while drafting — not on every click.
- **Player pool:** seeded once from CSV; reads during draft come from memory/cache, not repeated DB round-trips.

---

## 3. Repository layout

```
draftoff/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   ├── app/             # App Router pages: home, lobby, draft, results
│   │   ├── components/      # PlayerCard, DraftBoard, PlayerPool, Timer, ...
│   │   ├── hooks/           # useSocket, useLobby, useDraft
│   │   └── lib/             # typed socket.io-client singleton
│   └── server/              # Python + FastAPI/Flask + python-socketio (TBD)
│       ├── src/             # socket handlers, managers, engine, db
│       ├── alembic/         # migrations (TBD)
│       └── pyproject.toml   # dependencies
├── packages/
│   └── shared/              # TypeScript types + socket contract (web client only)
│       └── src/
│           ├── types/       # domain types (player, lobby, draft, match, tournament)
│           └── socket/      # ClientToServer / ServerToClient event contracts
├── sofifa_all_players.csv   # player pool source data (gitignored, 182MB)
├── sofifa_scrape.py         # existing scraper
├── package.json             # workspace root
├── pnpm-workspace.yaml
└── .env.example
```

---

## 4. Data model (PostgreSQL)

Seven core tables. Notes on the non-obvious ones:

- **FootballPlayer** — one row per `(player_id, edition)` from the CSV. The same footballer appears in multiple FIFA editions. The **"Peak cards"** lobby setting decides the pool:
  - *Peak cards ON*: collapse to each footballer's single highest-`overall` edition ("peak" version).
  - *Peak cards OFF*: use only the latest edition (FC 26) version of each footballer.
  - Either way a footballer can only be drafted once per lobby (uniqueness on the footballer, not the row).
- **Lobby** — holds a join `code`, `hostId`, `status` (`LOBBY | DRAFTING | SIMULATING | FINISHED`), and the embedded `settings` (team size, timer, tournament type, peak cards). Authoritative live state is held in memory by the server during play and snapshotted to the DB.
- **LobbyPlayer** — a user's membership in a lobby: ready state, draft slot/order, connection status (for reconnection).
- **DraftPick** — append-only log: which `LobbyPlayer` took which `FootballPlayer` at which overall pick number / round. This is the source of truth for "who owns whom" and what's unavailable.
- **Match / Tournament** — bracket structure, per-match results (scoreline + goal events), progression.

Schema will be defined in the Python backend (SQLAlchemy models + Alembic migrations). Mirror the event payloads in `packages/shared/src/socket/events.ts` when implementing handlers.

---

## 5. Real-time protocol (the socket contract)

The single source of truth for client/server messages is `packages/shared/src/socket/events.ts`:

- `ClientToServerEvents` — actions the client requests: `lobby:create`, `lobby:join`, `lobby:setReady`, `lobby:updateSettings`, `lobby:start`, `draft:pick`, `draft:search`, `reconnect:resume`.
- `ServerToClientEvents` — authoritative broadcasts: `lobby:state`, `draft:state`, `draft:turn`, `draft:picked`, `draft:tick`, `sim:matchResult`, `tournament:state`, `error`.

Rules:
- Clients **request**, server **confirms by broadcasting new authoritative state**. Optimistic UI is allowed visually but is always reconciled to the next `*:state` broadcast.
- Each lobby is a Socket.IO **room** (`lobby:<code>`); state broadcasts target the room.

---

## 6. Draft engine (server-authoritative flow)

1. Host starts → server builds the **snake order** from ready players and locks the player pool.
2. Server tracks `currentPickIndex`, starts a **per-lobby timer** for the active player.
3. On `draft:pick`, the action enters the lobby's **serial queue (mutex)**. The handler validates:
   - it is this user's turn,
   - the footballer is still available,
   - the user's squad isn't full.
   On success: update in-memory state, broadcast `draft:picked` + `draft:turn`, reset timer, then async-insert `DraftPick` (see §2.2).
4. On **timer expiry**, server auto-picks a random available player (best-available heuristic optional) using the same queued path.
5. **Reconnection**: client sends `reconnect:resume` with lobby code + identity; server replays current authoritative `draft:state`.

---

## 7. Simulation engine

Lightweight probabilistic model in the Python engine. **No AI commentary** — only templated strings.

Inputs per match: two squads with computed team ratings.
Approach (to implement):
- Convert each team's rating into an attacking strength; expected goals derived from strength differential + base rate.
- Sample goals with randomness (e.g. Poisson-like draw) + a small variance term + an **upset factor** that gives weaker teams a non-trivial chance.
- For each goal, pick a scorer weighted by attacking players' ratings, and emit a templated commentary line:
  - `"{SCORER} scores a stunning long-range strike!"`
  - `"{SCORER} capitalizes on a defensive mistake!"`
- Output: `MatchResult { homeScore, awayScore, goals: GoalEvent[], commentary: string[] }`.

Keep it pure and seedable so matches are reproducible/testable.

---

## 8. Tournament engine

Tournament logic in the Python backend:
- **Knockout**: `generateBracket(teams)` → rounds of pairings (byes if non-power-of-two), `advance(bracket, results)` → next round, until a winner.
- **Round robin**: every team plays every other once; rank by points (W=3/D=1/L=0), tiebreak by goal difference. Final leaderboard.
- Server drives progression: simulate a round → broadcast `sim:matchResult` per match + `tournament:state` → repeat until `FINISHED`, then a final winner/leaderboard screen.

---

## 9. Frontend pages

| Route | Purpose |
|-------|---------|
| `/` | Create lobby / join by code |
| `/lobby/[code]` | Lobby: player list, ready toggle, host settings, start |
| `/draft/[code]` | Live draft: turn indicator, timer, searchable pool, my squad, draft board |
| `/results/[code]` | Tournament bracket/standings, match results, final winner |

All pages subscribe to authoritative state via the typed socket client; no game rules live in the frontend.

---

## 10. Implementation milestones

> **Order matters: get multiplayer sync solid before any UI polish.**

1. **M0 — Scaffolding.** Monorepo, web client, shared socket contract, Python backend scaffold. Nothing playable yet.
2. **M0b — Python backend.** FastAPI/Flask + python-socketio, DB models, seed from `sofifa_all_players.csv`.
2. **M1 — Lobby sync.** Create/join by code, room membership, ready/unready, host settings, presence + reconnection. Prove N clients stay in sync.
3. **M2 — Draft engine.** Snake order, serialized pick queue, validation, timer + auto-pick, global unavailability, searchable pool. This is the core correctness milestone.
4. **M3 — Squad + rating.** Squad view, team rating computation, player cards.
5. **M4 — Simulation.** Probabilistic match sim + templated commentary.
6. **M5 — Tournament.** Bracket/round-robin generation, progression, results + final leaderboard.
7. **M6 — Polish.** Responsive UX, animations, edge cases, persistence hardening.

---

## 11. Local dev (once dependencies are installed)

```bash
pnpm install
# start Postgres (e.g. docker run --name draftoff-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres)
cp .env.example .env            # fill DATABASE_URL etc.

# Frontend
pnpm --filter @draftoff/web dev

# Backend (once apps/server Python scaffold exists)
cd apps/server && python -m venv .venv && .venv/Scripts/activate  # Windows
pip install -e .
python -m draftoff  # or uvicorn entrypoint — TBD
```

> The Node.js backend was removed. Game logic and DB access will live in `apps/server` (Python). The web client still uses `packages/shared` for typed socket events.
