# World save / load

Goal: author non-empty "default worlds" in the app, ship them in the repo, and start (and restart after a resize) from a random one instead of an empty grid.

Decisions already made:

- **Sizing:** a saved world is anchored bottom-center on load; extra width/height is cropped, a smaller world leaves air.
- **Authoring:** Save / Load buttons in the header.
- **On load:** several bundled worlds, one picked at random per page visit.
- **Resize / tile size change:** reload the (same) default world instead of clearing to empty. Painted changes are lost, as today.

## File format (`.idw`)

Binary, little-endian, no dependencies:

| Bytes | Content |
|---|---|
| 0–3 | magic `IDW1` |
| 4–5 | width in cells (u16) |
| 6–7 | height in cells (u16) |
| 8–9 | tile size in CSS px x 100 at save time (u16; informational, see open question 1) |
| 10–15 | reserved (zero) |
| 16– | `gzip(Uint32Array(width * height))` via `CompressionStream('gzip')` |

The payload is the packed grid word as the GPU stores it (type 0–7, value 8–15, variant 16–23, age 24–31), row-major `y*W+x`. Mostly air, so gzip makes files tiny, and there is no custom RLE to maintain. Type ids are stable constants in `SETTINGS`, so files stay valid as long as ids are never renumbered. On load, a type that is not registered becomes air. Loading validates magic, nonzero dimensions, and decompressed length == `w*h*4`.

## Engine (`src/engine/gpu/gpu-simulation.ts`)

New `src/engine/world-file.ts` (pure, no GPU): `encodeWorld(snapshot): Promise<Blob>`, `decodeWorld(buffer): Promise<WorldSnapshot>` where `WorldSnapshot = { width, height, tileCss, cells: Uint32Array }`.

New methods on `GpuSimulation`:

- `snapshotWorld(): Promise<WorldSnapshot>`: wraps the existing `readGrid()` plus current `width`, `height`, `tileSize`.
- `loadWorld(snapshot)`: sync.
  1. Build a `width*height` `Uint32Array` of air, copy the snapshot rows in with `dx = floor((W - sw) / 2)`, `dy = H - sh` (negative `dy` crops the top; negative `dx` crops both sides).
  2. Zero any cell inside a collider. The solid mask is already built on the CPU in `rebuildSolidMask`; factor the mask construction into a helper both use, so a loaded world never puts tiles inside overlay rects.
  3. Zero types that are not registered.
  4. `queue.writeBuffer` into **both** grid buffers (keeps the "sleeping chunks have matching buffers" invariant trivially true).
  5. Set `wakeAllPending = true` and call `wake()`, the same path wind and collider changes use, so every chunk is awake before the first step and the world settles and sleeps on its own.
- `resize()` and `setTileSize()` stay clearing. The caller loads the default afterwards (below), before the first step runs, so there is no visible empty frame.

Nothing changes in the shaders or the uniform layout.

## Default worlds

- Files live in `src/worlds/*.idw`. Vite bundles them with `import.meta.glob('./worlds/*.idw', { query: '?url', import: 'default', eager: true })` (no runtime dependency, no new config; `vite/client` types for `import.meta.glob`).
- New `src/worlds/index.ts`: `pickDefaultWorld(): Promise<WorldSnapshot | null>` picks a random url once per page visit (module-level cache of the decoded snapshot, so resizes reuse the same world), fetches and decodes it. Returns `null` when the folder is empty or decoding fails (log a warning), and the app falls back to an empty world exactly as today.
- `src/main.ts`:
  - after `GpuSimulation.create` and before `world.start()`: `const defaultWorld = await pickDefaultWorld(); if (defaultWorld) world.loadWorld(defaultWorld);`
  - in the resize handler and in `perfHud.onTileSizeChange`: call `world.loadWorld(defaultWorld)` right after `world.resize(...)` / `world.setTileSize(...)` (before `overlay.refreshColliders()` is fine, since `loadWorld` reads the collider list at call time, but call `loadWorld` **after** `refreshColliders()` so the mask is current).

## UI (`src/ui/world-menu.ts`)

Follows the `PerfHud` / `ElementPicker` pattern and mounts into `#header .header-actions`. Two buttons, **Save** and **Load**:

- **Save:** `await world.snapshotWorld()` → `encodeWorld` → `<a download="world-<W>x<H>.idw">` from a blob URL (revoke after click).
- **Load:** hidden `<input type="file" accept=".idw">`; on pick, `decodeWorld` → `world.loadWorld`. It applies to the current grid (no resize), so it is also how you preview a candidate default before dropping it into `src/worlds/`.
- Header clicks already do not paint (`isUiTarget` matches `#header`), so no extra input handling. Bad files show a one-line message (reuse the small HUD/inline text style rather than a new dialog).
- Styles added to `src/styles/main.css` beside the existing button styles.

Authoring loop: paint a scene, click Save, move the file into `src/worlds/`, rebuild.

## Docs and checks

- AGENTS.md: add the world file format, `loadWorld` / `snapshotWorld`, the defaults folder, "resize reloads the default world instead of clearing", and the new files in the file map.
- No test framework. Validate with `npx tsc --noEmit` and `npm run build`; unit-check `encodeWorld` / `decodeWorld` round-trip and the anchoring math (crop/pad cases) in a throwaway Node script (`CompressionStream` exists in Node 18+, and neither module touches the GPU).
- In a WebGPU browser: save, reload via Load, check a window resize, a tile size change, and a collider overlapping a loaded scene. Confirm no `uncapturederror` in the console.

## Risks

- **Looks different per screen.** With crop/pad, a scene authored on a wide monitor loses its sides on a phone. Author worlds with the important content near the horizontal center and the floor.
- **Everything starts awake.** Loading a big world wakes all chunks for `CHUNK_KEEPALIVE_STEPS`; it is the same cost as a wind change and then settles.
- **Pools never sleep** (known water wander), so a default world with water keeps the sim from idling; that is existing behavior, not new.
- **Id stability.** Renumbering a type in `SETTINGS` silently corrupts saved worlds. Add a note next to the type constants; new types get new ids.

## Open questions

1. **Tile size mismatch.** A world saved at 4 px tiles loaded at 8 px (or on a different devicePixelRatio) is cropped, not scaled. Default plan: ignore it in v1 (the header records the saved tile size so resampling can be added later). Alternative: nearest-neighbor resample by the tile-size ratio on load.
2. **Randomness on resize.** The plan keeps the same random world for the whole visit; re-rolling on every resize would be one line to change.
3. **Dev override.** A `?world=<file-name>` query param to force a specific default would help testing; it is small, but not in scope unless wanted.
