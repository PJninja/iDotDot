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
- **Five additions** (each has its own section below): a plain-HTML view built from the same project data, an identity hero plus contact dock made of tiles, tag filtering that uses the elements, a portfolio mode vs play mode, and structured case-study content with video.

## Chip contents

Each chip shows, at a glance: an icon, the title, a short description (2 lines max) and exactly 3 tags. Size is a whole number of tiles (target around 160 x 100 CSS px at 4 px tiles, so a 5 x 4 grid fits a 1280 x 720 viewport with gaps for sand). Everything longer lives in the preview / detail views.

## Data (`src/projects/`)

- `src/projects/project.ts`: `Project` type: `id` (kebab-case, also the URL hash), `title`, `summary` (chip description), `tags` (tuple of 3), `icon` (an inline SVG string or an imported asset URL), `border` (a registry element name or type constant), `blurb` (preview text), `sections` (`{ heading, body }[]` for the detail view), `screenshots` (`{ src, alt, caption? }[]`, imported with Vite `?url`), `links` (`{ label, href }[]`), `order`. Case-study fields (see Case-study content): `role`, `timeline`, `stack` (string[]), `outcome`, optional `video`.
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

## Case-study content

Screenshots alone do not say what was done, so every project has the same shape and the detail view renders it the same way:

- A facts row: `role`, `timeline`, `stack`, `outcome` (one sentence), all required, validated by the loader.
- `sections` for the write-up, then the gallery, then `links`.
- Optional `video`: a short muted looping clip (`<video muted loop playsinline preload="none">`, poster = first screenshot, `.webm` and `.mp4` sources) shown at the top of the gallery. It loads only when the detail view opens, never from the chips. Paused when the tab is hidden and under `prefers-reduced-motion` (poster only).
- Keep clips small (bundled by Vite, so they count toward the deploy size); guidance of a few MB each, decided when real content arrives.

## Screenshots

- Chips and preview use pixelated thumbnails (downscale to roughly the tile resolution, `image-rendering: pixelated`) so they look like they belong in the grid.
- The detail panel shows full-quality images (`<img loading="lazy" decoding="async">`, explicit `width`/`height`, `alt` required).

## Tag filter (elements as feedback)

- With 10-20 chips, visitors need to find the relevant ones. A tag bar (all tags used across projects, as buttons with `aria-pressed`) sits in a free area of the board; clicking tags is a multi-select, any-match filter.
- Matching chips get a lit ring (a torch or ember tile stamped on or next to the ring); non-matching chips get an ice ring and their DOM content is dimmed. Clearing the filter restores each chip's own material. Both effects use the same `stampFrame` / `clearFrame` path as expand.
- Filtering overwrites border damage on the affected chips and stamping restores their rings. Accepted: it is a deliberate user action, and "permanent until reload" still holds when no filter is used.
- Non-matching chips stay focusable and clickable (filtering never removes content), only dimmed.
- Filter state is mirrored in the URL (`?tag=webgpu`) so it can be shared, and read back on load after the first rebuild.

## Identity hero and contact dock

- **Hero:** the name and a one-line tagline are part of the default world, stamped in tiles (stone, or wood to be burnable) near the top of the board, authored with the Save / Load tooling like the other default worlds. Because worlds resample by tile size, the hero is authored at 4 px tiles; an HTML `<h1>` and tagline stay in the page (visually hidden or under the tile text) so the identity is always accessible and indexed.
- **Contact dock:** a small fixed group of chips for email (click copies to the clipboard and confirms), GitHub, resume and other links. Each is a real `<a>`/`<button>` and a collider, with a ring of its own. The primary contact chip's ring is a permanent torch so it stays the one lit thing on the board.
- Dock position is part of the board layout (a corner or the bottom edge), reserved so it is never covered by a grown preview.

## Portfolio mode and play mode

- **Portfolio mode (default):** chips, hero and contact dock, with a minimal header (title, mode toggle, plain-view link). The brush picker, element picker, perf button and world menu are hidden.
- **Play mode:** the full existing toolbox is revealed, and the chips and dock stay (they are solid and part of the world). A Reset world button reloads this visit's default world and re-stamps the rings; it is available in both modes.
- The mode toggle is a header button; the choice is remembered in `idotdot.preferences` (`loadPreferences` validates the new field and falls back to portfolio mode).
- A one-time hint, such as "drag to pour sand", shows on the first visit and is dismissed by the first paint or any click; whether it was seen is stored in preferences. Painting outside UI is allowed in both modes, only the toolbox visibility differs.

## Plain view and SEO

- A plain page rendered from the same `Project` modules: header, identity, one article per project (facts, write-up, screenshots, video, links) and the contact links. No canvas, no WebGPU, normal scrolling and semantics.
- **When it shows:** automatically if `navigator.gpu` is missing or device creation fails (replacing the blocking GPU error dialog for this case), and on request via a "Plain view" link and `?view=plain`. Device loss mid-session keeps the current dialog behavior, with a link to the plain view added.
- **Build:** render it at build time with Vite (a small plugin or a post-build step that writes the static HTML into the `<noscript>`/fallback region of `index.html`) so crawlers and no-JS visitors see real content with zero runtime dependencies. Generated output must come from the same project modules, never a second copy of the content.
- **Share previews:** `og:title`, `og:description`, `og:image` (a screenshot of the world with the board), `twitter:card`, canonical URL, and a `<meta name="description">`. Per-project deep links (`#/<id>`) share the site-level preview; per-project previews would need separate pages and are out of scope.

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
6. Plain view build: a Vite plugin vs a post-build script, and how the fallback HTML and the live app share the same markup (or deliberately do not).
7. Hero: whether the name is wood (burnable, visitors can wreck it) or stone; hidden `<h1>` vs visible text beneath the tiles.
8. Which contact links and which one gets the permanent torch.
9. Tag filter: which chips lose border damage and whether non-matching ones should also be ice or just dimmed (ice melts near the lit rings next to it).
10. Video size budget and formats, and whether `preload="none"` is enough on slow connections.

## Build order

1. `Project` type, `import.meta.glob` loader with validation, three placeholder projects.
2. `stampFrame` / `clearFrame` in the engine + `rebuildWorld()` refactor in `main.ts`.
3. Board + chips (static layout, colliders, rings, keyboard/ARIA).
4. Preview expand/collapse.
5. Detail panel, gallery, deep link, case-study fields and video.
6. Tag bar and filter (lit and ice rings, URL state).
7. Hero default-world content and contact dock.
8. Portfolio / play mode toggle, Reset world, first-visit hint, preferences.
9. Plain view (generated from project modules), GPU-failure fallback, Open Graph tags.
10. Real content, real icons and screenshots; tune ring materials and spacing.

Steps 1, 9 and the data parts of 5 do not touch the engine and can start before the default-worlds work lands.

Wait for the default-worlds work to land before step 2, since both touch `main.ts` and the world-rebuild path.
