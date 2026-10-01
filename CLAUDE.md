# Inky - Project Instructions

## Quick Reference

- **Run locally**: `./run-game.sh` (or `run-game.bat` on Windows) — starts server (nodemon, live reload) + client (Vite HMR)
- **Server only**: `npm run server` (or `npm run server:dev` for nodemon, watches `server/` and `shared/`) from repo root
- **Client only**: `cd inky && npm run dev`
- **Build check**: `cd inky && npx vite build`; lint: `cd inky && npx eslint .`

## Architecture Rules

### Shared code (`shared/`)

`shared/` is imported by both the server (relative paths) and the client (`@shared/...` Vite alias). It is plain ESM with no dependencies.

- `constants.js` — every number that affects a gameplay outcome (sizes, tick/snapshot rates, speeds, ink, ammo, rounds). Rates are **per second**.
- `maps.js` — the single map definition, `getSpawnPosition`, `LEVELS`.
- `matchOptions.js` — host-selected `{ lives, rounds, mapMode, mapSequence }`: `normalizeMatchOptions` (server must run this on client input), `buildMapOrder`, `describeMatchOptions`. Lives/rounds are **per game**, not constants — read `game.options`, never a global.
- `collision.js` — pure geometry.
- `simulation.js` — `stepPlayer`, `inputFromKeys`, `sanitizeInput`. The server and the client's prediction MUST run the identical step, so keep this pure and platform-free.

If a change would make the server and client disagree about movement/collision, it belongs in `shared/`, not on one side.

### Client: Manager State Ownership

Each manager owns its own state. **Do not put new game state on MainScene** — put it on the manager that operates on it.

| Manager | Owns |
|---------|------|
| `PlayerManager` | `currentPlayer`, `isSecondPlayer`, `otherPlayers` (id → `{sprite, interp}`), `predicted`, `correction`, `pendingInputs`, `seq`, `invincibilityTweens` |
| `ProjectileManager` | `projectiles` (id → `{sprite, interp}`), `projectileCount` (mirror of server ammo) |
| `DrawingManager` | `inkPool`, `drawPath`, `pathLength`, `isDrawing`, `graphics` (`currentInk` is a getter: pool − stroke cost) |
| `UIManager` | `scoreboard`, `inkBar`, `projectileContainer`, `projectileSprites`, `livesContainer`, `lifeSprites`, `lives`, `maxLives` |

MainScene only keeps: `gameId`, `socket`, `usernames`, `gameover`, `roundTransitioning`, `currentRound`, `totalRounds`, `currentMap`, `barriers`, `nets`, `roundText`, `countdownText`, `countdownTimer`, `cursors`.

Cross-manager access: `this.scene.playerManager.currentPlayer`, not `this.scene.currentPlayer`.

Both scenes extend `BaseGameScene` (asset preload, background, `rebuildMap()`, `spawnExplosion()`, `showTimedText()`, shutdown wiring). Put behaviour shared by both modes there.

### Client: Networking model

- **Local player is predicted**: `PlayerManager` runs a fixed-step accumulator at `TICK_MS`, applies `stepPlayer` locally, sends `{seq,x,y}` steps as `playerInput`, and reconciles against `players[].seq` in each snapshot. Corrections are smoothed via `CORRECTION_SMOOTHING`.
- **Everything else is interpolated**: remote player and projectiles push `(x, y, performance.now())` into an `Interpolator` (`game/net/Interpolator.js`) and render `INTERPOLATION_DELAY_MS` in the past. Projectile sprites are reconciled **by ID** against each snapshot — never destroy-and-recreate.
- **Ink/ammo/lives/score are server values** read from the snapshot. The client never deducts them in multiplayer; `DrawingManager.onDrawingStateChanged` → `drawingState` tells the server to pause regen.
- **No Phaser physics in multiplayer**. Sprites are plain `add.sprite`/`add.image`; all hits are server-side. Single player still uses arcade physics locally.
- `gameState.paused` is the source of truth for `scene.roundTransitioning`.

### Client: Constants

Gameplay numbers: `shared/constants.js`. Client-only visuals/HUD layout: `inky/src/game/constants.js` (which re-exports shared). Import from `../constants` inside `game/`. Do not inline numbers. Per-frame work uses `delta` (ms) — never a per-frame rate.

### Server: Handler Split

- `index.js` — fixed-timestep accumulator loop (120 Hz sim, 60 Hz snapshots); no game logic here
- `socket.js` — thin orchestrator, don't add logic here
- `lobbyHandlers.js` — lobby CRUD (createGame, joinGame, removeGame, currentGames, ready room)
- `gameHandlers.js` — gameplay (`playerInput`, `drawingState`, `shootProjectile`, `requestGameState`, `requestRematch`, `leaveGame`)
- `Game.js` — authoritative simulation, also emits events directly via `this.io`
- `validateShot.js` — pure validation of a submitted path; returns `{ ok, length, cost }` or `{ ok: false, reason }`

