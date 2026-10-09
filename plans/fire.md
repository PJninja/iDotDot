# Fire: Flames, Embers, Sparks

Status: plan, not started.
Scope: 3 new elements, reaction rules on Wood and Water, one generic **aging** mechanism (a new per-tile **age byte**, bits 24–31 of the packed tile, + per-type table fields), and two small movement functions (`updateFlame`, `updateSpark`). No new buffers, no `TypeInfo` size change, no haze changes; the render shader changes by one line.

## Goals

- Flames change color as they age (white-yellow → orange → red → smoke).
- Embers visibly cool. This comes free: the same aging mechanism drives both.
- Flames and sparks move per tile (independent flicker), not in patches like smoke.
- Sparks fly on arcs. They do not bounce; a spark that hits something becomes a small flame.
- No glow.

## The fire cycle

```
Wood ──(touching Flame / Ember)──▶ Ember (fresh: hot)
Ember: falls + slumps, cools with age (color), dies into air
Ember ──(touching air)──▶ Flame          (burns away from exposed faces)
Ember ──(touching air, rare)──▶ Spark
Flame: rises + flickers per tile, ages through its color ramp, ends as Smoke
Spark: launches on an arc, fades with age; on impact becomes a Flame (which can light wood)
Water puts out Flame / Ember / Spark; Water touching Ember turns into Steam
```

Reactions may name **air** as `with` (`typeWithin` matches type 0 like any other type). A tile changes only where it touches air, so fire eats from the surface inward. The ember also turns *into* the flame rather than spawning one beside it, so no thread ever writes a second cell.

## Engine change 1: the age byte (generic aging)

### Tile layout
The packed `u32` tile gains a fourth byte:

| Bits | Field | Owner |
|---|---|---|
| 0–7 | type | unchanged |
| 8–15 | value | unchanged (fall accumulator, steam timer, spark velocity) |
| 16–23 | variant | unchanged (per-tile color variety) |
| **24–31** | **age** | **new**: 0 = fresh, 255 = old; only types with `ageRate > 0` advance it |

The byte is unused today: every existing read masks it out (`& 0xFFu`, `(p >> 16u) & 0xFFu`), and the HUD's mover check (`STATS_WGSL`) compares `& 0xFF00FFu`. So aging does not count as movement, and nothing else needs to change to tolerate a non-zero top byte.

What it fixes for free:
- **Painted tiles start fresh.** `PAINT_WGSL` writes only type + variant, so the age is 0. Painted flames live a full life, and painted embers start hot.
- **Reaction results start fresh.** A reaction writes a new tile, so it passes age 0. An old ember turns into a *new* flame without any extra helper.
- **Variant stays color variety.** It is free for future per-tile shading.

### `pack` carries the age (`COMPUTE_WGSL`)
`pack(t, value, variant)` → `pack(t, value, variant, age)` returning `t | value << 8 | variant << 16 | age << 24`. All 8 call sites need updating:
- **Reaction results** (`main`, `mainLiquid`, `mainGas`) and **steam condensing** into water: age `0u` (a new tile).
- **Moves and stays** (`main` commit + settle, `mainLiquid`, `mainGas`): the tile's (aged) age. Forgetting one would make a moving ember young again every step, so each dispatch reads `let age = p >> 24u` next to `value` and `variant`.

### Per-type fields
**`Element`** (`src/engine/element.ts`):
- `ageRate` (default 0): age steps added per sim step. It is fractional: the whole part is always added and the fraction by chance per tile. Mean lifetime ≈ `256 / ageRate` steps.
- `agedInto` (default AIR): what the tile becomes once its age passes 255.

**`TypeInfo`:** these fill the two existing pad slots (`_pad1` → `ageRate : f32`, `_pad2` → `agedInto : u32`), so the struct stays **48 bytes**. `writeUniforms` gets 2 more lines.

### Aging step
`age(x, y, t, age) -> vec2u` returns `(type, age)` after this step. It rolls the fraction with `rand`, and an age past 255 returns `(agedInto, 0)`. A tile with `ageRate > 0` `mark()`s its chunk every step (a pending random change). It runs after `react()` in `main` (embers) and `mainGas` (flames, sparks). A type change from aging takes the same path as a reaction result (`settle` in `main`, `claim` + `commit` in `mainGas`). `mainLiquid` does not age (no aging liquid).

### Render (`RENDER_WGSL`)
The color texture's row index becomes the age for types that age:
`let row = select((p >> 16u) & 0xFFu, p >> 24u, u.types[t].ageRate > 0.0);`
Each aging element's `getColor(_value, row)` is a 256-entry ramp indexed by age. The color texture build is unchanged, since it already calls `getColor(0, 0..255)` per type. Update the "color depends on `(type, variant)` only" docs: aging types depend on `(type, age)`.

## Engine change 2: per-tile movement in `mainGas`

`mainGas` picks the mover: `FLAME` → `updateFlame`, `SPARK` → `updateSpark`, everything else → `updateGas` (unchanged). Tuning comes in as WGSL consts from the `Flame` / `Spark` statics, like Smoke and Steam.

