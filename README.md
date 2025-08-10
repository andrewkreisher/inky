## Inky – LLM Guide and Architecture

### TL;DR
- **Start everything (Windows)**: run `run-game.bat` from the repo root.
- **Start server (manual)**: from repo root run `npm run server`.
- **Start client (manual)**: `cd inky && npm run dev` and open the provided localhost URL.
- **Join flow**: Home → Lobby → Create/Join → Start → Game.

### Stack
- **Client**: React 18 + Vite + Chakra UI + Phaser 3
- **Server**: Node.js (Express) + Socket.IO
- **Networking**: Realtime via Socket.IO; server authoritative for player state, projectiles, scoring

### Repository layout
```
.
├─ server/
│  ├─ index.js              # Entry: sets up Express/Socket.IO, tick loop
│  ├─ config.js             # Server constants (sizes, speeds, tick rate, barrier)
│  ├─ Game.js               # Game class: state, movement, collisions, scoring
│  └─ socket.js             # Socket.IO event handlers (lobby + gameplay)
├─ run-game.bat             # Windows helper: starts server + client
├─ package.json             # Root scripts (server) and shared deps
├─ inky/                    # Client app (Vite)
│  ├─ package.json          # Client scripts
│  ├─ index.html            # Vite entry
│  └─ src/
│     ├─ main.jsx           # React root → mounts <App/>
│     ├─ App.jsx            # Screen router (Home/Lobby/Game), opens Socket.IO client
│     ├─ components/
│     │  ├─ Home.jsx        # Title screen → go to lobby
│     │  ├─ Lobby.jsx       # Room list; create/join; starts game via socket event
│     │  └─ Game.jsx        # Hosts Phaser; instantiates `MainScene`
│     └─ game/
│        ├─ constants.js    # GAME_WIDTH/HEIGHT, MAX_INK, MIN_PATH_LENGTH
│        ├─ Scenes/MainScene.js  # Single-scene composition root
│        └─ managers/       # Subsystems
│           ├─ InputManager.js     # WASD + mouse drawing + hotkeys
│           ├─ DrawingManager.js   # Ink budget, draw path, resampling, line render
│           ├─ ProjectileManager.js# Client-side projectile sprites and movement
│           ├─ PlayerManager.js    # Player sprites, invincibility VFX, movement emit
│           ├─ UIManager.js        # Ink bar, lives, score, HUD
│           └─ SocketManager.js    # Wire socket events to managers
```

### Runtime flow
- **Client boot**
  - `inky/src/main.jsx` renders `App`.
  - `App.jsx` connects a Socket.IO client to `http://localhost:3000` (dev) or `VITE_SOCKET_URL` (prod) and switches screens (`home` → `lobby` → `game`).
  - `Game.jsx` creates a `Phaser.Game` and registers `MainScene`. When ready, passes `socket` and `gameData` (room id) to the scene.

- **Scene composition** (`MainScene.create()`)
  - Instantiates managers: `PlayerManager`, `ProjectileManager`, `UIManager`, `InputManager`, `SocketManager`, `DrawingManager`.
  - Creates world objects: background, one central static barrier, physics groups for players and projectiles.
  - Sets physics overlaps to spawn local explosion sprites and clean up projectiles on collision (visual-only; hits are authoritative on the server).
  - Hooks input and connects sockets.

- **Controls**
  - **Move**: WASD → `PlayerManager.handlePlayerMovement()` emits `playerMovement` to server.
  - **Draw path**: Mouse down/move/up → `DrawingManager` tracks a relative path from player; consumes `currentInk`.
  - **Shoot**: Space → `ProjectileManager.shootProjectile()` resamples path, sends to server, decrements local projectile count.
  - **Cancel drawing**: E → refunds ink for short paths.

- **Server tick** (`server/index.js` + `server/Game.js`)
  - `server/index.js` maintains a `Game` instance per active room (`activeGames`), updates at `GAME_TICK_RATE`.
  - Authoritative movement with barrier collision resolution; clamps to bounds.
  - Projectiles advance index-along-path; barrier line-intersection prunes paths when submitted.
  - Collision: projectile vs non-shooter player → decrement lives, invincibility window, point/score, game reset.
  - Emits `gameState` snapshots to each room’s players every tick by broadcasting to the Socket.IO room (`io.to(gameId)`), plus discrete events for new projectiles, points, etc.

### Networking protocol
- **Client → Server**
  - `playerMovement { gameId, playerId, movement: {x,y} }`
  - `shootProjectile { gameId, playerId, path: [{x,y}, ...] }`
  - `projectileCollision { gameId, projectile1Id, projectile2Id, x, y }` (client-side detected projectile-proj overlap)
  - Lobby: `createGame playerId`, `currentGames`, `removeGame { gameId, playerId }`, `joinGame { gameId, playerId }`

