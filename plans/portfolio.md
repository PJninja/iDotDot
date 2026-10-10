# Portfolio content

Goal: list 10-20 projects as cards that live *inside* the falling-sands world, not on top of it. Each card expands to a preview and then to a full detail view with text and screenshots. Intent doc: this file is the plan, `AGENTS.md` and the code are the current state.

Decisions already made:

- **No page scroll.** The canvas is fixed to the viewport and colliders must not move relative to the grid. All projects are visible at once as compact chips; there is no paging.
- **Cards are solid.** Each card's interior is a collider (sand, water and fire respect it).
- **Borders are real tiles.** Each card is surrounded by a ring of static element tiles. Sand rests on it, wood burns, acid dissolves steel, ice melts. The material is a per-project choice.
- **Damage is cosmetic and permanent until reload.** A destroyed border never affects function and is not repaired; a reload or a resize (which rebuilds the world) restores it.
- **Two-stage expand.** Chip -> grown preview -> full detail panel.
- **Visual style: blocky and tile-aligned.** Edges snap to the tile grid, colors come from the element palettes, thumbnails are pixelated.
- **Content:** one typed TS module per project.

## Chip contents

Each chip shows, at a glance: an icon, the title, a short description (2 lines max) and exactly 3 tags. Size is a whole number of tiles (target around 160 x 100 CSS px at 4 px tiles, so a 5 x 4 grid fits a 1280 x 720 viewport with gaps for sand). Everything longer lives in the preview / detail views.

## Data (`src/projects/`)

- `src/projects/project.ts`: `Project` type: `id` (kebab-case, also the URL hash), `title`, `summary` (chip description), `tags` (tuple of 3), `icon` (an inline SVG string or an imported asset URL), `border` (a registry element name or type constant), `blurb` (preview text), `sections` (`{ heading, body }[]` for the detail view), `screenshots` (`{ src, alt, caption? }[]`, imported with Vite `?url`), `links` (`{ label, href }[]`), `order`.
- One file per project: `src/projects/<id>.ts` exports a default `Project`. `src/projects/index.ts` collects them with `import.meta.glob(..., { eager: true })` (same pattern as `src/worlds/`), validates (unique ids, exactly 3 tags, known border material) and sorts by `order`.
- Images live next to the module (`src/projects/<id>/…`) so Vite hashes and bundles them. Zero runtime dependencies stays true.

## Cards (`src/ui/project-chip.ts`, `src/ui/project-board.ts`)

- The board lays chips out on a grid measured in tiles: CSS custom property `--tile` is set from `world.tileSize` (may be fractional, see AGENTS.md Tile size), chip size and gap are `calc(n * var(--tile))`, and the board is anchored so every chip edge lands on a cell boundary. `Overlay.measure` rounds outward, so an off-grid edge would leave a 1-cell gap between the DOM and the ring; aligned layout avoids that.
- Chips are real `<button>`/`<article>` elements: focusable, Enter/Space expands, Esc collapses, correct ARIA (`aria-expanded`, `aria-controls`). The sim is decoration, content is HTML.
- Each chip is registered with `Overlay.registerCollider`. The board owns the list of cards and their current rect.
- The overlay already ignores painting clicks on its children, so clicking a chip never paints.

## Border ring (engine)

Painting a ring through `paintStroke` is not viable: it is capped at `MAX_STAMPS` per frame, tied to stepping frames, and 20 rings would not fit. Add a dedicated rect-outline path instead:

- `GpuSimulation.stampFrame(rect, type, thickness)` and `clearFrame(rect, thickness)` (stamps air). Queued like paint stamps, executed in the same pass as `PAINT_WGSL` before the first step, marking touched chunks awake.
- Rects are uploaded as a small storage/uniform array and rasterized in one dispatch over the union bounding box; a cell inside any ring gets the material, with a per-cell random variant like brush strokes so the border has natural color variation.
- The ring is stamped just *outside* the collider rect (thickness 1-2 cells). `PAINT_WGSL` skips solid-mask cells, so the ring cannot overlap the interior.
- Overwrite is unconditional, like painting: material sitting in the ring cells is replaced. Open question: whether to also shove material rather than delete it (see below).

