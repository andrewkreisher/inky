## Inky -- Development Guide

### What is Inky?
Inky is a 1v1 browser-based multiplayer game where players draw the paths their projectiles will follow, then fire them at their opponent. Players move around a map with barriers, manage an ink resource to draw paths, and try to hit the other player to score points across multiple rounds.

### Quick start
- **Windows**: double-click `run-game.bat` in the repo root.
- **Manual**:
  - Terminal 1 (server): `npm install` (first time), then `npm run server`
  - Terminal 2 (client): `cd inky && npm install` (first time), then `npm run dev`, open the localhost URL

### Stack
| Layer | Technology |
|-------|-----------|
| Game engine | Phaser 3 (Canvas 2D, arcade physics) |
| Client framework | React 18 + Vite |
| UI (menus) | Chakra UI v2 + Emotion + Framer Motion |
| Networking | Socket.IO (WebSocket transport) |
| Server | Node.js + Express + Socket.IO |

### Repository layout
```
.
├── server/                         # Node.js backend (CommonJS)
│   ├── index.js                    # Entry: Express + Socket.IO setup, 120 Hz game loop
│   ├── config.js                   # Server constants
│   ├── maps.js                     # Map definitions (barriers, nets, spawn points)
│   ├── Game.js                     # Game class: authoritative game logic
│   ├── collision.js                # Pure collision/geometry functions (extracted from Game.js)
│   ├── socket.js                   # Thin orchestrator: wires lobby + game handlers
│   ├── lobbyHandlers.js            # Socket handlers for lobby CRUD (create/join/remove/list)
│   └── gameHandlers.js             # Socket handlers for gameplay (movement, shooting, collisions)
├── inky/                           # React + Phaser client (ES modules, Vite)
│   ├── package.json                # Client-only deps (react, chakra, react-router-dom)
│   ├── index.html                  # Vite HTML entry
│   └── src/
│       ├── main.jsx                # React root
│       ├── App.jsx                 # Screen router + Socket.IO connection
│       ├── App.css                 # Vite boilerplate CSS (mostly unused)
│       ├── index.css               # Global styles (Vite boilerplate)
│       ├── components/
│       │   ├── Home.jsx            # Title screen with "Join Game" button
│       │   ├── Lobby.jsx           # Create/join game rooms
│       │   └── Game.jsx            # Phaser container, instantiates MainScene
│       ├── game/
│       │   ├── constants.js        # All client constants (~45: dimensions, ink, projectiles, UI layout, etc.)
│       │   ├── Scenes/
│       │   │   └── MainScene.js    # Single Phaser scene -- composition root
│       │   └── managers/
│       │       ├── InputManager.js      # WASD + mouse + hotkeys
│       │       ├── DrawingManager.js    # Ink drawing, path resampling; owns currentInk, graphics
│       │       ├── ProjectileManager.js # Projectile sprites, movement, collisions; owns projectile state
│       │       ├── PlayerManager.js     # Player sprites, invincibility; owns currentPlayer, otherPlayers
│       │       ├── SocketManager.js     # Socket event listeners, game state handling
│       │       └── UIManager.js         # HUD rendering; owns inkBar, scoreText, sprite containers
│       └── assets/                 # All image/video assets
├── package.json                    # Root: server deps + shared deps (phaser, socket.io, etc.)
├── run-game.bat                    # Windows launcher (starts server + client)
├── setup.js                        # Empty setup file
└── vite.config.js                  # Root vite config (unused -- client uses inky/vite.config.js)
```

**Note on dependencies**: There are two `package.json` files. The root one has server deps (express, socket.io) plus client deps (phaser, react, chakra, socket.io-client). The `inky/` one has the client-specific deps (react, chakra, react-router-dom) and dev tooling. The root `node_modules` is used when running the server; the `inky/node_modules` is used by Vite for the client.

---

### Game flow

#### Screen navigation
```
Home (title screen)
  └─> Lobby (create/join rooms)
        └─> Game (Phaser canvas, actual gameplay)
```

