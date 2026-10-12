# Board in the world

Goal: the chips stop floating over whichever part of the world happens to be at the top of the window. They sit underground in a fixed place in each world, with the underground scenery built around them, and the title block shrinks to the header. Status: proposal, all open questions answered. `AGENTS.md` and the code are the current state; `plans/portfolio.md` is the plan this revises.

The layout is checked in a static reconstruction (the real DOM, `.idw` worlds and tile-art on a 2D canvas), because the simulation itself could not run where this was written. Row numbers below are world rows (640 x 348 cells, 4 px tiles, anchored bottom-center like every world).

## Decisions made

| Topic | Decision |
|---|---|
| Name | Stays in the header ("iDotDot by Anthony Liparulo"). The tile lettering is removed from the board. |
| Tagline | Removed everywhere: the board, `SITE`, the meta description and the plain view. |
| Contact | Moves out of the board into a header dropdown (Email, GitHub, Resume). |
| Chip contents | Unchanged: icon, title, summary, three tags. |
| Placement | Anchored like the world itself (same bottom-center rule as `fitWorld`), underground, with the underground scenery weaving between the chips. |
| Count | Designed for 3 to 6 projects, with pages and a filter/search for more. This replaces "no paging, everything visible" in `portfolio.md`. |
| Filter | The list is filtered and paged. Matching chips keep their lit rings (torches). Search matches title, summary and tags only. |
| Page size | Two rows of 3 (6 chips per page). |
| Minimum window | 600 px canvas (about 650 px of page height). Shorter windows get the plain page. |
| Pockets under the block (2, 3, 4) | Not needed for the chips. Each world's theme decides per pocket: narrowed to the side, a short cellar below the block, or removed. |
| Narrow windows | Under about 800 px wide, a single column of chips over the world, not the plain page. |

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

Today the ground starts at row 158, soil is 12 rows, and the six shared pockets (`tools/worlds/underground.ts`) start at rows 200 to 245. The free rock between the soil and the pocket tops is about 30 rows, one row short of a single chip (interior 50 x 27 cells plus a 2-cell ring = 54 x 31). A page of 6 is two rows of three: 182 x 70 cells with 10-cell gaps between chips (room for pipes and shafts) and 8 rows between the rows.

A 600 px canvas shows world rows 198 to 348, so everything the board needs has to fit in 150 rows:

| Part | Rows |
|---|---|
| Chip row 1 (ring included) | 202 to 233 |
| Chip row 2 | 241 to 272 |
| Gallery: a lined corridor holding the filter, tag words and pager, one line of text | 276 to 288 |
| What is left under the block (columns 229 to 411) | 292 to 337, about 45 rows: short cellars or rock |
| Pockets 1, 4, 5, 6 (outside the block, or tall enough already) | unchanged |

Three pockets overlap the block's footprint (columns 229 to 411, rows 202 to 288): pocket 2 (columns 156 to 262) on its left edge, pocket 3 (272 to 348) fully under it, and pocket 4 (366 to 468, top at row 245) on its right edge. Squeezing their rooms into 45 rows would waste them, so each world's theme picks per pocket: narrow it to the side of the block (pocket 2 to columns 156 to 224 and pocket 4 to 420 to 468 keep their full height), drop it below the block as a short cellar, or remove it and leave rock.

The block is centered in the world (columns 229 to 411), so a 1280 px window (columns 160 to 480) shows it with about 70 columns of scenery on each side. The narrowed pockets 2 and 4 and the edges of 1 and 5 are the neighbors that stay visible.

### Narrow layout

Under about 800 px wide, a window shows fewer than 200 columns (a phone about 100) and the 3-wide block does not fit. Each world also authors a second slot list: one column of chips stacked in the middle of the block (columns 293 to 347, rows 202 to 303 for three chips) with the gallery under it (rows 307 to 319, search and pager only, tag words hidden). The page size is the number of slots in the active list. Both layouts share the centre strip, so that strip is plain rock and no scenery runs through it. In narrow mode the weave between chips is not visible; the scenery at the sides is.

## How it works

