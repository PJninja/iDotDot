# Portfolio content

Goal: list 10-20 projects as cards that live inside the falling-sands world instead of on top of it. Each card expands to a preview and then to a detail view with text and screenshots. This file is intent; `AGENTS.md` and the code are the current state.

## Decisions already made

- The page does not scroll. The canvas is fixed to the viewport and colliders must not move relative to the grid, so all projects are visible at once as compact chips with no paging.
- A chip's interior is a collider, so sand, water and fire respect it.
- Each chip is surrounded by a ring of static element tiles. Sand rests on it, wood burns, acid dissolves steel and ice melts. The material is chosen per project.
- Damage to a ring is cosmetic and lasts until the world rebuilds, which a reload or a resize does.
- Expanding goes in two stages: chip, grown preview, detail panel.
- Each project is one typed TS module, and the chip shows an icon, title, description and three tags.
- The plan adds a plain-HTML view, a name and contact line made of tiles, tag filtering with the elements, a portfolio mode and a play mode, and structured case-study content with video. Each has its own section below.

## Guidelines for this work

These apply to every visible element and every string the portfolio adds.

Writing: no em-dashes in anything user-facing, so use commas, colons or full stops. Avoid punchline one-liners, runs of short sentences, "X is the Y of Z" definitions, and "not just X but Y" constructions. Error and empty-state copy states the fact plainly, without "Oh no!" or emoticons.

Design: monospace is for real readouts such as the perf HUD, never for project content or branding, so the portfolio uses the site's existing sans-serif. Pages do not default to numbered step sections or bullet lists. No control copies another's bordered, rounded, translucent button, and no panel is a stock card (dark fill, 1px light border, soft shadow, rounded corners). There are no blinking-dot or status badges.

This repo: the simulation stays the page. Project notes and about text are kept free of hero, feature-grid and badge layouts. Any new visible element gets its own shape or treatment and does not reuse `.picker-button` or the dropdown recipe in `main.css`. Edges come from tiles, so CSS borders, border radius and box shadows are not used to draw panels.

## Chip contents and treatment

A chip shows an icon, the title, a description of at most two lines and three tags. The tags are a single plain line of words separated by spaces and a thin tile-sized separator, with no pill shapes or fills, so they read as text and not as badges. The chip body has no CSS border or radius: its edge is the tile ring, and its fill is a flat color from the palette of the ring's material.

Size is a whole number of tiles, with a target near 160 x 100 CSS px at 4 px tiles. Anything longer than the description lives in the preview and detail views.

## Data (`src/projects/`)

`src/projects/project.ts` defines the `Project` type:

- `id` (kebab-case, also the URL hash), `title`, `summary` (the chip description), `tags` (tuple of three), `icon` (inline SVG string or imported asset URL), `border` (registry element name or type constant), `order`.
- `blurb` for the preview, `sections` (`{ heading, body }[]`), `screenshots` (`{ src, alt, caption? }[]` imported with Vite `?url`), `links` (`{ label, href }[]`).
- Case-study fields: `role`, `timeline`, `stack` (string[]), `outcome`, and an optional `video`.

Each project is `src/projects/<id>.ts` exporting a default `Project`, and `src/projects/index.ts` collects them with `import.meta.glob(..., { eager: true })`, the same pattern as `src/worlds/`. The loader checks for unique ids, exactly three tags and a known border material, then sorts by `order`. Images live next to the module in `src/projects/<id>/` so Vite hashes and bundles them, which keeps the zero-runtime-dependency rule.

## Cards (`src/ui/project-chip.ts`, `src/ui/project-board.ts`)

The board lays chips out on a grid measured in tiles. The CSS custom property `--tile` is set from `world.tileSize`, which can be fractional, and chip size and gap are `calc(n * var(--tile))`. `Overlay.measure` rounds outward, so an off-grid edge would leave a one-cell gap between the DOM and the ring, and tile-aligned layout avoids that.

Chips are real `<button>` or `<article>` elements with `aria-expanded` and `aria-controls`. Enter and Space expand, Escape collapses. Content is HTML and the simulation is a backdrop for it. Each chip is registered with `Overlay.registerCollider`, and the existing painting code already ignores clicks on overlay children.

## Border ring (engine)

Painting rings through `paintStroke` does not work: it is capped at `MAX_STAMPS` per frame and tied to stepping frames, so 20 rings would not fit. The engine gets a dedicated rect-outline path:

- `GpuSimulation.stampFrame(rect, type, thickness)` and `clearFrame(rect, thickness)`, where clearing stamps air.
- Rects are uploaded as a small array and rasterized in one dispatch over the union bounding box, in the same pass as `PAINT_WGSL` before the first step, marking touched chunks awake. Each cell gets a random variant like a brush stroke, so borders vary in color.
- The ring sits just outside the collider rect. `PAINT_WGSL` skips solid-mask cells, so the ring cannot overlap the interior.
- Overwrite is unconditional, like painting.

## Rebuilding after a grid reset

Resize, `setTileSize` and `loadWorld` clear or replace the grid, which erases every ring. `main.ts` repeats `overlay.refreshColliders(); loadDefaultWorld();` in two places. Both become one `rebuildWorld()`: refresh colliders, re-measure the board, load the default world, then stamp every ring. Stamping last guarantees the rings sit on top of whatever the default world contains.

## Expanding

A click on a chip grows it into a preview of about two by two chips, showing the `blurb`, the first screenshot and two controls, one for the detail view and one to close. The old ring is cleared, the DOM rect changes, and the new ring is stamped, all in one frame with no CSS transition, so the collider and the ring are correct from the first frame. Only one chip is in the preview state at a time, and collapsing reverses the steps.

The detail control opens a large panel with the sections, a gallery and the links. The panel is its own collider with its own ring in the project's material. It has square corners, no shadow, no blur and no dimming layer, so the rest of the board and the world stay visible and running around it. Its fill is a flat palette color. The URL hash `#/<id>` opens it, and Back or `hashchange` closes it. Loading a URL with a hash opens that project after the first rebuild.

## Case-study content

Every project has the same shape so the detail view can render it the same way: a facts row (`role`, `timeline`, `stack`, `outcome`) with all four required and checked by the loader, then the write-up, the gallery and the links.

`video` is optional: a short muted looping clip (`<video muted loop playsinline preload="none">`, poster set to the first screenshot, `.webm` and `.mp4` sources). It loads only when the detail view opens, pauses when the tab is hidden, and under `prefers-reduced-motion` shows the poster only. Vite bundles the clips, so their size counts toward the deploy, and a few MB each is the working limit until real content arrives.

The facts row uses the regular sans-serif with light labels. It is set as running text, with no table borders and no monospace.

## Screenshots

Chips and the preview show pixelated thumbnails, downscaled to about tile resolution and drawn with `image-rendering: pixelated`, so they match the grid. The detail panel shows full-quality images with `loading="lazy"`, `decoding="async"`, explicit `width` and `height`, and required `alt` text.

## Tag filter

With 10-20 chips, visitors need a way to narrow them. The tags that appear across projects are listed as plain words in a free area of the board. Selecting a word underlines it and applies the filter, and several words can be selected at once. A project matches when it has any selected tag, and the words are `<button>`s with `aria-pressed` that carry no fill or border of their own.

Matching chips get a lit ring, with a torch or ember tile placed on it. Non-matching chips get an ice ring and dimmed text. Both use `stampFrame` and `clearFrame`, and clearing the filter restores each chip's own material. Filtering overwrites border damage on the chips it touches, which is accepted because the visitor asked for it. Non-matching chips stay focusable and clickable. The filter is mirrored in the URL as `?tag=webgpu` and read back after the first rebuild.

## Name and contact in the world

The name and a one-line tagline are stamped into the default world as tiles, in stone or wood, near the top of the board. They are authored with the Save and Load tooling like the other default worlds, and since worlds resample by tile size, they are authored at 4 px tiles. An `<h1>` and the tagline stay in the page for accessibility and indexing, visually hidden or placed under the tile lettering. This is part of the world and not a hero section: it takes no more space than the lettering needs and has no background, call to action or illustration.

Contact is a single line of plain text links under the name: email (a click copies the address and the link text changes to "Copied"), GitHub, resume, and any others. Each link is underlined text with no ring of its own. The main contact link has a permanent torch tile beside it so it is the one lit thing on the board. The line's position is reserved in the board layout so a grown preview never covers it.

## Portfolio mode and play mode

