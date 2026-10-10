# Portfolio content

Goal: list 10-20 projects as cards that live inside the falling-sands world instead of on top of it. A card opens a centered preview and then a detail view with text and screenshots.

This file is intent. `AGENTS.md` and the code are the current state. The plan itself is written to be easy to scan; the guidelines below apply to what the plan builds (site UI and copy), not to how the plan is written.

## Decisions already made

| Topic | Decision |
|---|---|
| Scrolling | None. The canvas is fixed to the viewport and colliders must not move relative to the grid. All projects are visible at once as compact chips, no paging. |
| Physics | A chip's interior is a collider, so sand, water and fire respect it. |
| Borders | Each chip is surrounded by a ring of static element tiles (sand rests on it, wood burns, acid dissolves steel, ice melts). Material is chosen per project. |
| Damage | Cosmetic. Lasts until the world rebuilds (reload or resize). |
| Expanding | Two stages: click a chip to open a centered preview panel, then open the detail panel. The chip itself never moves or grows. |
| Content | One typed TS module per project. A chip shows an icon, title, description and three tags. |
| Extras | Plain-HTML view, name and contact made of tiles, tag filter using the elements, portfolio and play modes, structured case studies with video. |

## Guidelines for what gets built

These apply to every visible element and every string the portfolio adds to the site.

**Writing**
- No em-dashes in anything user-facing. Use commas, colons or full stops.
- Avoid punchline one-liners, runs of short sentences ("No X. No Y."), "X is the Y of Z" definitions, and "not just X, but Y" or "not merely".
- Error and empty-state copy states the fact plainly. No "Oh no!" and no emoticons.

**Design**
- Monospace is for real readouts like the perf HUD only. No monospace brand font, and none in project content.
- Pages do not default to numbered step sections or bullet lists.
- Controls do not all share one bordered, rounded, translucent button.
- No stock cards (dark fill, 1px light border, soft shadow, rounded corners) as feature tiles.
- No blinking-dot "live" or status badges.

**This repo**
- The simulation stays the page. Project notes and about text stay free of hero, feature-grid and badge layouts.
- Every new visible element gets its own shape or treatment. Do not reuse `.picker-button` or the dropdown recipe in `main.css`.
- Panel edges come from tiles. No CSS borders, border radius or box shadows to draw panels.

## Chip contents and treatment

- Contents: icon, title, description (at most two lines), three tags.
- Tags are one plain line of words with thin tile-sized separators. No pills or fills, so they read as text and not as badges.
- The chip body has no CSS border or radius. Its edge is the tile ring, and its fill is a flat color from the palette of the ring's material.
- Size is a whole number of tiles, targeting about 160 x 100 CSS px at 4 px tiles. Anything longer than the description lives in the preview and detail views.

## Data (`src/projects/`)

`src/projects/project.ts` defines `Project`:

| Field | Purpose |
|---|---|
| `id` | kebab-case, also the URL hash |
| `title`, `summary`, `order` | chip title, chip description, sort order |
| `tags` | tuple of exactly three |
| `icon` | inline SVG string or imported asset URL |
| `border` | registry element name or type constant |
| `blurb` | preview text |
| `sections` | `{ heading, body }[]` for the detail view |
| `screenshots` | `{ src, alt, caption? }[]`, imported with Vite `?url` |
| `links` | `{ label, href }[]` |
| `role`, `timeline`, `stack`, `outcome` | case-study facts (all required) |
| `video` | optional |

- One file per project: `src/projects/<id>.ts` exports a default `Project`.
- `src/projects/index.ts` collects them with `import.meta.glob(..., { eager: true })` (same pattern as `src/worlds/`), validates (unique ids, exactly three tags, known border material) and sorts by `order`.
- Images live next to the module in `src/projects/<id>/` so Vite hashes and bundles them. Zero runtime dependencies stays true.

## Board and chips (`src/ui/project-board.ts`, `src/ui/project-chip.ts`)

- Layout is measured in tiles. The CSS custom property `--tile` is set from `world.tileSize` (can be fractional). Chip size and gap are `calc(n * var(--tile))`.
- `Overlay.measure` rounds outward, so an off-grid edge leaves a one-cell gap between the DOM and the ring. Tile-aligned layout avoids that.
- Chips are real `<button>` or `<article>` elements with `aria-expanded` and `aria-controls`. Enter and Space expand, Escape collapses.
- Each chip is registered with `Overlay.registerCollider`. The painting code already ignores clicks on overlay children.