**`updateFlame(x, y, t)`** (~20 lines): it rises with chance `riseSpeed` and jitters sideways with chance `FLICKER`, both rolled **per tile** with `rand(x, y, step)` (unlike `updateGas`'s shared `stepPhase`). Wind biases the sideways roll. It has no curl noise and no pocket closing. It tries the candidates `(dx, -1)`, `(0, -1)`, `(dx, 0)` through `passable` + `claim`, else claims its own cell, else it is displaced and vanishes (`tileGone`). That is the same claim contract as `updateGas`.

**`updateSpark(x, y, t, value)`** (~40 lines):
- **Velocity in the value byte** (free for gases): `vx` bits 0–3, `vy` bits 4–7, each stored +8 (−7..7 cells/step). **0 = not launched**: a fresh spark picks a random upward-cone velocity (`vx` −3..3, `vy` −5..−2). Reaction results and painting both write value 0, so every new spark launches itself.
- Each step: `vy += 1` with chance `Spark.GRAVITY` (arcs), and `vx` decays toward 0 with chance `Spark.DRAG`.
- It traces the cells toward `(x + vx, y + vy)` (DDA, ≤ 7 cells) through `enterable(SPARK, …)`. Its density 0.3 is above flame/smoke/steam, so it passes through fire and smoke. It claims the furthest cell it can, falling back to earlier path cells (like `updateFall`).
- **Impact:** if the path was blocked, the spark turns into a fresh `FLAME` (age 0) in the cell it reached. A flame landing on wood lights it through Wood's flame rule, so sparks need no rule on wood.

## New elements (scaffold with `new-element.bat`)

| Element | Type | Scaffold | Fields | Color ramp (age 0 → 255) | Reactions |
|---|---|---|---|---|---|
| **Ember** | 9 | `falling` | slow `gravityQuantum`, `slideChance` ~0.4, `cohesion` ~0.8 (holds shape, slumps), `ageRate` ~0.4 (≈10 s), `agedInto: AIR` | bright orange → deep red → dark grey | `{with: AIR, becomes: FLAME, chance ~0.01}`, `{with: AIR, becomes: SPARK, chance ~0.0005}`, `{with: WATER, becomes: AIR, chance ~0.3}` |
| **Flame** | 10 | `bare` → `phase: 'gas'` | `density` 0.05, `riseSpeed` ~0.8, `ageRate` ~8 (≈0.5 s), `agedInto: SMOKE`, tiles (no `hazeChannel`) | white-yellow → orange → red | `{with: WATER, becomes: AIR, chance 0.8}` |
| **Spark** | 11 | `bare` → `phase: 'gas'` | `density` 0.3, `ageRate` ~6 (≈0.7 s), `agedInto: AIR`, tiles | white → yellow → dim orange | `{with: WATER, becomes: AIR, chance 1}` |

Existing elements get rules only:
- **Wood:** `{with: FLAME, becomes: EMBER, chance ~0.03}`, `{with: EMBER, becomes: EMBER, chance ~0.005}`.
- **Water:** `{with: EMBER, becomes: STEAM, chance ~0.1}`.

That is 9 rules in total, well under `MAX_REACTIONS`, and none consume.

## Change list

| File | Change |
|---|---|
| `src/engine/element.ts` | `ageRate`, `agedInto` fields |
| `src/engine/gpu/gpu-simulation.ts` | `writeUniforms`: 2 lines for the new fields; tile-layout doc comment (age byte) |
| `src/engine/gpu/shaders.ts` | `TypeInfo` pads renamed; `pack` gains `age` (8 call sites); `age()`; aging in `main` + `mainGas`; `updateFlame`, `updateSpark`; mover switch in `mainGas`; Flame/Spark consts; `RENDER_WGSL` row = age for aging types; layout doc comment |
| `src/elements/ember.ts`, `flame.ts`, `spark.ts` | New (via `new-element.bat`, which also wires `settings.ts` + `index.ts`); `getColor` = age ramp |
| `src/elements/wood.ts`, `water.ts` | Reaction rules |
| `AGENTS.md` | Tile layout (age byte), aging + color by age, `TypeInfo` field names, spark value encoding, flame/spark movers, file map |

## Phases

| # | Phase | Done when |
|---|---|---|
| 1 | Age byte + Flame | `pack` carries age everywhere (existing elements behave exactly as before); painted flames rise and flicker per tile, shift white → red over their full life, turn into smoke; water puts them out |
| 2 | Ember + wood rules | Flame beside wood lights it; the wood turns into embers that slump, cool through their ramp, and burn away from exposed faces into flames; chunks sleep once it is all out |
| 3 | Spark + water rules | Embers throw sparks that arc and fade; a spark landing on wood can start a new fire; water quenches embers with steam |
| 4 | Tune + docs | Chances and rates tuned by eye; `AGENTS.md` updated |

Validate each phase with `npx tsc --noEmit`, `npm run build`, and a look in a WebGPU browser (with an error scope around the first run of the changed shader). In phase 1, check conservation with `readGrid()` on a sand/water scene to confirm the `pack` change did not break anything.

## Risks

- **A `pack` site that drops the age** makes that tile re-age from 0 when it moves (an ember that never cools while falling). There are only 8 sites; check each one in phase 1.
- **Spark vs. displaced gas race:** a spark entering a flame or smoke cell races that tile's own-cell claim in the same dispatch. Whoever loses falls back (spark) or flees/vanishes (the displaced gas). This is the existing gas contract, so nothing new.
- **Aging keeps chunks awake** while any ember, flame or spark exists. That is intended; the world idles once the fire is out.
- **Value byte ownership:** spark velocity uses the value byte. Steam's timer is the only other gas user, and the two never share a type.
