# AGENTS.md

Pac-Man clone in vanilla JS/HTML/CSS. No build system, no `package.json`, no dependencies, no tests, no lint — don't look for npm scripts or CI. The repo is also a learning project for spec-driven development.

## Running / verification

Open `src/index.html` directly in a browser — plain `<script>` tags, no modules or `fetch`, so `file://` works (or serve the folder with e.g. `python3 -m http.server`). Verification is manual: play the game (arrow keys, eat all dots, 3 lives).

## Architecture

Four scripts share globals; load order in `src/index.html` encodes dependencies:

1. `src/js/maze.js` — maze data (28x31, level-1 geometry) and constants: `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`
2. `src/js/game.js` — state and rules: `createGame()`, `update(game)`
3. `src/js/render.js` — canvas drawing: `draw(ctx, game, frame)`
4. `src/js/main.js` — game loop, keyboard input, overlay screens

- No ES modules. Adding a JS file means adding a `<script>` tag in `src/index.html` in dependency order.
- `MAZE` is the pristine template; `game.grid` is the working copy that rules mutate. Rendering must read `game.grid`, never `MAZE`, so eaten dots disappear.
- Each file's header comment documents its contract — read it before editing that file.

## Conventions

- Spanish is the project language: code comments, UI strings, README, and specs are all in Spanish. Keep new ones in Spanish.
- JS formatting (no formatter config; follow existing files): single quotes, spaces inside parens/brackets — `foo( x )`, `grid[ y ][ x ]`.

## Spec-driven workflow

Features are designed with the `/spec` skill (writes `specs/NN-slug.md`, starts in `Draft` until the user approves) and implemented with `/spec-impl` (only runs on `Approved` specs; creates branch `spec-NN-slug`, configurable via `specs/.spec-config.yml`). The `specs/` folder doesn't exist yet.