Portfolio mode is the default. The header shows the title, a mode control and a link to the plain view, and the brush picker, element picker, perf button and world menu are hidden. Play mode shows the full existing toolbox, and the chips and contact line stay in place since they are solid parts of the world. A Reset world control reloads this visit's default world and re-stamps the rings, and it is available in both modes.

The mode control is a text word that switches between "Play" and "Portfolio", with an underline for the current mode. It does not copy `.picker-button`. Reset world is a text link beside it. The choice is remembered in `idotdot.preferences`, where `loadPreferences` validates the new field and falls back to portfolio mode.

The first visit shows one line of plain text near the bottom edge reading "Drag to pour sand." It disappears on the first paint or click, and a flag in preferences records that it was seen. Painting outside UI works in both modes, and only the toolbox visibility differs.

## Plain view and SEO

The plain view is an ordinary page rendered from the same `Project` modules: identity, one article per project with its facts, write-up, screenshots, video and links, then the contact links. It has no canvas and scrolls normally.

It shows when `navigator.gpu` is missing or device creation fails, on request through a link in the header, and at `?view=plain`. A mid-session device loss keeps the blocking dialog and adds a link to the plain view. The dialog copy in `src/ui/gpu-error-dialog.ts` is rewritten to state the fact: "WebGPU is not available in this browser, so the simulation cannot run." for the first case and "The GPU device was lost." for the second, with the retry button labelled "Reload". The current "Oh no!" text and the emoticon are removed.

At build time the plain view is rendered into the fallback region of `index.html` by a small Vite plugin or post-build script, so crawlers and visitors without JavaScript see real content with no runtime dependency. The output comes from the project modules and never from a second copy of the content. Share previews use `og:title`, `og:description`, `og:image` (a screenshot of the world with the board), `twitter:card`, a canonical URL and a meta description. A project hash link shows the site-level preview, since per-project previews would need separate pages.

## Edge cases

- On a window resize the layout is recomputed once per animation frame, as today. Narrow viewports use fewer columns and the detail panel fills the viewport.
- A tile size change from the perf HUD goes through `rebuildWorld()`.
- The board lives in `#overlay`, below the 48 px header.
- Under `prefers-reduced-motion` there are no transitions, and video shows its poster.
- Springs, torches and aging borders keep chunks awake as usual, and a pool on the board prevents idle as it does today.
- A burnt wood ring leaves air around the interior, which is still a collider, so layout is unaffected.

## Open questions

**Grid versus the guidelines.** The earlier decision was a grid of compact chips, and the guidelines ask for no feature-grid layouts. A uniform grid of equal cards with an icon, title, text and tags is that layout. Options are to keep the grid but vary chip widths with their content and stagger the rows, to place chips on tile ledges at different heights so sand piles on shelves, or to keep the plain grid. This needs a decision before the board is built.

**Growing a preview.** The sim's behavior when a collider grows over existing sand is unverified, so the shaders need reading first: `rebuildSolidMask` and `wakeAllPending` wake the chunks, but tiles inside newly solid cells must be cleared or displaced. Deleting is simplest and shoving them outward looks better. Where a preview goes when its neighbors are adjacent is also undecided.

**Alignment.** At 125% and 150% device pixel ratios `tileSize` is fractional, and chip edges and ring alignment need checking at several tile sizes. The icon format (inline SVG or imported asset) affects how it pixelates.

**Name and contact.** The name could be wood, which visitors can burn, or stone. The contact links and the one that gets the torch are not chosen.

**Filter details.** Whether non-matching chips use ice or only dimmed text is open, and ice melts next to the lit rings of neighbors.

**Plain view build.** A Vite plugin versus a post-build script, and whether the fallback markup and the live app share templates.

**Video.** The size budget, the formats, and whether `preload="none"` is enough on slow connections.

## Build order

The data model comes first: the `Project` type, the loader with validation and three placeholder projects. The plain view and the case-study fields only depend on that data and can start before the default-worlds work lands. The engine work follows, with `stampFrame` and `clearFrame` and the `rebuildWorld()` refactor in `main.ts`, which should wait for the default-worlds work because both touch `main.ts` and the rebuild path. After that come the board with chips, colliders, rings and keyboard support, then the preview, and then the detail panel with the gallery, deep link and video. The tag filter, the name and contact line, and the mode toggle with Reset world and the hint come next, in whatever order is convenient. Real content, icons and screenshots, and tuning of materials and spacing, come last.
