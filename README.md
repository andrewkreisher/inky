## Inky -- Development Guide

### What is Inky?
Inky is a browser-based game where players draw the paths their projectiles will follow, then fire them at opponents. Players move around maps with barriers, manage an ink resource to draw paths, and try to hit targets to score points.

Inky has two modes:
- **Multiplayer** — 1v1 online matches across multiple rounds with server-authoritative gameplay.
- **Single Player** — Practice levels against a static AI enemy on each of the game's maps.

### Quick start
- **Windows**: double-click `run-game.bat` in the repo root. **macOS/Linux**: `./run-game.sh`.
- **Manual**:
  - Terminal 1 (server): `npm install` (first time), then `npm run server` (or `npm run server:dev` for nodemon live reload of `server/` and `shared/`)
  - Terminal 2 (client): `cd inky && npm install` (first time), then `npm run dev`, open the localhost URL

### Stack
| Layer | Technology |
|-------|-----------|
| Game engine | Phaser 3 (WebGL/Canvas auto, arcade physics used by single player only) |
| Client framework | React 18 + Vite |
| UI (menus) | Chakra UI v2 + Emotion + Framer Motion |
| Networking | Socket.IO (WebSocket transport) |
| Server | Node.js (ES modules) + Express + Socket.IO |

### Repository layout
```
.
├── shared/                         # Code imported by BOTH server and client (ES modules)
│   ├── constants.js                # Every gameplay-affecting number: sizes, tick/snapshot rates, speeds, ink, ammo, rounds
│   ├── maps.js                     # Map definitions + getMapById / getSpawnPosition / LEVELS
│   ├── matchOptions.js             # Host match options: normalize, buildMapOrder (random/custom), describe
│   ├── collision.js                # Pure geometry: AABB resolution, segment-vs-barrier (Cohen-Sutherland)
│   └── simulation.js               # stepPlayer / inputFromKeys / sanitizeInput — the deterministic movement step
├── server/                         # Node.js backend (ES modules)
│   ├── index.js                    # Entry: Express + Socket.IO, fixed-timestep 120 Hz loop, 60 Hz snapshots
│   ├── Game.js                     # Game class: authoritative simulation (inputs, ink/ammo, projectiles, hits, rounds)
│   ├── validateShot.js             # Server-side validation of a submitted projectile path
│   ├── socket.js                   # Thin orchestrator: wires lobby + game handlers
│   ├── lobbyHandlers.js            # Socket handlers for lobby CRUD (create/join/remove/list, ready room)
│   └── gameHandlers.js             # Socket handlers for gameplay (playerInput, drawingState, shootProjectile, ...)
├── inky/                           # React + Phaser client (ES modules, Vite; `@shared` alias -> ../shared)
│   ├── package.json                # Client deps (phaser, socket.io-client, react, chakra) + dev tooling
│   ├── vite.config.js              # React plugin, `@shared` alias, allows serving ../shared
│   ├── index.html                  # Vite HTML entry (loads the Silkscreen font)
│   └── src/
│       ├── main.jsx                # React root
│       ├── App.jsx                 # Screen router + Socket.IO connection
│       ├── theme.js                # Chakra theme + panelShadow token
│       ├── hooks/
│       │   └── usePhaserGame.js    # Mounts/destroys a Phaser game running one scene; passes init data
│       ├── components/
│       │   ├── ui/RetroButton.jsx  # RetroButton (bevelled, variants) + GhostButton — used by every screen
│       │   ├── ui/MapPreview.jsx   # SVG schematic of a map (barriers, nets, spawns) for tiles/lists
│       │   ├── Home.jsx            # Title screen with Multiplayer / Single Player buttons
│       │   ├── Lobby.jsx           # Browse/join open rooms; "Host a Game" opens CreateGame
│       │   ├── CreateGame.jsx      # Host screen: MatchOptions + Create Game
│       │   ├── MatchOptions.jsx    # Lives / rounds / map-mode pickers + custom map sequence editor (MapTile)
│       │   ├── ReadyRoom.jsx       # Pre-game ready state (multiplayer)
│       │   ├── Game.jsx            # Phaser container for multiplayer, end-game overlay
│       │   ├── LevelSelect.jsx     # Level selection screen (single player)
│       │   └── SinglePlayerGame.jsx # Phaser container for single player
│       ├── game/
│       │   ├── constants.js        # Re-exports shared/constants.js + client-only visuals/HUD layout
│       │   ├── phaserConfig.js     # Shared Phaser.Game config (scale, physics)
│       │   ├── net/Interpolator.js # Timestamped position buffer -> smoothed position `INTERPOLATION_DELAY_MS` ago
│       │   ├── Scenes/
│       │   │   ├── BaseGameScene.js     # Shared: asset preload, background, map build, explosions, shutdown hook
│       │   │   ├── MainScene.js         # Multiplayer scene -- composition root for the managers
│       │   │   └── SinglePlayerScene.js # Single player scene (local physics, static target, no server)
│       │   └── managers/
│       │       ├── InputManager.js      # WASD + mouse + hotkeys
│       │       ├── DrawingManager.js    # Ink drawing, path resampling; ink pool + current stroke cost
│       │       ├── ProjectileManager.js # Projectile sprites reconciled by ID from snapshots; server ammo mirror
│       │       ├── PlayerManager.js     # Local prediction/reconciliation, remote interpolation, invincibility
│       │       ├── SocketManager.js     # gameState / newProjectile / pointScored / shotRejected listeners
│       │       └── UIManager.js         # HUD rendering; owns inkBar, scoreText, sprite containers
│       └── assets/                 # All image assets
├── package.json                    # Root: server deps only (express, socket.io, nodemon); "type": "module"
├── run-game.bat / run-game.sh      # Launchers (install deps if needed, start server + client)
```