## Rebuilding after a grid reset

Resize, `setTileSize` and `loadWorld` clear or replace the grid, which erases every ring. `main.ts` currently repeats `overlay.refreshColliders(); loadDefaultWorld();` in two places. Fold both into one `rebuildWorld()` that runs in order: `refreshColliders` -> re-measure board layout -> `loadDefaultWorld` -> `stampFrame` for every card. A default world loaded with `loadWorld` already clears collider cells; the ring cells are outside colliders, so stamping *after* the load is what guarantees rings sit on top of the world content.

## Expand: stage 1, preview (grow in place)

1. Click a chip: the board computes the grown rect (chip becomes ~2x2 chips, showing `blurb` plus the first screenshot, with `More` and `Close` buttons). Neighbors stay put; the grown card overlaps free gaps, and where chips are adjacent it grows toward free space (or the board reserves expansion room by design: layout decision for implementation).
2. `clearFrame(oldRect)`, update the DOM rect (CSS transition off; the collider and ring must be correct on the first frame, so no animated resize), `stampFrame(newRect)`. Cells covered by the new interior hold sand? They are removed by the collider rebuild (verify this; see open items).
3. Collapse reverses it. Only one card is in the preview state at a time.

## Expand: stage 2, detail panel

- `More` opens a large panel (about 70% of the viewport, tile-aligned) with the sections, a screenshot gallery (click a screenshot to cycle, arrows / keys) and links. The panel is its own collider and has its own ring (project's material), the sim keeps running (or idles) behind it, and the rest of the board stays visible and solid behind a dim layer.
- Deep link: hash `#/<id>`. Opening writes the hash; `hashchange` / Back closes it. Loading a URL with a hash opens that project's detail directly after the first rebuild.
- Closing restores the preview or collapsed chip.

## Screenshots

- Chips and preview use pixelated thumbnails (downscale to roughly the tile resolution, `image-rendering: pixelated`) so they look like they belong in the grid.
- The detail panel shows full-quality images (`<img loading="lazy" decoding="async">`, explicit `width`/`height`, `alt` required).

## Edge cases

- **Window resize / mobile:** layout is recomputed on each coalesced resize (one per animation frame, as today); on narrow viewports (below a breakpoint) fewer columns, and the detail panel takes the full viewport. Touch painting remains outside cards.
- **Tile size change from the perf HUD:** goes through `rebuildWorld()`.
- **Header z-order:** the board lives in `#overlay` (below the 48 px header).
- **`prefers-reduced-motion`:** no grow animation (there is none by default) and no gallery transitions.
- **Idle:** a spring/torch/aging border keeps chunks awake as normal; nothing special is needed. A pool on the board prevents idle as today.
- **Wood borders and fire:** a burning ring ends with air around the interior; the interior is still a collider, so layout is unaffected.

## Open items (verify before relying)

1. What the sim does with tiles inside cells that *become* solid because a collider grows (expanding a card over existing sand). `rebuildSolidMask` + `wakeAllPending` wake the chunks, but tiles already in newly solid cells need to be cleared or displaced; read the shader paths and confirm.
2. Whether to shove material away from a growing card (a one-shot outward push) rather than delete it. Deleting is simplest; shoving looks better.
3. Exact layout rule for where a grown preview goes when neighbors are adjacent.
4. Icon format: inline SVG strings vs imported assets (affects pixelation).
5. Fractional `tileSize` at 125% / 150% DPR: confirm chip edges and ring alignment at several tile sizes.

## Build order

1. `Project` type, `import.meta.glob` loader with validation, three placeholder projects.
2. `stampFrame` / `clearFrame` in the engine + `rebuildWorld()` refactor in `main.ts`.
3. Board + chips (static layout, colliders, rings, keyboard/ARIA).
4. Preview expand/collapse.
5. Detail panel, gallery, deep link.
6. Real content, real icons and screenshots; tune ring materials and spacing.

Wait for the default-worlds work to land before step 2, since both touch `main.ts` and the world-rebuild path.
