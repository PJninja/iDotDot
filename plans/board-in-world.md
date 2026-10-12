# Board in the world

Goal: the chips stop floating over whichever part of the world happens to be at the top of the window. They sit underground in a fixed place in each world, with the underground scenery built around them, and the title block shrinks to the header. Status: proposal. `AGENTS.md` and the code are the current state; `plans/portfolio.md` is the plan this revises.

The layout is checked in a static reconstruction (the real DOM, `.idw` worlds and tile-art on a 2D canvas), because the simulation itself could not run where this was written. Row numbers below are world rows (640 x 348 cells, 4 px tiles, anchored bottom-center like every world).

## Decisions made

| Topic | Decision |
|---|---|
| Name | Stays in the header ("iDotDot by Anthony Liparulo"). The tile lettering is removed from the board. |
| Tagline | Removed from the board. |
| Contact | Moves out of the board into a header dropdown (Email, GitHub, Resume). |
| Chip contents | Unchanged: icon, title, summary, three tags. |
| Placement | Anchored like the world itself (same bottom-center rule as `fitWorld`), underground, with the underground scenery weaving between the chips. |
| Count | Designed for 3 to 6 projects, with pages and a filter/search for more. This replaces "no paging, everything visible" in `portfolio.md`. |
| Filter | The list is filtered and paged. Matching chips keep their lit rings (torches). |

## What the current layout costs

At 1440 x 900 only the bottom 213 rows of the world show, so the ground sits at about y = 140 and the chips (y = 228 to 336) end up inside the rock. At 1080 p the ground is at about y = 320 and the chips hover at the horizon. The result depends on the window height, which is why the review called the board and world unrelated. Anchoring both to the bottom removes the dependency: a cell of rock stays the same cell of rock at every height.

Visible world rows by canvas height (canvas = window height minus the 48 px header):

| Canvas height | Rows shown | First world row shown |
|---|---|---|
| 600 px | 150 | 198 |
| 704 px | 176 | 172 |
| 780 px | 195 | 153 |
| 850 px | 213 | 135 |

Width works the same way: a 1280 px window shows 320 of the 640 columns, columns 160 to 480.

## Space underground

Today the ground starts at row 158, soil is 12 rows, and the six shared pockets (`tools/worlds/underground.ts`) start at rows 200 to 245. The free rock between the soil and the pocket tops is about 30 rows, one row short of a chip (interior 50 x 27 cells plus a 2-cell ring = 54 x 31).

| Page size | Block size | What it costs |
|---|---|---|
| 3 chips, one row (recommended for launch) | 182 x 31 cells (gaps of 10 cells hold pipes and shafts) | Pockets 2 and 3 lose 30 to 50 rows of height, depending on the minimum window |
| 6 chips, two rows of three | 182 x 70 cells | Pockets 2 and 3 shrink to about 85 rows; most of both rooms is redrawn |

A one-row page still serves 6 projects as two pages. The slot list is data per world, so a world can offer 6 slots later when its author makes room. The rest of this plan assumes a one-row block unless noted.

Proposed rows for a minimum canvas of 600 px (first visible row 198):

| Part | Rows |
|---|---|
| Chip row (ring included) | 202 to 233 |
| Gallery: a lined corridor holding the filter, tag words and pager, one line of text | 237 to 249 |
| Pockets 2 and 3 (columns 156 to 348) | 254 to 337 |
| Pockets 1, 4, 5, 6 | unchanged |

If the minimum canvas is 700 px instead, the block moves up to about row 178 and the pockets keep about 110 rows. That is the main trade, listed under open questions.

## How it works