## Border ring (engine)

`paintStroke` cannot draw the rings: it is capped at `MAX_STAMPS` per frame and tied to stepping frames, so 20 rings would not fit. Add a dedicated rect-outline path:

- `GpuSimulation.stampFrame(rect, type, thickness)` and `clearFrame(rect, thickness)` (clearing stamps air).
- Rects are uploaded as a small array and rasterized in one dispatch over the union bounding box, in the same pass as `PAINT_WGSL`, before the first step. Touched chunks are marked awake.
- Each cell gets a random variant like a brush stroke, so borders vary in color.
- The ring sits just outside the collider rect. `PAINT_WGSL` skips solid-mask cells, so the ring cannot overlap the interior.
- Overwrite is unconditional, like painting.

## Rebuilding after a grid reset

Resize, `setTileSize` and `loadWorld` clear or replace the grid, erasing every ring. `main.ts` currently repeats `overlay.refreshColliders(); loadDefaultWorld();` in two places. Replace both with one `rebuildWorld()`:

1. Refresh colliders.
2. Re-measure the board layout.
3. Load the default world.
4. Stamp every ring.

Stamping last puts the rings on top of whatever the default world contains.

## Expanding

**Stage 1: preview**
- A click opens a preview panel centered in the viewport. The chip itself does not change, so its collider and ring stay put and neighbors are never displaced.
- The preview shows the `blurb`, the first screenshot and two controls (open detail, close). It is its own collider with its own ring in the project's material, stamped when it opens and cleared when it closes.
- It opens in one frame with no CSS transition, so the collider and ring are correct from the first frame. Sand under its footprint is deleted.
- Only one preview is open at a time. Opening another replaces it. Escape or the close control removes it.

**Stage 2: detail panel**
- Shows the sections, gallery and links.
- The panel uses the same collider and ring treatment as the preview, sized larger and replacing it. Square corners, no shadow, no blur, no dimming layer. The board and world stay visible and running around it. The fill is a flat palette color.
- Deep link: the hash `#/<id>` opens it. Back or `hashchange` closes it. Loading a URL with a hash opens that project after the first rebuild.

## Case-study content

Every project has the same shape so the detail view renders it the same way: a facts row (`role`, `timeline`, `stack`, `outcome`), then the write-up, the gallery and the links.

- The facts row uses the regular sans-serif with light labels, set as running text. No table borders and no monospace.
- `video` is optional: a short muted looping clip (`<video muted loop playsinline preload="none">`, poster = first screenshot, `.webm` and `.mp4` sources).
- Video loads only when the detail view opens, pauses when the tab is hidden, and shows only the poster under `prefers-reduced-motion`.
- Vite bundles clips, so their size counts toward the deploy. A few MB each is the working limit until real content arrives.

## Screenshots

- Chips and the preview use pixelated thumbnails (downscaled to about tile resolution, `image-rendering: pixelated`) to match the grid.
- The detail panel shows full-quality images with `loading="lazy"`, `decoding="async"`, explicit `width` and `height`, and required `alt` text.

## Tag filter

- The tags used across projects are listed as plain words in a free area of the board. Several can be selected, and a project matches when it has any selected tag.
- Each word is a `<button>` with `aria-pressed` and no fill or border. A selected word is underlined.
- Matching chips get a lit ring (a torch or ember tile placed on it). Nothing else changes on non-matching chips. This uses `stampFrame` and `clearFrame`, and clearing the filter restores each chip's own material.
- Filtering overwrites border damage on the matching chips, which is accepted since the visitor asked for it.
- Non-matching chips are untouched, so they stay focusable and clickable.
- The filter is mirrored in the URL as `?tag=webgpu` and read back after the first rebuild.

## Name and contact in the world

- The name and a one-line tagline are stamped into the default world as tiles near the top of the board. Each letter is layered: a stone core with steel edges and wood accents, so partial burning leaves a visible skeleton. They are authored with the Save and Load tooling at 4 px tiles, since worlds resample by tile size.
- An `<h1>` and the tagline stay in the page for accessibility and indexing, visually hidden or placed under the tile lettering.
- This is part of the world and not a hero section: it takes only the space the lettering needs, with no background, call to action or illustration.
- Contact is one line of plain text links under the name: email, GitHub and resume. Each is underlined text with no ring of its own.
- Email copies the address on click and the link text changes to "Copied".
- The line sits outside the centered preview region, so an open preview never covers it.