- **Server → Client**
  - `gameState { players, projectiles, explosions }` (authoritative; explosions array is transient)
  - `newProjectile projectile` (projectile born)
  - `startGame gameData` (sent to the two players once both have joined)
  - Lobby: `gameCreated game`, `gameRemoved gameId`, `gameJoined game`
  - Scoring/lifecycle: `pointScored`, `playerDisconnected playerId`, `invincibilityEnded`

### Key systems
- **Ink + drawing** (`DrawingManager`)
  - Path is stored relative to player; on shoot it is converted to world coords and resampled to uniform step via linear interpolation.
  - Ink drains by segment length, refills when not drawing; very short paths refund ink.

- **Projectiles** (`ProjectileManager` client, server authoritative in `Game`)
  - Client owns visuals and path interpolation; server advances an index along the submitted path, deletes on end/hit, and broadcasts `gameState`.
  - Client renders projectile sprites each tick from `gameState` (full refresh) or reacts to `newProjectile` (incremental add).

- **Players** (`PlayerManager`)
  - Local keyboard input emits movement deltas; server applies speed, clamps, resolves barrier collision, and returns the updated positions.
  - Invincibility visual tween is started/stopped based on `gameState` flags for each sprite.

- **UI** (`UIManager`)
  - Renders ink bar, remaining lives (as small player icons), projectile count, and score text.
  - Handles game-over/peer disconnect overlay and “Back to Lobby”.

### Important constants
- `inky/src/game/constants.js`
  - `GAME_WIDTH = 1280`, `GAME_HEIGHT = 720`
  - `MAX_INK = 400`
  - `MIN_PATH_LENGTH = 200`
- `server/config.js`
  - `GAME_TICK_RATE = 120`, `PLAYER_SPEED = 5`, `MAX_LIVES = 3`, `INVINCIBILITY_DURATION = 2000`

### How to run
- Windows: double-click `run-game.bat` in the repo root.
- Manual:
  - Terminal 1: repo root → `npm install` (first time) → `npm run server`
  - Terminal 2: `cd inky` → `npm install` (first time) → `npm run dev` → open localhost URL

### Deployment & config
- **Server**
  - Listens on `process.env.PORT || 3000`.
  - CORS origin can be set via `CORS_ORIGIN` (comma-separated list). Defaults to `*` in development.
  - Broadcasts `gameState` via Socket.IO rooms. Sockets join their `gameId` room on create/join.
- **Client**
  - Set `VITE_SOCKET_URL` to your server URL (e.g., `https://api.yourgame.com`).
  - Client forces WebSocket transport: `{ transports: ['websocket'] }`.

### Conventions & extension guide (for LLMs)
- **Architecture**
  - Keep gameplay code in `MainScene` and decompose systems under `inky/src/game/managers/` as classes that receive a `scene` in their constructor. Instantiate in `MainScene.create()`.
  - Prefer server-authoritative state. If you add local VFX, keep them cosmetic and reconcile state from `gameState` on each tick.

- **Add a new asset**
  - Place under `inky/src/assets/`.
  - Preload in `MainScene.preload()` via `this.load.image(...)` (or appropriate loader).

- **Add a new system (manager)**
  - Create `inky/src/game/managers/MyNewManager.js` exporting `class MyNewManager`.
  - Instantiate in `MainScene.create()` and wire any event/input hooks there.
  - If it needs per-frame work, call into it from `MainScene.update()`.

- **Add a new network event**
  - Server: define the `socket.on('event', ...)` handler in `server/socket.js` and emit to the appropriate room (`io.to(gameId)`).
  - Client: register the listener in `SocketManager.connectToServer()` and route to the right manager.
  - Document it in the Networking protocol section below.

- **UI/HUD changes**
  - Extend `UIManager` to add elements, then call `createUI()`/`updateUI()` accordingly.

- **Cleanup**
  - If you add global listeners or timers, ensure they are removed in `MainScene.shutdown()` or a dedicated cleanup method.

### LLM update checklist
When you make changes, keep this README in sync. Use this checklist:
- [x] If you add, rename, or move files, update the Repository layout tree and any file paths mentioned.
- [x] If you change constants, mirror them here under Important constants.
- [x] If you add/modify socket events, update the Networking protocol section (both directions) and the affected manager references.
- [x] If you add a new system/manager, document it under Key systems and in the extension guide.
- [x] If you change inputs or controls, update the Controls section.
- [x] If you change run instructions or ports, update How to run.
- [x] If you introduce cleanup-sensitive listeners/timers, verify `MainScene.shutdown()` handles them and note it under Cleanup.

### Minimal code pointers
Use your editor “Go to definition” on these as starting anchors:
- `MainScene.create`, `MainScene.update`, `MainScene.preload`
- `InputManager.setupInput`, `DrawingManager.resamplePath`
- `ProjectileManager.shootProjectile`, `ProjectileManager.updateProjectiles`
- `PlayerManager.updatePlayers`, `UIManager.updateUI`
- Server: `class Game` methods `movePlayer`, `addProjectile`, `checkCollisions`, `getState` and Socket.IO handlers in `server/socket.js` 