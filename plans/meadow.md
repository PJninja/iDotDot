# Meadow: the primary default world

Goal: a fourth shipped world, and the one every visit opens on, mostly underground with a small natural surface (a meadow and a small lake), rabbit burrows, a few buried finds and one buried chest, built so the portfolio chips are the easiest thing on the screen to find. It keeps enough of the sandbox to play with: water, soil that collapses when dug, things that burn, a gas pocket. Status: built (see As built at the end). Row and column numbers are world cells (640 x 348 at 4 px, anchored bottom-center like every world).

## What makes the chips hard to see today

In the three current worlds the chips hang in a hall only 2 cells wider than the block (`HALL_MARGIN`), lined with stone bricks that are close in color to the stone and steel rings. A pipe runs along the strip between the chip rows, and the pockets on either side hold fire, water, acid and electricity, which move and draw the eye away from the board. The board is in the right place; the problem is the frame around it.

## Layout

| Band | Rows | Contents |
|---|---|---|
| Sky | 0 to about 125 | Empty sky with a few stars (ice dots, as in the farmstead). |
| Surface | about 126 to 132 | A low rolling meadow (grass on dirt), the lake, burrow mouths with dirt mounds, two or three rabbits. No buildings. |
| Topsoil and warren | 132 to about 185 | A thick dirt band held up by root mats; the rabbit warren runs through it, directly above the board. |
| Rock | 185 to 347 | Stone with the board cavern in the middle and the buried finds to the sides. |

The surface sits about 26 rows higher than in the other worlds (`SURFACE` 158 there), so there is more underground above the board and the surface stays a thin strip:

| Canvas height | First row shown | What of the surface shows |
|---|---|---|
| 600 px | 198 | none; only the board and the rock beside it |
| 852 px (900 px window) | 135 | the burrow mouths and the warren |
| 1032 px (1080p) | 90 | about 35 rows of sky, the meadow, the lake |
| 1392 px (1440p) | 0 | the whole world |

A 1280 px window shows columns 160 to 480, a 1920 px window 80 to 560 and a phone about 270 to 370, so the warren sits over columns 200 to 440 and the lake and the finds within 90 to 550.

## The board frame (the point of this world)

- **A wide natural cavern instead of the brick hall.** Open air from about 8 cells left and right of the block, 4 above it (row 198, the first row a 600 px canvas shows) and down past the gallery. Its wall is rough stone with an irregular edge (noise on the outline, never closer than the margin). The chips then read as four lit panels on one dark field, at every layout.
- **No pipe in the row strip.** The strip between the chip rows stays air, so each chip has dark space on all four sides.
- **A quiet zone.** Nothing that moves or acts on its own within 16 cells of the cavern (stricter than the 2-cell `KEEP_OUT_CELLS`): only stone, dirt, roots and a little scree. The cavern floor gets a few rubble and sand drifts well clear of the rings.
- **The gallery as a stone ledge.** The corridor keeps its air interior (the check needs it) but is lined with plain stone, not bricks, and has no steel rail (`galleryCorridor(g, T.STONE, false)`).
- **Nothing above the cavern that can fall or flow into it.** The warren above it is dry, the lake is off to the east over solid rock, and the gas pocket is at the far west.

## The surface

- **Meadow:** grass on dirt with a gentle rise at both ends, a few taller grass tufts.
- **Lake** (about columns 450 to 520, 10 rows deep at the middle): water on a mud bed over a stone basin, with wet-sand beaches. The beach is wet sand and the bed mud because dry sand and dirt next to water soak it up and turn into wet sand or mud, so the lake would shrink and its shore would turn to mud. Grass is kept a few cells back from the water, since grass touching water turns back into mud. There is no spring: a spring floods forever unless it has a drain.
- **Burrow mouths:** three holes in the meadow over the warren, each with a dirt mound beside it.
- **Rabbits:** small sprites like the farmstead sheep: an ash body resting on a wood plate, wood legs, a charcoal eye. One or two on the meadow, more in the nests below.

## The warren

Dirt is a falling powder, so a tunnel dug in dirt collapses: a ceiling with air under it falls, and a dirt wall over open air slumps to 45 degrees. The warren is built to stand:

- **Root mats as ceilings.** Each tunnel and chamber has a continuous ceiling of wood roots, 1 to 2 cells thick and wavy, hanging from the meadow's root system (as in the farmstead's orchard roots). This is the natural reason a burrow does not cave in.
- **Sloped tunnels, bowl-shaped chambers.** Passages run at 45 degrees or flatter with dirt floors; chambers have bowl floors, so no dirt face is steeper than it can hold.
- **Nests:** chambers lined with grass bedding, with a rabbit in each and a kit or two.

Fallback if the root mats look too regular: dig the warren into a stone layer under thin topsoil instead (stable, but it reads as a cave, not as a burrow).

Digging into it with the Air brush makes the soil above slump into the tunnels, which is part of the fun.

## Buried finds (rock to the sides of the cavern)

All natural, each one something to play with:

| Find | Where | What it does |
|---|---|---|
| Fossil | West rock, about columns 120 to 170, rows 230 to 260 | A skeleton of ash sealed in a stone cavity. Open the cavity and it crumbles. |
| Coal seam | West rock, a slanted band | Charcoal: a fire set in it smolders along the seam. |
| Peat bog and gas pocket | Far west, columns 20 to 90, just under the surface | Mud over a sealed methane pocket. A spark or flame sets it off; it is far enough from the board (60+ columns) that the blast cannot reach the rings. |
| Buried log | East, under the meadow | A wood log half turned to mold, rotting to dirt over about 30 s after the world loads. |
| Buried chest (the one man-made object) | East rock, about columns 520 to 545, rows 215 to 230, outside the quiet zone | A wooden chest with steel bands and corner plates, its lid slightly ajar, in a small air pocket; a heap of copper coins inside and spilling a little out of the lid. Copper and steel are inert unless a pulse reaches them, and nothing here makes one. Wood burns, so a fire reaching it leaves the bands and coins standing. |
| Geode | East rock, about columns 470 to 520 | A stone shell lined with ice crystals. |
| Aquifer | East rock, under the lake, sealed in stone | A water lens. Dig into it and it drains down through the rock (toward the cavern if you dig that way). |
| Sand lens | Here and there in the rock | Falls when undermined. |

Elements used: air, dirt, grass, stone, sand, wet sand, mud, water, wood, charcoal, ash, rubble, ice, methane, mold, plus steel and copper for the chest (17). This is a deliberate break from the "25+ types per world" convention of the other three: no bombs, torches, springs, acid or electricity.

## Code changes

- **`tools/worlds/meadow.ts`**: the scene script (`buildMeadow`, its own `surface()`, and `ROOMS` exports for the warren, the bog and the finds so `make-rooms.ts` can render and simulate each one alone).
- **`tools/make-worlds.ts`**: register `meadow`. It writes `src/worlds/meadow.idw`.
- **`tools/worlds/underground.ts`**:
  - a `naturalCavern(g, margin, rough)` beside `boardHall`;
  - `finishBoard` takes options for a bigger hall bounds (the leak check uses `BLOCK` plus `HALL_MARGIN` today, which a wider cavern fails) and a quiet radius (scan for `ACTIVE_TYPES` within N cells of the cavern, not only of each ring).
  - The other worlds keep their defaults.
- **`src/worlds/index.ts`**: `pickDefaultWorld` opens on `meadow` (a `PRIMARY_WORLD` constant) instead of a random world; `?world=<name>` still overrides it, and a missing or broken meadow file falls back to the random pick. Next preset cycles in file-name order from there: meadow, alchemist-lab, death-machine, farmstead. Update the doc comment and the AGENTS.md line that says the choice is random.
- **Optional and separate:** a darker fill or a thicker ring for chips in every world, if the cavern alone is not enough.

## Build order

1. `naturalCavern` and the `finishBoard` options, with the board block and gallery only, in an otherwise solid world. Generate it and compare a 1280 x 650 screenshot against the farmstead's for how easy the chips are to pick out.
2. Terrain, meadow and lake. Run the lake alone (`make-rooms.ts`) until its level holds and no mud spreads.
3. The warren. Run it alone at full speed for a few minutes to check nothing collapses into the tunnels.
4. The finds and the bog; run the bog's methane pocket once to see the blast stays well clear of the cavern.
5. The whole world in a WebGPU browser at 1280 x 650, 1440 x 800, 1920 x 1000, a 390 x 844 phone and tile sizes 2, 4 and 8. Check how long it takes to go idle (only the lake surface should keep chunks awake once the mold is gone).
6. Make meadow the primary world in `src/worlds/index.ts`.
7. `npm run worlds`, AGENTS.md (World files section: the fourth world as the primary one, the cavern and the quiet zone). `npm run elements` is not affected.

## Decisions

| Topic | Decision |
|---|---|
| Name | `meadow` (file `meadow.idw`, `?world=meadow`) |
| Man-made objects | One: the buried chest. Everything else is natural. |
| Default | The primary world: every visit opens on it unless `?world=` names another; the other three are under Next preset. |

## As built

- **Files:** `tools/worlds/meadow.ts` (`buildMeadow`), registered in `tools/make-worlds.ts`; `naturalCavern` and the `finishBoard` options (`hall`, `quiet`) in `tools/worlds/underground.ts`; `PRIMARY_WORLD` in `src/worlds/index.ts`. 16 element types.
- **No `ROOMS` export.** Each part was checked in the full world in a WebGPU browser instead: 900 steps (15 s) after load, the cavern, warren, trees, lake, aquifer, chest and fossil had not changed a cell. Only the bog's methane (leaking away as expected) and the rotting log changed.
- **What the first run caught, now fixed:** tree crowns wider than their platform and steeper than 45 degrees shed grass into a burrow mouth; chamber bowls that started at depth 0 where a 4-row passage joined left a dirt face that slumped; rabbit bodies as wide as their foot plate lost their corner grains. Crowns now narrow a cell per row on a wider platform, open chamber ends start at the passage height (the pantry's dead end still slopes from 0), and the rabbits' foot plates are a cell wider than the body on each side.
- **Passages are 4 rows tall** (3 read as a thin line at 4 px tiles).
- **The lake's rim is stone** wherever a cell touches water (wet sand or mud there would slide into the water), so the wet-sand beach is narrow.
- **Checked layouts:** 2560 x 1440 (whole world), 1280 x 760, 1280 x 650 (the shortest window with the board) and a 375 x 812 phone. Tile sizes other than 4 px were not checked in the browser; the board geometry is shared with the other worlds.