`App.jsx` manages screen state (`home` | `lobby` | `game`). It creates a single Socket.IO connection on mount and passes it down to child screens.

#### Lobby flow
1. Player clicks "Join Game" on Home screen, enters Lobby.
2. In Lobby, player can "Create Game" (emits `createGame` with their socket ID).
3. Another player joins (emits `joinGame`). Once 2 players are in a room, the server:
   - Creates a `Game` instance with randomized map order
   - Adds both players
   - Emits `startGame` to the room
   - Emits `mapSelected` and initial `gameState`
4. Both clients transition to the Game screen.

#### Lobby state vs active game state
The server maintains two separate data structures:
- `lobbyGames` (plain object): Lobby metadata for each room (`{ id, players[], started, creator }`). Used for listing/creating/joining rooms.
- `activeGames` (Map): Active `Game` instances keyed by game ID. Created when a room fills to 2 players. Used for all gameplay logic.

---

### Core gameplay

#### Controls
| Input | Action |
|-------|--------|
| WASD | Move player |
| Left mouse (hold + drag) | Draw projectile path (consumes ink) |
| Space | Fire projectile along drawn path |
| E | Cancel current drawing (refunds ink) |
| Right-click | Cancel drawing + reset stuck movement keys |

#### The ink system (`DrawingManager`)
- Players have an ink resource (`currentInk`), starting at **200** (not MAX_INK) on round start.
- `MAX_INK = 400`. Ink regenerates at **0.4 per frame** when not drawing.
- Drawing a path consumes ink proportional to segment length (`distance * 0.1`).
- Paths are stored as **relative coordinates** from the player position.
- On mouse release (`stopDrawing`):
  - If path distance < `MIN_PATH_LENGTH` (200): path is discarded and ink is refunded.
  - Otherwise: path is normalized so the first point is at origin (offset subtracted).
- On cancel (`cancelDrawing` via E key): full ink refund for the drawn path.

#### Shooting (`ProjectileManager.shootProjectile`)
1. Requires a drawn path (length > 1) and `projectileCount > 0`.
2. Converts relative path to world coordinates.
3. Resamples path to uniform 5-unit steps via `DrawingManager.resamplePath()`.
4. Emits `shootProjectile` to server with the resampled path.
5. Decrements local `projectileCount` and swaps player sprite to shoot animation (320ms).

#### Projectile count
- Starts at **5** (`INITIAL_PROJECTILE_COUNT` in `ProjectileManager`).
- Regenerates at **0.001 per frame** (`PROJECTILE_REGEN_RATE`) up to max **10** (`MAX_PROJECTILE_COUNT`).
- Reset to **10** on round reset (`SocketManager.resetMap`).

#### Projectiles (server-side, `Game.js`)
- Server receives the path, generates a projectile ID (`playerId + Date.now()`).
- Before storing, the server checks each path segment for barrier collision using Cohen-Sutherland outcode + line-segment intersection. If a segment crosses a barrier, the path is truncated there and `hitBarrier` is flagged.
- Each tick, the server advances `proj.index` along the path by 1.
- When a projectile reaches the end of its path (or hits a barrier end), it creates an explosion and is deleted.
- Server broadcasts the new projectile to the room via `newProjectile` event.

#### Projectiles (client-side, `ProjectileManager`)
- Client receives projectiles two ways:
  1. **`newProjectile` event** (incremental): Creates a sprite at path[0] and adds it to the appropriate group (player or enemy).
  2. **`gameState` updates** (`updateProjectiles`): Full refresh -- destroys all existing sprites and recreates from server state.
- Client-side movement (`moveProjectiles`): Interpolates along the path at speed **10 pixels/frame** using angle-based movement (not index stepping like the server).
- Phaser physics groups handle collision detection client-side for visual effects only:
  - Player projectiles vs enemy projectiles: emits `projectileCollision` to server
  - Projectiles vs barriers: destroys sprite locally
  - Enemy projectiles vs current player: destroys sprite locally
  - Player projectiles vs other player sprites: destroys sprite locally