1. **The world carries its board.** Each scene script reserves the slots with a new kit call (`g.slots([...])`) and writes `<world>.board.json` beside the `.idw` (for each of the wide and narrow layouts: slot rectangles in world cells and the gallery rectangle; the page size is the slot count). `pickDefaultWorld()` returns the snapshot and the board data together. The `.idw` format and saved player worlds stay as they are.
2. **One mapping from world cells to grid cells.** Pull the offset and scale math out of `fitWorld` into `worldToGrid(...)`, used by the world loader and by `Board.place()`. Slot edges round inward to whole cells, so chips land on cell edges at every tile size. Chips are DOM elements sized from the mapped slot, so 4 px worlds look identical and other tile sizes resample consistently.
3. **Board becomes slot based.** It keeps one chip element per slot, reuses them across pages, hides unused ones, and stamps each slot's ring through `stampCells` as now. An empty slot is restored from the loaded world's own cells, and a page change restamps only the slots that change. A page, search or tag change rewrites ring boxes only; the stamp clears interiors as today.
4. **Pager, search and tag words live in the gallery corridor.** The corridor is authored in the scene (brick lining, a steel rail along the floor), so the cleared rectangle under the text looks built, not punched. Pager is two text words with "2 / 3" between them. Search matches title, summary and tags. Search is a field with only an underline, not a bordered box. Tag words show the tags shared by two or more projects; the rest are reachable through search. State is mirrored in the URL: `?page=`, `?q=`, `?tag=`.
5. **Header changes.** Contact becomes a text word that opens a small panel (Email copies the address and says "Copied", GitHub, Resume). Panel edges are stepped tiles like the project window, closes on Escape or outside click, `aria-expanded`, not a collider. It does not reuse `.picker-button` or the dropdown recipe.
6. **Removed.** `stampLettering`, the tagline row, `SITE.tagline` (and its use in the meta description, the plain view and `index.html`), and `textMask` / `letterCells` / `fitRows` in `tile-art.ts` once nothing uses them. The h1 stays visually hidden with the name only.
7. **Window size.** A canvas under 600 px tall gets the existing plain page. Between 600 px tall and about 800 px wide the narrow slot list is used; wider windows use the wide list. A resize across the threshold is a normal world rebuild.

## Weaving the underground between the chips

Each gap between chips (10 cells) and the strip above them carry scenery that connects the rooms on either side. Rules so the scenery does not wreck rings, since ring material is chosen per project and unknown to the scene:

- Everything within 2 cells of a ring is stone, dirt or air. No water, fire, torches, acid, hot steel, ice or steel there. A check in `make-worlds` fails if the reserved boxes (ring plus 2 cells) hold anything else.
- Shafts are walled with stone as `shaft()` already does, so loose material cannot slump into a slot.
- Liquids and heat run in pipes that stay outside that margin.

Per world:

| World | Weave |
|---|---|
| Alchemist's Lab | Glass and steel pipework from the distillery runs down the gaps and under the block; a brick arch frames each slot. Pockets 2 and 3 (cold store, vault) become one short cold cellar, or move into pocket 4's space. |
| Farmstead | Roots, an ore seam and a mine shaft with a ladder and lantern between chips, a seep draining toward the cistern. The cellar space is left as a root cellar or plain rock. |
| Death Machine | The coal chute and steam stacks drop through the gaps; the methane spine stays beside, not between, two chips. The furnace hall and coolant hall (pockets 2 and 3) can be dropped; the chip block reads as the control gantry. |

## Build order

1. Header: contact dropdown, drop lettering and tagline from the board. Chips stay where they are for now. Small and independent.
2. `worldToGrid` extraction, `<world>.board.json`, the kit's `slots()` and the overlap check in `make-worlds`; loader returns both.
3. Slot-based `Board` with pages, search and tag words; plain-page fallback thresholds.
4. Scene rework, one world at a time: shrink or remove pockets 2 and 3 as the theme allows, author both slot lists, draw the corridor, arches and weave, regenerate with `npm run worlds`. Render each with the static preview and with a short run in a WebGPU browser to make sure nothing spills into a slot.
5. Check at 1280 x 650, 1440 x 800, 1920 x 1000, a 390 x 844 phone and the tile sizes 2, 4 and 8; update `AGENTS.md` (Portfolio and World files sections) and mark this plan as built.

## Open questions

None. The five questions raised earlier are answered in the decisions table.