## Portfolio mode and play mode

| | Portfolio mode (default) | Play mode |
|---|---|---|
| Header | Title, mode control, link to the plain view | Everything above plus the brush picker, element picker, perf button and world menu |
| World | Chips, name and contact | Same, they stay as solid parts of the world |
| Reset world | Available | Available |

- Reset world reloads this visit's default world and re-stamps the rings.
- The mode control is a word that switches between "Play" and "Portfolio", with an underline on the current mode. It does not copy `.picker-button`. Reset world is a text link beside it.
- The choice is saved in `idotdot.preferences`. `loadPreferences` validates the new field and falls back to portfolio mode.
- The first visit shows one line of plain text near the bottom edge: "Drag to pour sand." It disappears on the first paint or click, and a preferences flag records that it was seen.
- Painting outside the UI works in both modes. Only toolbox visibility differs.

## Plain view and SEO

- An ordinary page rendered from the same `Project` modules: identity, one article per project (facts, write-up, screenshots, video, links), then contact links. No canvas, normal scrolling.
- It shows when `navigator.gpu` is missing or device creation fails, on request through a header link, and at `?view=plain`.
- A mid-session device loss keeps the blocking dialog and adds a link to the plain view.
- Dialog copy in `src/ui/gpu-error-dialog.ts` is rewritten to state the fact, and the retry button is renamed:
  - Missing WebGPU: "WebGPU is not available in this browser, so the simulation cannot run."
  - Device lost: "The GPU device was lost."
  - Button: "Reload".
  - The current "Oh no!" text and emoticon are removed.
- At build time the plain view is rendered into the fallback region of `index.html` by a small Vite plugin or post-build script, so crawlers and visitors without JavaScript see real content. The output is generated from the project modules, never a second copy of the content.
- Share previews: `og:title`, `og:description`, `og:image` (a screenshot of the world with the board), `twitter:card`, a canonical URL and a meta description. A project hash link shows the site-level preview, since per-project previews would need separate pages.

## Edge cases

- Window resize: layout is recomputed once per animation frame, as today. Narrow viewports use fewer columns and the detail panel fills the viewport.
- Tile size change from the perf HUD goes through `rebuildWorld()`.
- The board lives in `#overlay`, below the 48 px header.
- Under `prefers-reduced-motion` there are no transitions and video shows its poster.
- Springs, torches and aging borders keep chunks awake as usual. A pool on the board prevents idle, as it does today.
- A burnt wood ring leaves air around the interior. The interior is still a collider, so layout is unaffected.

## Open questions

1. ~~**Grid vs the guidelines.**~~ Resolved: keep the chip grid as decided. The chips' tile rings, per-project materials and physical interaction with the sim are what separate it from a stock feature grid.
2. ~~**Growing a preview.**~~ Resolved: the preview opens centered and the chip does not move. Sand under the preview footprint is deleted (shoving it outward can come later). Verify first that `rebuildSolidMask` plus `wakeAllPending` handle tiles inside newly solid cells (the shaders skip solid cells, but existing tiles there must not linger).
3. **Alignment (verification, not a decision).** At 125% and 150% device pixel ratios `tileSize` is fractional. Check chip edges and ring alignment at several tile sizes when the board is built.
4. ~~**Name and contact.**~~ Resolved: the name is layered strokes (stone core, steel edges, wood accents). Contact links are email, GitHub and resume. No torch on the contact line.
5. ~~**Filter details.**~~ Resolved: matching chips get a lit ring and nothing else changes.
6. ~~**Plain view build.**~~ Resolved: a small Vite plugin in the normal build.
7. ~~**Video.**~~ Resolved: short silent clips of a few MB each, `.webm` plus `.mp4`.
8. ~~**Icons.**~~ Resolved: inline SVG strings in each project module, pixelated with CSS.

## Build order

1. `Project` type, loader with validation, three placeholder projects.
2. Plain view and case-study fields (depend only on the data, so they can start before the default-worlds work lands).
3. `stampFrame` / `clearFrame` and the `rebuildWorld()` refactor in `main.ts`. Wait for the default-worlds work, since both touch `main.ts` and the rebuild path.
4. Board with chips, colliders, rings and keyboard support.
5. Centered preview panel open and close.
6. Detail panel with gallery, deep link and video.
7. Tag filter.
8. Name and contact line.
9. Mode toggle, Reset world and first-visit hint.
10. Real content, icons and screenshots, then tuning of materials and spacing.