#### Projectile-projectile collision
This is a **client-detected, server-applied** system. The client detects overlap via Phaser physics groups, emits `projectileCollision` to the server, and the server deletes both projectiles and adds an explosion. This means the detecting client is authoritative for projectile-vs-projectile hits.

#### Player movement (server-side, `Game.movePlayer`)
- Client sends normalized direction (`{x: -0.5..0.5, y: -0.5..0.5}`).
- Server multiplies by `PLAYER_SPEED` (5), clamps to game bounds, then runs `resolveBarrierCollision`.
- Barrier collision uses AABB overlap detection with minimum-penetration resolution (pushes the player out along the axis of least overlap).

#### Collision detection (`Game.checkCollisions`)
- Each tick, the server checks all projectiles against all players.
- A projectile hits if: it belongs to a different player AND distance < `PLAYER_WIDTH / 2` (40px) AND the target is not invincible.
- On hit: decrement lives, create explosion, delete projectile, emit `playerHit` to the hit player, start invincibility.
- If lives reach 0: increment other player's score, call `endRound()`, clear all projectiles.

#### Invincibility
- Duration: **2000ms** (`INVINCIBILITY_DURATION`).
- Server tracks via `invinciblePlayers` Map (playerID -> end timestamp).
- Server emits `invincibilityEnded` when it expires.
- Client shows a blinking alpha tween (0.5 alpha, 200ms yoyo) managed by `PlayerManager`.

---

### Match, rounds, and maps

- `ROUNDS_PER_MATCH = 5`
- `MAX_LIVES = 1` (each round is one-hit-kill)
- Maps are defined in `server/maps.js` and **shuffled randomly** on game creation.
- Each map has:
  - `id`, `name`
  - `barriers[]`: `{ x, y, width, height }` (center-origin rectangles)
  - `nets[]`: `{ x, y, width, height }` (currently visual-only; no server-side collision logic for nets)
  - `playerSpawnScale[]`: Two `[xPercent, yPercent]` entries for player 1 and player 2 spawn positions (multiplied by GAME_WIDTH/HEIGHT)

#### Round flow
1. A player's lives reach 0.
2. Server increments the killer's score.
3. If `currentRound < ROUNDS_PER_MATCH`:
   - Advance round, rotate to next map.
   - Reset lives, positions, projectiles, invincibility.
   - Emit `roundEnded` and `mapSelected`.
4. If `currentRound >= ROUNDS_PER_MATCH`:
   - Emit `matchEnded` with winner and scores.
   - Reset everything (including scores) for a new match.
   - Emit `mapSelected` for round 1.

#### Client map handling
- On `mapSelected`: rebuilds barrier and net static physics groups.
- On `roundEnded`: currently a no-op (mapSelected handles it).
- On `matchEnded`: shows overlay with Win/Lose text, scores, and "Back to Lobby" button. Sets `gameover = true` and pauses physics.
- `pointScored` event triggers `SocketManager.resetMap()`: clears local projectiles/drawing, resets projectile count to 10, resets ink to 200, stops invincibility tweens, requests fresh game state.

#### Currently active maps
Only Map 1 is active (Maps 2-4 are commented out in `maps.js`):
- **Map 1**: Center vertical barrier (100x300), 4 nets near top/bottom, players spawn at 25%/75% x, 50% y.

---

### Networking protocol

#### Client -> Server
| Event | Payload | Purpose |
|-------|---------|---------|
| `playerMovement` | `{ gameId, playerId, movement: {x, y} }` | Send movement input |
| `shootProjectile` | `{ gameId, playerId, path: [{x,y}...] }` | Fire a projectile along path |
| `projectileCollision` | `{ gameId, projectile1Id, projectile2Id, x, y }` | Client-detected proj vs proj |
| `createGame` | `playerId` | Create a new lobby room |
| `joinGame` | `{ gameId, playerId }` | Join an existing room |
| `removeGame` | `{ gameId, playerId }` | Delete a room (creator only) |
| `currentGames` | (none) | Request list of all rooms |
| `requestGameState` | `gameId` | Request immediate state + map sync |