New lobby events go in `lobbyHandlers.js`. New gameplay events go in `gameHandlers.js`.

### Server: Input handling

Inputs are queued per player (`queueInputs`) and drained in `processInputs` under a token bucket (`INPUT_TOKENS_PER_TICK`, `MAX_INPUTS_PER_TICK`), so clients cannot move faster than real time. `lastSeq` is acked in every snapshot. Inputs are drained even while paused (so clients' pending queues clear) but only *applied* while the round is live. `resetForNextRound` acks anything still queued.

### Server: Two Data Stores

- `lobbyGames` (plain object) — room metadata for the lobby UI
- `activeGames` (Map) — live `Game` instances for actual gameplay

Both are passed as `deps` to handler modules.

## Common Pitfalls

- **Server sends `shooter_id`**, not `playerId`, on projectile payloads. Always use `shooter_id` for projectile ownership checks.
- **Server identity is `socket.id`**. Handlers never trust a client-sent `playerId`; don't add one to new events.
- **Listener cleanup is critical**. Any socket or window event listener must be removable — store handler references, don't use anonymous arrows for `.on()` calls that need `.off()` later. Remove them in `MainScene.onShutdown()` / `SocketManager.destroy()`.
- **Phaser has no `shutdown()` method hook** — it emits `shutdown`/`destroy` events. `BaseGameScene` wires those to `onShutdown()`; override that, never define `shutdown()`.
- **Never register `this.events.on('update', this.update)`**. Phaser already calls `update(time, delta)` each frame; registering it too runs it twice.
- **Prediction only covers movement.** Shooting, hits, ink and ammo are never predicted; a rejected shot arrives as `shotRejected` and nothing local needs undoing because nothing local was deducted.
- **Shot paths must start near the server's player position** (`SHOT_ORIGIN_TOLERANCE`). The client converts its relative stroke using the *predicted* position, which is normally within a few px of the server.
- **`Game.js` emits events directly** (`this.io.to(this.id).emit(...)`). This means event emission happens in two places: Game.js methods AND handler files. Check both when tracing an event.
- **`Game.js` timers go through `_schedule()`** so `destroy()` can cancel them. Don't call `setTimeout` directly in `Game.js`.
- **Root `package.json` is `"type": "module"`**. Server and shared files use `import`/`export` with explicit `.js` extensions.
- **Phaser scene lifecycle**: constructor → init(data) → preload → create → update (loop) → `shutdown` event. Managers are instantiated in `create()`, not `constructor()`. Scene data is passed via `usePhaserGame`'s `sceneData`.
- **Round 1's `mapSelected`/`countdownStart` fire before `MainScene` exists.** `SocketManager.registerListeners()` sends `requestGameState` to catch up; `MainScene.create()` shows the first countdown itself.

## Where to Add Things

- **New gameplay constant** (affects outcomes): `shared/constants.js`
- **New client-only constant** (visuals, HUD): `inky/src/game/constants.js`
- **New map**: `shared/maps.js` — `{ id, name, barriers[], nets[], playerSpawnScale[] }`; add the id to `LEVEL_ORDER` in the same file
- **New asset**: place in `inky/src/assets/`, preload in `BaseGameScene.preload()`
- **New client manager**: create in `inky/src/game/managers/`, instantiate in `MainScene.create()`, clean up in `onShutdown()`
- **New socket event (lobby)**: handler in `server/lobbyHandlers.js`, client listener in the relevant component
- **New socket event (gameplay)**: handler in `server/gameHandlers.js`; client listener in `SocketManager.registerListeners()` (per-snapshot data) or `MainScene.registerSocketListeners()` (round/match flow), with the matching `.off()`
- **New snapshot field**: add in `Game.getState()`, consume in `SocketManager.handleGameState()`
- **New match option**: constants in `shared/constants.js`, validation in `shared/matchOptions.js`, picker in `inky/src/components/MatchOptions.jsx` (shown on `CreateGame.jsx`), summary in `ReadyRoom.jsx`'s `MatchSummary`, consumed via `game.options` in `Game.js`
- **Map thumbnails anywhere in React**: `inky/src/components/ui/MapPreview.jsx` (pure SVG from the shared map definition; no per-map images needed)
- **New button**: `RetroButton` / `GhostButton` in `inky/src/components/ui/RetroButton.jsx` (add a variant there rather than styling `Button` inline)
- **Shared UI style tokens** (`panelShadow`, `pulseAnimation`): `inky/src/theme.js`

## README

**Keep `README.md` up to date.** When making medium-to-large changes — new files, renamed concepts, changed architecture, removed features, new constants categories — update the relevant README sections. If something described in the README is no longer accurate, fix it. Small bug fixes and minor tweaks don't need README updates.

When starting a new task, use the README if you need project context.
