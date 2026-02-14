# Inky - Project Instructions

## Quick Reference

- **Run locally**: `./run-game.sh` (or `run-game.bat` on Windows) — starts server (nodemon, live reload) + client (Vite HMR)
- **Server only**: `npm run server` from repo root
- **Client only**: `cd inky && npm run dev`
- **Build check**: `cd inky && npx vite build`

## Architecture Rules

### Client: Manager State Ownership

Each manager owns its own state. **Do not put new game state on MainScene** — put it on the manager that operates on it.

| Manager | Owns |
|---------|------|
| `PlayerManager` | `currentPlayer`, `otherPlayers`, `otherPlayersGroup`, `isSecondPlayer`, `checkedPlayer` |
| `ProjectileManager` | `playerProjectiles`, `enemyProjectiles`, `playerProjectilesGroup`, `enemyProjectilesGroup`, `projectileCount` |
| `DrawingManager` | `currentInk`, `graphics`, `drawPath`, `isDrawing` |
| `UIManager` | `inkBar`, `barBackground`, `scoreText`, `projectileContainer`, `projectileSprites`, `livesContainer`, `lifeSprites` |

MainScene only keeps: `gameId`, `socket`, `gameover`, `currentRound`, `currentMap`, `barriers`, `nets`, `roundText`, `cursors`.

Cross-manager access: `this.scene.playerManager.currentPlayer`, not `this.scene.currentPlayer`.

### Client: Constants

All magic numbers live in `inky/src/game/constants.js`. When adding new tunable values, add them there and import — do not inline numbers.

### Server: Handler Split

- `socket.js` — thin orchestrator, don't add logic here
- `lobbyHandlers.js` — lobby CRUD (createGame, joinGame, removeGame, currentGames)
- `gameHandlers.js` — gameplay (playerMovement, shootProjectile, projectileCollision, requestGameState)
- `Game.js` — authoritative game logic, also emits events directly via `this.io`
- `collision.js` — pure collision/geometry functions (no side effects, no `this`)

New lobby events go in `lobbyHandlers.js`. New gameplay events go in `gameHandlers.js`.

### Server: Two Data Stores

- `lobbyGames` (plain object) — room metadata for the lobby UI
- `activeGames` (Map) — live `Game` instances for actual gameplay

Both are passed as `deps` to handler modules.

## Common Pitfalls

- **Server sends `shooter_id`**, not `playerId`, on projectile payloads. Always use `shooter_id` for projectile ownership checks.
- **Listener cleanup is critical**. Any socket or window event listener must be removable — store handler references, don't use anonymous arrows for `.on()` calls that need `.off()` later. Clean up in `MainScene.cleanupScene()`.
- **Client is not predictive**. Server is authoritative for positions and hits. Client-side physics overlaps are for visuals only (except projectile-vs-projectile, which is client-detected and server-applied).
- **`Game.js` emits events directly** (`this.io.to(this.id).emit(...)`). This means event emission happens in two places: Game.js methods AND handler files. Check both when tracing an event.
- **Phaser scene lifecycle**: constructor → init(data) → preload → create → update (loop) → shutdown. Managers are instantiated in `create()`, not `constructor()`.
- **Physics groups must exist before collision setup**. Call `createGroups()` before `setupCollisions()`.

## Where to Add Things

- **New game constant**: `inky/src/game/constants.js`
- **New server constant**: `server/config.js`
- **New map**: `server/maps.js` — add to the array with `{ id, name, barriers[], nets[], playerSpawnScale[] }`
- **New asset**: place in `inky/src/assets/`, preload in `MainScene.preload()`
- **New client manager**: create in `inky/src/game/managers/`, instantiate in `MainScene.create()`, clean up in `cleanupScene()`
- **New socket event (lobby)**: handler in `server/lobbyHandlers.js`, client listener in the relevant component
- **New socket event (gameplay)**: handler in `server/gameHandlers.js`, client listener in `SocketManager.connectToServer()`

## README

**Keep `README.md` up to date.** When making medium-to-large changes — new files, renamed concepts, changed architecture, removed features, new constants categories — update the relevant README sections. If something described in the README is no longer accurate, fix it. Small bug fixes and minor tweaks don't need README updates.