#### Server -> Client
| Event | Payload | Purpose |
|-------|---------|---------|
| `gameState` | `{ players[], projectiles[], explosions[], round, map }` | Full state snapshot (120 Hz) |
| `newProjectile` | `{ id, path, index, shooter_id, isSecondPlayer, hitBarrier }` | New projectile created |
| `playerHit` | `{ playerId }` | Sent to the hit player only |
| `invincibilityEnded` | (none) | Sent to the player whose invincibility expired |
| `pointScored` | (none) | A round was scored; clients should reset |
| `startGame` | `{ id, players[], started, creator }` | Game begins (2 players joined) |
| `mapSelected` | `{ round, map }` | Load/rebuild map for this round |
| `roundEnded` | `{ round, nextRound, map }` | Informational round transition |
| `matchEnded` | `{ totalRounds, winnerId, scores[] }` | Match completed |
| `playerDisconnected` | `socketId` | Opponent left |
| `gameCreated` | game object | Lobby: new room created |
| `gameRemoved` | `gameId` | Lobby: room deleted |
| `gameJoined` | game object | Lobby: player joined a room |
| `currentGames` | `{ [gameId]: game }` | Lobby: full room list |

---

### Key constants

#### Client (`inky/src/game/constants.js`)

All client magic numbers are centralized in this file (~45 constants). Key groups:

| Category | Constants |
|----------|-----------|
| Dimensions | `GAME_WIDTH` (1280), `GAME_HEIGHT` (720) |
| Ink system | `MAX_INK` (400), `INITIAL_INK` (200), `INK_REGEN_RATE` (0.4), `INK_COST_PER_PIXEL` (0.1) |
| Drawing | `MIN_PATH_LENGTH` (200), `DRAWING_LINE_WIDTH` (2), `DRAWING_LINE_COLOR` (0xff0000), `BOUNDARY_BUFFER` (1), `RESAMPLE_STEP` (5) |
| Player | `PLAYER_SPRITE_SCALE` (0.2), `PLAYER_DEPTH` (1), `PLAYER_MOVEMENT_SPEED` (0.5) |
| Projectiles | `PROJECTILE_SPRITE_SCALE` (0.07), `PROJECTILE_SPEED` (10), `PROJECTILE_DEPTH` (2), `INITIAL_PROJECTILE_COUNT` (5), `MAX_PROJECTILE_COUNT` (10), `PROJECTILE_REGEN_RATE` (0.001) |
| Animations | `SHOOT_ANIMATION_DURATION` (320), `EXPLOSION_SIZE` (80), `EXPLOSION_DURATION` (200), `ROUND_TEXT_DURATION` (1500), `INVINCIBILITY_FLASH_DURATION` (200) |
| UI layout | `INK_BAR_X` (32), `INK_BAR_Y_OFFSET` (48), `INK_BAR_WIDTH` (185), `INK_BAR_HEIGHT` (15), `PROJECTILE_UI_SCALE` (0.05), `PROJECTILE_UI_SPACING` (30), `LIFE_UI_SCALE` (0.07), `LIFE_UI_SPACING` (50) |

#### Server (`server/config.js`)
| Constant | Value | Usage |
|----------|-------|-------|
| `GAME_TICK_RATE` | 120 | Server updates per second |
| `PLAYER_SPEED` | 5 | Pixels per movement tick |
| `MAX_LIVES` | 1 | Lives per round (one-hit kill) |
| `GAME_WIDTH` | 1280 | Authoritative game width |
| `GAME_HEIGHT` | 720 | Authoritative game height |
| `INVINCIBILITY_DURATION` | 2000 | Invincibility window in ms |
| `PLAYER_WIDTH` | 80 | Player hitbox width |
| `PLAYER_HEIGHT` | 80 | Player hitbox height |
| `ROUNDS_PER_MATCH` | 5 | Rounds before match ends |

