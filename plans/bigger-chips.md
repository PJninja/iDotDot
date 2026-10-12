# Bigger chips

Goal: each project chip is twice as wide and twice as tall (100 x 54 cells, 400 x 216 CSS px at 4 px tiles), with its text doubled. Status: implemented. `AGENTS.md` and the code are the current state; this records why the board looks the way it does now. It revises `plans/board-in-world.md`.

## Decisions

| Topic | Decision |
|---|---|
| Chip size | 2x on each side (4x the area). Text and padding scale through `--chip-scale`. |
| Wide layout | 2 x 2 chips, 4 per page, from 920 CSS px wide. |
| Narrow layout | One column of two big chips, from 420 px. |
| Compact layout | One column of two small chips (the old size) under 420 px, down to 320 px, so phones keep the board. |
| Minimum canvas | Still 600 px, so no device that worked before stops working. |
| Ring and gaps | Unchanged (2-cell ring, 10 x 8 cell gaps). |
| Gallery | Text 1.5x (about 20 px), 10 interior rows. |
| Pocket 3 | Dropped. Two rows of big chips and the gallery fill the bottom 150 rows, so nothing fits under them, whatever the column count. |

## Why pocket 3 went

The visible bottom of the world is `canvas height / tile` rows, 150 at the 600 px minimum. The chip rows are 2 x 58 + 8 = 124 rows, the gallery 14 more, ending at row 344 of 348. A cellar under the block needs a taller minimum window: about 720 px would keep a shallow room, 780 px a full one, and either would send many 1366 x 768 and 1536 x 864 laptops to the plain page.

## What changed in the worlds

- Pockets 2 and 4 are 52 cells wide (were 70 and 62), pocket 5 sits 8 columns east, and `POCKETS` has five entries.
- No vertical pipes between the columns: the narrow layout puts a chip across that gap. `pipeLattice` is one pipe along the strip between the rows.
- Alchemist's Lab: the strongroom is gone, the cold cellar is redrawn at 52 cells, the cistern at 52, and the greenhouse drain runs through a duct inside the foundation to a shaft down the east side of the hall.
- Farmstead: the machine hall and the boiler's heat pipe are gone, the boiler hall is redrawn at 52 cells, and the field drain runs east past the well and down to the cistern.
- Death Machine: the reservoir hall and the fuse are gone. The methane spine now ends in a reservoir in pocket 4 above a sealed bomb magazine, the coolant hall is gone, and the steam stack moved 10 columns west. Nothing ignites the reservoir; the furnace hall is a self-contained machine.

## Not run

The three worlds were simulated for 120 steps each in the headless browser: the rings and hall stayed clean and nothing errored. Long runs (the lab's drain filling the cistern, the death machine's furnace over minutes) were not.