**Note on dependencies**: There are two `package.json` files. The root one is the server (express, socket.io). The `inky/` one is the client (phaser, socket.io-client, react, chakra, vite). Each has its own `node_modules`. `shared/` has no dependencies and no `package.json`; the server imports it with relative paths and the client via the `@shared` Vite alias.

---

### Game flow

#### Screen navigation
```
Home (title screen)
  ├─> "Multiplayer" ─> Lobby ─> ReadyRoom ─> Game (multiplayer Phaser canvas)
  └─> "Single Player" ─> LevelSelect ─> SinglePlayerGame (single player Phaser canvas)
```

`App.jsx` manages screen state (`home` | `lobby` | `readyRoom` | `game` | `levelSelect` | `singlePlayerGame`). It creates a single Socket.IO connection on mount and passes it to multiplayer screens. Single player screens don't use the socket.

#### Multiplayer lobby flow
1. Player clicks "Multiplayer" on Home screen, enters Lobby.
2. In Lobby, a player either joins an open room (the list shows each room's options) or clicks "Host a Game", which opens the `CreateGame` screen to pick **match options** (lives per round 3/4/5, rounds 3/5/7, maps Random or a custom sequence built from preview tiles) and create the room.
3. Both players enter ReadyRoom, which shows the match settings (and the custom map order). Each clicks "Ready Up".
4. Once both are ready, the server:
   - Creates a `Game` instance with the room's options and builds its map order
   - Adds both players
   - Emits `startGame`, `mapSelected`, and an initial `gameState`, then starts the countdown
5. Both clients transition to the Game screen. `MainScene` immediately sends `requestGameState` so a late-mounting scene still receives the map and a snapshot.

#### Single player flow
1. Player clicks "Single Player" on Home screen, enters LevelSelect.
2. LevelSelect shows all 5 maps as selectable levels (`LEVELS` from `shared/maps.js`).
3. Clicking a level loads SinglePlayerGame with the selected map data.
4. The game runs entirely client-side — no server communication.
5. Press ESC to return to level select.

#### Lobby state vs active game state
The server maintains two separate data structures:
- `lobbyGames` (plain object): Lobby metadata for each room (`{ id, players[], started, creator, ready, usernames, options }`). Used for listing/creating/joining rooms.
- `activeGames` (Map): Active `Game` instances keyed by game ID. Created when both players ready up. Used for all gameplay logic.

---

### Core gameplay

#### Controls
| Input | Action |
|-------|--------|
| WASD | Move player (diagonals are normalised, so every direction moves at `PLAYER_SPEED`) |
| Left mouse (hold + drag) | Draw projectile path (consumes ink) |
| Space | Fire projectile along drawn path |
| E | Cancel current drawing (ink is never spent until you fire) |
| Right-click | Cancel drawing + reset stuck movement keys |

#### The ink system (`DrawingManager`)
- Ink is modelled as an **ink pool** (`inkPool`) minus the cost of the stroke currently drawn/held (`pathLength * INK_COST_PER_PIXEL`). The HUD shows `currentInk = inkPool - pathCost`.
  - **Multiplayer**: `inkPool` mirrors the server's value from every snapshot. The server deducts the path cost when a shot is accepted and pauses regeneration while the client reports `drawingState: true`.
  - **Single player**: `inkPool` regenerates locally with delta time (`INK_REGEN_PER_SEC`), and `spendPathCost()` is called on fire.
- Rounds start with `INITIAL_INK` (200); `MAX_INK` is 400; regen is `INK_REGEN_PER_SEC` (48/s), paused while drawing.
- Paths are stored as **relative coordinates** from the player position so the stroke follows the player. Firing does not clear it; the next stroke replaces it (rounds still clear it).
- On mouse release (`stopDrawing`): paths shorter than `MIN_PATH_LENGTH` (200 px) are discarded and the previous stroke is restored; otherwise the path is normalised so its first point is the player and it replaces the old one.
- Cancelling (E / right-click) discards the stroke in progress and restores the previously set path. Nothing is deducted until you fire.

#### Shooting (`ProjectileManager.shootProjectile`)
1. Requires a drawn path, `projectileCount >= 1` (server ammo as of the last snapshot), and no round transition / game over.
2. Converts the relative path to world coordinates using the **predicted** player position, resamples to `RESAMPLE_STEP` (5 px) points, plays the shoot animation and emits `shootProjectile`.
3. The server validates (`validateShot.js`), checks ammo and ink, deducts both, truncates the path at the first barrier and emits `newProjectile`. If anything fails it replies `shotRejected { reason }` and nothing is deducted.
4. The client's path stays drawn, so the same stroke can be fired again. The HUD ammo/ink update on the next snapshot. The ink bar keeps reserving `pathCost`, so it shows what you'd have left after one more shot.

Validation reasons: `path too short`, `too many points` (> `MAX_PATH_POINTS`), `invalid point`, `origin too far from player` (> `SHOT_ORIGIN_TOLERANCE`, which gives prediction slack), `segment too long` (> 1.5 × `RESAMPLE_STEP`), `path below minimum length`, `round paused`, `no ammo`, `not enough ink`.

#### Ammo
- Server-owned. Starts at `INITIAL_PROJECTILE_COUNT` (5) **every round**, regenerates at `PROJECTILE_REGEN_PER_SEC` (0.36/s, about one shot every 2.8 s) up to `MAX_PROJECTILE_COUNT` (10).
- The client mirrors it as `ProjectileManager.projectileCount`. Full shots are solid icons; the next one stays on screen dim and brightens to full color as that shot regenerates (`AMMO_CHARGE_MIN_ALPHA`).

#### Projectiles (server, `Game.js`)
- Each projectile is `{ id, path, index, x, y, shooter_id, isSecondPlayer }`; `id` is `${socketId}-${sequence}`.
- Each tick the server advances `index` by one path point, i.e. `PROJECTILE_SPEED = RESAMPLE_STEP × GAME_TICK_RATE` = 600 px/s. Reaching the end of the (possibly truncated) path produces an explosion.
- **Projectile vs projectile** is resolved on the server (`resolveProjectileCollisions`): projectiles from different shooters within `2 × PROJECTILE_RADIUS` are both removed and an explosion is placed at the midpoint.
- **Projectile vs player** (`checkCollisions`): a projectile from the other player within `PLAYER_WIDTH / 2` of a non-invincible player is a hit. At most one round can end per tick.

#### Projectiles (client, `ProjectileManager`)
- Sprites are keyed by projectile ID and **reconciled** against each snapshot: unknown IDs are created, missing IDs are destroyed, known IDs get a new sample pushed into their `Interpolator`. `newProjectile` creates the sprite a few ms early at `path[0]`.
- No Phaser physics bodies are used in multiplayer; all hits are server-side.

#### Player movement (multiplayer)
- Both sides run the same `stepPlayer(pos, input, map)` from `shared/simulation.js`: move `input × PLAYER_STEP` (900 px/s ÷ 120), clamp to the arena, then `resolveBarrierCollision` against barriers and nets.
- The client runs a fixed-step accumulator at `TICK_MS`. Each tick with a non-zero input increments `seq`, applies the step to its predicted position, and queues `{ seq, x, y }`; the frame's steps are sent as one `playerInput` message.
- The server queues inputs per player (`INPUT_QUEUE_MAX`), applies up to `MAX_INPUTS_PER_TICK` per tick subject to a token bucket (`INPUT_TOKENS_PER_TICK`, `INPUT_TOKEN_MAX`) so clients cannot move faster than real time, and records the last applied `seq`. Inputs are still consumed (acked) while the round is paused so the client's pending queue drains.
- On each snapshot the client discards acked steps, replays the rest on top of the server position and folds any difference into a correction offset that decays at `CORRECTION_SMOOTHING`/s, so corrections are smooth rather than snapping (large errors such as respawns do snap).

#### Invincibility (multiplayer)
- Duration: **2000 ms** (`INVINCIBILITY_DURATION`), tracked server-side (`invinciblePlayers`) and exposed per player as `isInvincible` in each snapshot.
- Client shows a blinking alpha tween managed by `PlayerManager`.

---

### Single player mode

Single player runs entirely on the client with no server communication. It uses `SinglePlayerScene` which reuses three of the multiplayer managers (`DrawingManager`, `UIManager`, `InputManager`) and has its own local `SPProjectileManager`.

#### Architecture
- **Player movement**: Phaser arcade physics velocity at `PLAYER_SPEED` (900 px/s) with normalised diagonals (`inputFromKeys`), `setCollideWorldBounds`, and colliders against barriers/nets.
- **Projectiles**: `SPProjectileManager` creates sprites locally on shoot and advances them along the path by `PROJECTILE_SPEED × dt` each frame (frame-rate independent, same 600 px/s as multiplayer).
- **Regen**: ink and ammo regenerate with delta time at the shared per-second rates.
- **Collision**: Phaser `physics.add.overlap` handles projectile-vs-enemy and projectile-vs-barrier.
- **Enemy**: Static sprite at the second spawn point. When hit, it respawns and the score increments.

---

### Match, rounds, and maps

#### Match options (chosen by the host)
Defined in `shared/matchOptions.js`; the server runs every client-supplied value through `normalizeMatchOptions`, so anything invalid falls back to the defaults.

| Option | Choices | Default | Notes |
|--------|---------|---------|-------|
| `lives` | 3 / 4 / 5 (`LIVES_OPTIONS`) | 3 | Lives per round; a hit grants `INVINCIBILITY_DURATION` of invincibility, the round ends when a player reaches 0 |
| `rounds` | 3 / 5 / 7 (`ROUNDS_OPTIONS`) | 5 | Rounds per match |
| `mapMode` | `random` / `custom` | `random` | Random = shuffled with no back-to-back repeats (every map is played before any repeats). Custom = the host's `mapSequence` |
| `mapSequence` | map ids, repeats allowed, up to `MAX_CUSTOM_MAP_SEQUENCE` | `[]` | Cycled if shorter than `rounds`, truncated if longer. Custom with an empty sequence falls back to random |

`buildMapOrder(options)` produces one map per round; `Game.currentMap` is `mapOrder[currentRound - 1]`. A rematch rebuilds the order (so random mode reshuffles). Snapshots carry `totalRounds` (for "Round N / M") and `maxLives` (for the lives HUD).

#### HUD
- **Scoreboard** (top centre): both players' character icons, names (from the lobby `usernames`, passed to the scene as init data) and large scores. Single player shows only your score.
- **Lives** (bottom left): one tiny sprite of your character per life slot; lost lives stay in place dimmed (`LIFE_UI_LOST_ALPHA`).
- **Ink bar** and **ammo** icons (bottom centre/right).

- Maps are defined once in `shared/maps.js`.
- Each map has:
  - `id`, `name`
  - `barriers[]`: `{ x, y, width, height }` (center-origin rectangles; block players and projectiles)
  - `nets[]`: `{ x, y, width, height }` (block player movement but not projectiles)
  - `playerSpawnScale[]`: Two `[xPercent, yPercent]` entries; `getSpawnPosition(map, index)` converts to pixels

#### Round flow (multiplayer)
1. A player's lives reach 0. The server increments the killer's score, clears projectiles, sets `roundTransitioning`, and emits `pointScored` + a snapshot.
2. If `currentRound < options.rounds`: emits `roundEnded`; after `ROUND_END_DELAY` advances to the next map, resets lives/positions/ink/ammo (acking any queued inputs), emits `mapSelected` and starts the countdown.
3. Otherwise: emits `matchEnded` with winner and scores. A rematch (both players `requestRematch`) rebuilds the map order, resets scores and emits `rematchStarted`.
4. Countdown: `countdownStart` → `COUNTDOWN_DURATION` → `countdownEnd`. The snapshot's `paused` flag is the source of truth for whether the round is live.

#### Client map handling (multiplayer)
- On `mapSelected`: rebuilds barrier and net static images; shows "Round N" text if the round changed.
- On `countdownStart` / `countdownEnd`: shows the 3-2-1-Go countdown; `roundTransitioning` also follows `gameState.paused`.
- On `pointScored`: clears projectiles/drawing, resets prediction (pending inputs), stops invincibility tweens, shows "<name> scored!". Ink and ammo come from the next snapshot.
- On `matchEnded` / `playerDisconnected`: `gameover = true`; the React overlay in `Game.jsx` takes over.
- On `rematchStarted`: un-freezes, resets round state and rebuilds the map for round 1.

#### Maps
| Map | Layout |
|-----|--------|
| **Open Field** | No obstacles — pure aim and dodge |
| **The Wall** | Full vertical divider: center barrier (100x300) + nets filling top/bottom gaps |
| **Four Pillars** | Diamond of 4 barriers (80x80 each) — partial cover |
| **The Trench** | Horizontal center barrier (300x100) + nets on sides |
| **Fortress** | Two personal barriers (80x180) near each player's spawn |

---

### Networking protocol

#### Client -> Server
| Event | Payload | Purpose |
|-------|---------|---------|
| `registerUsername` | `username` | Register display name on connect |
| `changeUsername` | `{ newUsername }` (ack callback) | Change display name; also updates any lobby room the player is in |
| `playerInput` | `{ gameId, inputs: [{ seq, x, y }] }` | Batched per-tick movement steps (`x`,`y` unit-or-shorter) |
| `drawingState` | `{ gameId, drawing }` | Pause/resume ink regeneration while drawing |
| `shootProjectile` | `{ gameId, path: [{x,y}...] }` | Fire a projectile along a resampled world-space path |
| `requestGameState` | `gameId` | Immediate `mapSelected` + `gameState` to the requester |
| `createGame` | `{ username, options }` | Create a new lobby room with match options (`{ lives, rounds, mapMode, mapSequence }`, normalised server-side) |
| `joinGame` | `{ gameId, username }` | Join an existing room |
| `removeGame` | `{ gameId }` | Delete a room (creator only) |
| `currentGames` | (none) | Request list of open (unstarted) rooms |
| `playerReady` / `playerUnready` | `{ gameId }` | Ready room state |
| `leaveReadyRoom` | `{ gameId }` | Leave ready room |
| `leaveGame` | `{ gameId }` | Leave active game |
| `requestRematch` | `{ gameId }` | Request rematch after match end |

The server always uses `socket.id` as the player's identity; any `playerId` field sent by a client is ignored.

#### Server -> Client
| Event | Payload | Purpose |
|-------|---------|---------|
| `gameState` | `{ t, round, totalRounds, maxLives, mapId, paused, players[], projectiles[], explosions[] }` | Snapshot at `SNAPSHOT_RATE` (60 Hz). `players[]`: `{ id, x, y, seq, lives, score, ink, ammo, isSecondPlayer, isInvincible }`. `projectiles[]`: `{ id, x, y, shooter_id, isSecondPlayer }` |
| `newProjectile` | `{ id, path, index, x, y, shooter_id, isSecondPlayer }` | New projectile (path already truncated at barriers) |
| `shotRejected` | `{ reason }` | Sent to the shooter when `shootProjectile` fails validation/resources |
| `pointScored` | `{ scorerName }` | A round was scored; clients reset local round state |
| `startGame` | lobby game object | Game begins (both players ready) |
| `mapSelected` | `{ round, map }` | Load/rebuild map for this round (full map object, once per round) |
| `roundEnded` | `{ round, nextRound, map }` | Informational; the client relies on `mapSelected` |
| `matchEnded` | `{ totalRounds, winnerId, scores[] }` | Match completed |
| `countdownStart` / `countdownEnd` | (none) | Pre-round countdown |
| `playerDisconnected` | `socketId` | Opponent left |
| `enterReadyRoom` | lobby game object | Show ready screen |
| `readyStateUpdated` | `{ [socketId]: bool }` | Ready room votes |
| `readyRoomAborted` | (none) | Other player left ready room |
| `rematchUpdate` | `{ accepted }` | Rematch vote count |
| `rematchStarted` | `{ round, map }` | Both voted rematch, restarting |
| `gameCreated` / `gameJoined` | game object | Lobby: room created / membership changed |
| `gameRemoved` | `gameId` | Lobby: room deleted, or room started (no longer joinable) |
| `currentGames` | `{ [gameId]: game }` | Lobby: open room list |

---

### Key constants

#### Shared (`shared/constants.js`) — anything that affects gameplay outcomes
| Category | Constants |
|----------|-----------|
| World | `GAME_WIDTH` (1280), `GAME_HEIGHT` (720) |
| Simulation | `GAME_TICK_RATE` (120), `TICK_MS`, `SNAPSHOT_RATE` (60), `TICKS_PER_SNAPSHOT`, `MAX_INPUTS_PER_TICK` (4), `INPUT_TOKENS_PER_TICK` (1.1), `INPUT_TOKEN_MAX` (12), `INPUT_QUEUE_MAX` (64), `INTERPOLATION_DELAY_MS` (50) |
| Player | `PLAYER_SPEED` (900 px/s), `PLAYER_STEP` (per tick), `PLAYER_WIDTH`/`PLAYER_HEIGHT` (80), `INVINCIBILITY_DURATION` (2000) |
| Ink | `MAX_INK` (400), `INITIAL_INK` (200), `INK_REGEN_PER_SEC` (48), `INK_COST_PER_PIXEL` (0.1), `MIN_PATH_LENGTH` (200) |
| Projectiles | `RESAMPLE_STEP` (5), `PROJECTILE_SPEED` (600 px/s), `PROJECTILE_RADIUS` (20), `INITIAL_PROJECTILE_COUNT` (5), `MAX_PROJECTILE_COUNT` (10), `PROJECTILE_REGEN_PER_SEC` (0.36), `MAX_PATH_POINTS`, `SHOT_ORIGIN_TOLERANCE` (160) |
| Match options | `LIVES_OPTIONS` [3,4,5], `DEFAULT_LIVES` (3), `ROUNDS_OPTIONS` [3,5,7], `DEFAULT_ROUNDS` (5), `MAP_MODE_RANDOM`/`MAP_MODE_CUSTOM`, `MAX_CUSTOM_MAP_SEQUENCE` (20) |
| Match timing | `ROUND_END_DELAY` (2000), `COUNTDOWN_DURATION` (3000) |

All rates are per second; the server derives per-tick values, the client uses delta time.

#### Client-only (`inky/src/game/constants.js`, which also re-exports everything above)
| Category | Constants |
|----------|-----------|
| Drawing | `DRAWING_LINE_WIDTH` (2), `DRAWING_LINE_COLOR`, `BOUNDARY_BUFFER` (1) |
| Prediction | `CORRECTION_SMOOTHING` (12 /s) |
| Sprites/depths | `PLAYER_SPRITE_SCALE`, `PLAYER_DEPTH`, `PROJECTILE_SPRITE_SCALE`, `PROJECTILE_DEPTH`, `MAP_OBJECT_DEPTH`, `EXPLOSION_DEPTH`, `OVERLAY_TEXT_DEPTH`, `HUD_DEPTH` |
| Animations | `SHOOT_ANIMATION_DURATION`, `EXPLOSION_SIZE`, `EXPLOSION_DURATION`, `ROUND_TEXT_DURATION`, `INVINCIBILITY_FLASH_DURATION`, `SCORED_TEXT_DURATION` |
| HUD layout | `HUD_HEIGHT`, `SCOREBOARD_*`, `INK_BAR_*`, `PROJECTILE_UI_*`, `AMMO_CHARGE_MIN_ALPHA`, `LIFE_UI_*`, `FONT_FAMILY` |

---

### Architecture notes

#### Scene lifecycle and Phaser mounting
`usePhaserGame` (React hook) creates the `Phaser.Game` from `phaserConfig.js` and adds the single scene with `game.scene.add(key, SceneClass, true, data)`, so `init(data)` receives `{ gameId, socket, usernames }` (multiplayer) or `{ level, onReturnHome }` (single player). Creation is deferred while the tab is hidden; the game is destroyed on unmount.

`BaseGameScene` is the shared parent of both scenes. It preloads all assets, draws the background, builds barriers/nets from `this.currentMap` (`rebuildMap()`), spawns explosions, and wires `this.events.once('shutdown' | 'destroy')` to `onShutdown()`. **Phaser does not call a `shutdown()` method on scenes** — only the event — so all listener cleanup must go through `onShutdown()`. Do not register `this.events.on('update', this.update)`: Phaser already calls `update(time, delta)` every frame.

#### Client architecture (multiplayer)
`MainScene` is the composition root. It creates 6 manager instances in `create()`, passing `this` (the scene) to each constructor. Each manager owns its own state and accesses other managers via `this.scene.managerName`. `MainScene` owns the round/match socket listeners (`mapSelected`, `matchEnded`, `countdownStart/End`, `playerDisconnected`, `rematchStarted`); `SocketManager` owns the per-snapshot ones (`gameState`, `newProjectile`, `pointScored`, `shotRejected`). Both remove their listeners in `onShutdown()` / `destroy()`.

Per frame, `MainScene.update(time, delta)` calls `playerManager.update(delta, now)` (predict + render), `projectileManager.update(now)` (interpolate), `drawingManager.redrawPath()` and `uiManager.updateUI()`. There is no local regeneration in multiplayer.

**State ownership** -- each manager owns the state it operates on:

| Manager | Owned state |
|---------|------------|
| `PlayerManager` | `currentPlayer`, `isSecondPlayer`, `otherPlayers` (id → `{ sprite, interp }`), `predicted`, `correction`, `pendingInputs`, `seq`, `invincibilityTweens` |
| `ProjectileManager` | `projectiles` (id → `{ sprite, interp }`), `projectileCount` (server ammo mirror) |
| `DrawingManager` | `inkPool`, `drawPath`, `pathLength`, `isDrawing`, `graphics`, `onDrawingStateChanged` |
| `UIManager` | `scoreboard`, `inkBar`, `projectileContainer`, `projectileSprites`, `livesContainer`, `lifeSprites`, `lives`, `maxLives` |
| `MainScene` (kept) | `gameId`, `socket`, `gameover`, `roundTransitioning`, `currentRound`, `totalRounds`, `currentMap`, `barriers`, `nets`, `roundText`, `countdownText`, `countdownTimer` |

Cross-manager access uses `this.scene.playerManager.currentPlayer` etc.

#### Client architecture (single player)
`SinglePlayerScene` reuses `DrawingManager`, `UIManager`, and `InputManager` directly. It creates a minimal `playerManager` stand-in (`{ currentPlayer, isSecondPlayer }`) and an `SPProjectileManager` class for local projectile creation, delta-time path following, regen and destruction. Player movement and collision are handled locally via Phaser arcade physics.

#### Server architecture
`index.js` runs a fixed-timestep loop: an accumulator converts wall-clock time into whole `TICK_MS` ticks (capped per wake-up so a stalled event loop cannot fast-forward the game), calls `game.update()` for every active game each tick, and broadcasts `getState()` every `TICKS_PER_SNAPSHOT` ticks.

`Game.js` owns all authoritative state and emits events directly via `this.io`. Per tick: drain input queues (`processInputs`, also while paused, so acks flow), then — only while the round is live — regenerate ink/ammo, advance projectiles, resolve projectile-vs-projectile, check hits, expire invincibility. Round/countdown timers go through `_schedule()` so `destroy()` can cancel them on teardown. Geometry lives in `shared/collision.js`; the movement step in `shared/simulation.js`; shot validation in `server/validateShot.js`.

Socket handlers are split into three files: `socket.js` is a thin orchestrator that wires up `lobbyHandlers.js` (rooms, ready state, username sync) and `gameHandlers.js` (`playerInput`, `drawingState`, `shootProjectile`, `requestGameState`, `requestRematch`, `leaveGame`/disconnect teardown). Both receive a `deps` object containing `{ activeGames, lobbyGames, connectedUsernames }`. The `Game` class also emits events directly, creating two emission points.

#### Player identity
Players are identified by their `socket.id`. The first player to join is player 1 (`isSecondPlayer = false`), the second is player 2 (`isSecondPlayer = true`). This flag determines which sprite/projectile texture is used.

#### Prediction, reconciliation and interpolation (multiplayer)
- **Local player**: client-side prediction with server reconciliation (see "Player movement"). Because both sides run the identical `stepPlayer`, the replayed prediction normally matches the server exactly and the correction offset stays at zero; it only becomes non-zero when the server dropped/rate-limited inputs or a hit respawned the player.
- **Remote player and all projectiles**: positions are pushed into an `Interpolator` with the local receive time and rendered `INTERPOLATION_DELAY_MS` (50 ms) in the past, linearly interpolated between the two bracketing snapshots. No extrapolation: if snapshots stop, the entity holds its last position.
- **Ink/ammo/lives/score**: taken verbatim from the snapshot.

---

### Disconnect handling
- When a socket disconnects (or emits `leaveGame`):
  - Lobby: if they were in an unstarted room, they're removed from it. The host leaving deletes the room; a guest leaving reverts it to a 1-player room and aborts the ready room.
  - Active game: they are removed, the remaining player gets `playerDisconnected`, and the `Game` is destroyed (timers cancelled) and removed from both stores.
- Client shows an overlay ("Opponent Left") with a "Back to Lobby" button.
- Match-end overlay shows Victory/Defeat, scores, rematch button, and "Back to Lobby".

---

### Deployment
- **Server**: Listens on `process.env.PORT || 3000`. CORS origin via `CORS_ORIGIN` env var (comma-separated), defaults to `*`.
- **Client**: Set `VITE_SOCKET_URL` to server URL. Forces WebSocket transport.

---

### Conventions for development

- **Shared first**: anything that changes a gameplay outcome (speeds, sizes, costs, rates, map geometry, movement/collision math) goes in `shared/` so the server and the client's prediction agree by construction. Never duplicate it on one side.
- **Manager pattern**: Game subsystems live in `inky/src/game/managers/` as classes that receive the scene in their constructor. Instantiate in `MainScene.create()`.
- **Server authority**: Multiplayer gameplay state is server-authoritative. The client predicts only its own movement and otherwise renders snapshots; it never decides hits, ammo or ink.
- **Assets**: Place in `inky/src/assets/`, preload in `BaseGameScene.preload()` (shared by both scenes).
- **New maps**: Add to `shared/maps.js` and to `LEVEL_ORDER` in the same file.
- **New network events (multiplayer)**: Lobby handlers in `lobbyHandlers.js`, gameplay handlers in `gameHandlers.js`. Client listener in `SocketManager.registerListeners()` (per-snapshot data) or `MainScene.registerSocketListeners()` (round/match flow) — and the matching `.off()` in `destroy()` / `unregisterSocketListeners()`.
- **Cleanup**: Any global listeners or timers must be removed in the scene's `onShutdown()`. Phaser does not call a `shutdown()` method — `BaseGameScene` wires the `shutdown`/`destroy` events to `onShutdown()`.
- **Constants**: gameplay numbers in `shared/constants.js`; client-only visuals/HUD in `inky/src/game/constants.js`. Rates are per second — use delta time on the client and derive per-tick values on the server. Do not inline numbers.
- **Buttons**: use `RetroButton` / `GhostButton` from `components/ui/RetroButton.jsx` rather than styling Chakra `Button` by hand.