---

### Architecture notes

#### Client architecture
`MainScene` is the composition root. It creates 6 manager instances in `create()`, passing `this` (the scene) to each constructor. Each manager owns its own state and accesses other managers via `this.scene.managerName`.

**State ownership** -- each manager owns the state it operates on:

| Manager | Owned state |
|---------|------------|
| `PlayerManager` | `currentPlayer`, `otherPlayers`, `otherPlayersGroup`, `isSecondPlayer`, `checkedPlayer`, `invincibilityTweens` |
| `ProjectileManager` | `playerProjectiles`, `enemyProjectiles`, `playerProjectilesGroup`, `enemyProjectilesGroup`, `projectileCount` |
| `DrawingManager` | `currentInk`, `graphics`, `drawPath`, `isDrawing` |
| `UIManager` | `inkBar`, `barBackground`, `scoreText`, `projectileContainer`, `projectileSprites`, `livesContainer`, `lifeSprites` |
| `MainScene` (kept) | `gameId`, `socket`, `gameover`, `currentRound`, `currentMap`, `barriers`, `nets`, `roundText` |

Cross-manager access uses `this.scene.playerManager.currentPlayer` etc.

#### Server architecture
`Game.js` is a self-contained class that owns all authoritative game state and emits events directly via `this.io`. It receives the Socket.IO `io` instance in its constructor and broadcasts to rooms itself (e.g., `this.io.to(this.id).emit(...)`). Collision geometry functions (AABB resolution, Cohen-Sutherland line intersection) are extracted into `collision.js` as pure functions.

Socket handlers are split into three files: `socket.js` is a thin orchestrator that wires up `lobbyHandlers.js` (create/join/remove/list rooms) and `gameHandlers.js` (movement, shooting, projectile collision, state requests). Both receive a `deps` object containing `{ activeGames, lobbyGames }`. The `Game` class also emits events directly, creating two emission points.

#### Player identity
Players are identified by their `socket.id`. The first player to join is player 1 (`isSecondPlayer = false`), the second is player 2 (`isSecondPlayer = true`). This flag determines which sprite/projectile texture is used.

#### Client-server reconciliation
The client does NOT interpolate or predict. It receives authoritative positions from the server at 120 Hz and directly sets sprite positions. Client-side projectile movement exists only for smooth visual interpolation between the resampled path points -- the server's index-based advancement is the source of truth for hit detection.

---

### Disconnect handling
- When a socket disconnects:
  - If they created a game room, the room and active game are deleted.
  - If they were in an active game, they are removed. The remaining player gets a `playerDisconnected` event.
  - If the game has 0 players, it's cleaned up.
- Client shows an overlay ("Opponent Disconnected") with a "Back to Lobby" button.
- "Back to Lobby" uses `window.location.href = '/'` (full page reload), which also applies to the match-end screen.

---

### Deployment
- **Server**: Listens on `process.env.PORT || 3000`. CORS origin via `CORS_ORIGIN` env var (comma-separated), defaults to `*`.
- **Client**: Set `VITE_SOCKET_URL` to server URL. Forces WebSocket transport.

---

### Conventions for development

- **Manager pattern**: Game subsystems live in `inky/src/game/managers/` as classes that receive the scene in their constructor. Instantiate in `MainScene.create()`.
- **Server authority**: Gameplay state is server-authoritative. Client visuals should be cosmetic and reconcile from `gameState` each tick.
- **Assets**: Place in `inky/src/assets/`, preload in `MainScene.preload()`.
- **New maps**: Add to `server/maps.js` array with `{ id, name, barriers[], nets[], playerSpawnScale[] }`.
- **New network events**: Lobby handlers in `lobbyHandlers.js`, gameplay handlers in `gameHandlers.js`, client listener in `SocketManager.connectToServer()`.
- **Cleanup**: Any global listeners or timers must be removed in `MainScene.shutdown()` / `cleanupScene()`.