1. **The world carries its board.** Each scene script reserves the slots with a new kit call (`g.slots([...])`) and writes `<world>.board.json` beside the `.idw` (slot rectangles in world cells, the gallery rectangle, page size). `pickDefaultWorld()` returns the snapshot and the board data together. The `.idw` format and saved player worlds stay as they are.
2. **One mapping from world cells to grid cells.** Pull the offset and scale math out of `fitWorld` into `worldToGrid(...)`, used by the world loader and by `Board.place()`. Slot edges round inward to whole cells, so chips land on cell edges at every tile size. Chips are DOM elements sized from the mapped slot, so 4 px worlds look identical and other tile sizes resample consistently.
3. **Board becomes slot based.** It keeps one chip element per slot, reuses them across pages, hides unused ones, and stamps each slot's ring through `stampCells` as now. An empty slot is restored from the loaded world's own cells, and a page change restamps only the slots that change. A page, search or tag change rewrites ring boxes only; the stamp clears interiors as today.
4. **Pager, search and tag words live in the gallery corridor.** The corridor is authored in the scene (brick lining, a steel rail along the floor), so the cleared rectangle under the text looks built, not punched. Pager is two text words with "2 / 3" between them. Search is a field with only an underline, not a bordered box. Tag words show the tags shared by two or more projects; the rest are reachable through search. State is mirrored in the URL: `?page=`, `?q=`, `?tag=`.
5. **Header changes.** Contact becomes a text word that opens a small panel (Email copies the address and says "Copied", GitHub, Resume). Panel edges are stepped tiles like the project window, closes on Escape or outside click, `aria-expanded`, not a collider. It does not reuse `.picker-button` or the dropdown recipe.
6. **Removed.** `stampLettering`, the tagline row, and `textMask` / `letterCells` / `fitRows` in `tile-art.ts` once nothing uses them. The h1 stays visually hidden with the name only.
7. **Windows that cannot show the block** (canvas under the minimum height, or narrower than the block plus margins, about 800 px) get the existing plain page. This includes phones, which today get a single column of chips.

## Weaving the underground between the chips

Each gap between chips (10 cells) and the strip above them carry scenery that connects the rooms on either side. Rules so the scenery does not wreck rings, since ring material is chosen per project and unknown to the scene:

- Everything within 2 cells of a ring is stone, dirt or air. No water, fire, torches, acid, hot steel, ice or steel there. A check in `make-worlds` fails if the reserved boxes (ring plus 2 cells) hold anything else.
- Shafts are walled with stone as `shaft()` already does, so loose material cannot slump into a slot.
- Liquids and heat run in pipes that stay outside that margin.

Per world:

| World | Weave |
|---|---|
| Alchemist's Lab | Glass and steel pipework from the distillery runs down the gaps to the cold store and vault; a brick arch frames each slot. |
| Farmstead | Roots, an ore seam and a mine shaft with a ladder and lantern between chips, a seep draining toward the cistern. |
| Death Machine | The coal chute and steam stacks drop through the gaps; the methane spine stays beside, not between, two chips. |

## Build order

1. Header: contact dropdown, drop lettering and tagline from the board. Chips stay where they are for now. Small and independent.
2. `worldToGrid` extraction, `<world>.board.json`, the kit's `slots()` and the overlap check in `make-worlds`; loader returns both.
3. Slot-based `Board` with pages, search and tag words; plain-page fallback thresholds.
4. Scene rework, one world at a time: resize pockets 2 and 3, draw the corridor, arches and weave, regenerate with `npm run worlds`. Render each with the static preview and with a short run in a WebGPU browser to make sure nothing spills into a slot.
5. Check at 1280 x 650, 1440 x 800, 1920 x 1000 and the tile sizes 2, 4 and 8; update `AGENTS.md` (Portfolio and World files sections) and mark this plan as built.

## Open questions

1. **Minimum window.** 600 px canvas (laptops) costs about 50 rows of pocket height; 700 px costs about 30. Which should the layout design for?
2. **Page size.** One row of 3 (recommended) or two rows of 3 per page?
3. **Tagline elsewhere.** Keep it in the meta description and plain view, or drop it everywhere?
4. **Phones.** Plain page below about 800 px wide, or keep a single column of chips over a cropped world?
5. **Search matches.** Title, summary and tags only, or the case-study text too?
