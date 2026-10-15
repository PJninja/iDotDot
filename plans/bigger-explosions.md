# Bigger Explosions: Blast Power, Thrown Debris, Craters, Blast Light

Status: implemented (blast power, debris, ground tuning and the light pass; see As built). The design sections below are the proposal as written; where they differ, As built and the code win.
Scope: one shader-side change to how a blast spreads (a per-blast power), one new hidden mover (debris), tuning of the ground costs, and a light pass.

Decisions made after the proposal: the existing bomb is the big one (no new explosive, so no TNT and no type 52), and the blast light is in.

## As built

- **Power.** `Element.blastPower` (Bomb 2.5, Methane 1) fills `TypeInfo.blastPower`; `reactedTile` writes it as power * 16 into the explosion's variant byte. `blastSource` divides hop and absorb costs by the source tile's power with a per-cell dither; `ageTile` divides an explosion's age rate by it.
- **Spread window (a fix found in the sim).** The first build kept the spread window in age units, so with the slower aging it lasted 2.5 times as many steps, and since the core keeps refilling the cells its dead tiles leave, a bomb burned for about 3 s and was still growing. `blastSpreads` now divides the window by the power, so it lasts 8 steps at any power. Measured after the fix: a bomb's blast is gone about 100 steps (1.7 s) after detonation, around 3,000 blast tiles at its peak.
- **Ground.** `SOLID_COST` 15 to 6, `ABSORB` 20 to 12, and a new `Explosion.SHATTER` 2: a tile holds with `blastResistance ^ (power * SHATTER)` (stone 0.9 holds 59% of steps against a bomb, was 90%). Stone costs 26 per cell before the power (10.4 for a bomb). A bomb on bare stone breaks into a cave whose roof is 15 cells thick; one buried 25 cells deep under a dirt layer opens to the surface and the dirt falls in. The first try (8 / 16, no SHATTER) left a 10-cell dent and the cave roof held.
- **Debris.** Type 51 (`src/elements/debris.ts`), as designed: phase solid, density 3, `updateDebris` in `main`, lands as `TypeInfo.fragment` (`Element.thrownAs`). Tuned to `THROW_FROM` 0.3, `THROW_SHARE` 0.9, `GRAVITY` 0.5, `DRAG` 0.15, throw speed 1 to 3 plus the power (the first values threw tiles for hundreds of cells). In the test scenes 10 to 40 tiles are in flight at a time and all of them land; most debris is rock thrown into rock, which lands in place as the rubble lining. No `traceBallistic` was extracted: the path trace is short and the two movers differ in how they end.
- **Smoke.** `Explosion.SMOKE_CHANCE` 0.25 to 0.4.
- **Light.** `LIGHT_WGSL` with `Element.glow` in `TypeInfo.flags` bits 16-23 (explosion 1, arc 0.9, spark 0.7, flame 0.6, ember 0.5, hot steel 0.35, live steel 0.3, live copper 0.25). The first version blurred full-resolution emission with the emission computed per tap: 11.7 ms a frame at 1 px tiles. It now averages emission once per 2 x 2 block (`LIGHT_SCALE`) and blurs that: 0.27 ms for haze plus light at 1 px tiles, 0.16 ms at 4 px. `LIGHT_RADIUS` 16, `LIGHT_GAIN` 1.1, `LIGHT_SURFACE` 1.5, `LIGHT_TEMPORAL` 0.35. A blast lights the ground, the sand and water near it; a torch's glow is barely visible.
- **Worlds.** `circuits.ts` models power (cost / power, kept in eighths of reach), the new costs and `BLAST_CLEARANCE` 52. The death machine needed two changes: the four bombs in the skull tower's gear rooms are gone (the teeth's blast reached them, and they were within 52 cells of the board), and pocket 5's generator is gone (every bomb in pocket 5 is about 20 to 40 cells from the board, 3 cells of rock from pocket 4's magazine), so its crane and conveyor bombs stay but only a visitor can set them off. The other worlds regenerate byte-identical. Run in the browser, the death machine's skull went off about 11 s after load and set off 1,441 bombs, the depot's stacks included (by sparks and fire, which the checker does not model); every chip ring tile was still there afterwards.
- **Not done:** the two-cell front for big blasts (the 1 cell per step front looked fast enough), a pinned regression test.

Testing: `npx tsc --noEmit`, `npm run build`, `npm run test:ui` (79 passed), `npm run worlds`. On the Windows machine this was built on, headless Chromium hangs or crashes at the first grid readback (`test:gpu`, `test:pulse`), and the unchanged code at `4a002d4` hangs at the same point, so those were checked in the desktop app's browser pane instead, with its real GPU: no validation errors, the pulse check's scene passes (both wires cross and return, copper throws no arcs, the sim idles), and the scenes above.

## Where it stands

Measured from the code (`Explosion` statics, `blastSource` / `blastHit` / `blastFill` in `shaders.ts`):

- **Size.** `REACH` 200 at `HOP_COST` 10 is about 20 cells in air (80 CSS px at 4 px tiles). The reach lives in the value byte, so it cannot grow past 255 with the current costs.
- **Ground.** A stone cell costs 10 + `SOLID_COST` 15 + 0.9 x `ABSORB` 20 = 43, so a bomb in rock eats about 4 or 5 cells, and each stone tile still holds 90% of steps during the 8-step spread window (about 43% survive a window). In dirt (32 per cell) it is about 6 cells. A bomb underground leaves a dent.
- **Shape over time.** The front moves at most 1 cell per step and slows to `MIN_SPEED` 0.25; an origin tile lives about 21 steps (`AGE_RATE` 12). At 20 cells that reads as a filled fireball. Scaled up as is, the core would die long before the front arrives and a big blast would look like a thin ring.
- **Destruction.** Everything the blast reaches vanishes into blast tiles, which fade into smoke 25%, flame 3%, spark 2%, rubble 6%. Nothing is thrown except the rim sparks, nothing is loosened past the reach, so a blast never brings a ceiling down or scatters a sand pile.
- **Budgets.** `TypeInfo` has two free padding words (`_pad0`, `_pad1`). Outcomes: 30 of `MAX_OUTCOMES` 32 used, so this plan adds no `agedInto` entries (raising the cap is cheap if needed: 16 bytes per outcome in a ~25 KB uniform). Reactions: about 136 of 256. Type ids used up to 50 (void).

## The idea

Four layers, each shippable alone and each building on the previous one:

1. **Blast power.** Each blast carries a power in its explosion tiles' unused variant byte. Power divides the reach costs and the age rate, so a power 2.5 blast is 2.5 times as wide in air and in rock, and its fireball lives 2.5 times as long, with the same fade profile. Explosives set the power through a new per-type `blastPower`; bombs stay at 1, a new **TNT** is 2.5.
2. **Thrown debris.** In the outer part of the reach, a tile the blast takes is not vaporized but launched outward as a ballistic **debris** tile that remembers what it was, and lands as that material (or its fragment: stone lands as rubble, wood as charcoal). Sand piles scatter, water splashes, rock spalls. Debris aimed into more rock lands at once, so the outer band of a buried blast turns to loose rubble in place: the crater lining and roof collapses come out of the same rule.
3. **Ground tuning.** Lower `SOLID_COST` / `ABSORB` and let the rubble lining do the rest, so a buried TNT opens a real crater and anything resting on it falls in.
4. **Blast light (optional).** A blurred emissive buffer so the fireball lights the cave walls and the background around it, shared with flames, embers and hot steel.

Rejected: **screen shake.** Moving the canvas or offsetting `gridOrigin` would slide the world under the DOM chips and break the whole-device-pixel layout (`frame.ts`, `test:gpu` checks it). A shock ring drawn as a pure visual is possible later but needs blast centers the GPU does not track.

## 1. Blast power

### Encoding

- Explosion tile: value = reach spent (normalized to `REACH` as now), **variant = power x 16** (power 1 = 16, 2.5 = 40, max 15.9). Variant 0 reads as power 1, so explosion tiles in old saved worlds and any path that writes variant 0 keep today's behavior. Explosion color comes from the age row, so the variant byte is free.
- `TypeInfo._pad0` becomes `blastPower : f32` (0 = not an explosive). `Element.blastPower` (default 0); Bomb 1, Methane 1, TNT 2.5.

### Shader changes

- **Reaction results.** All three dispatches pack a reaction result as `pack(reacted, 0u, variant, 0u)`, which today gives a bomb's explosion the bomb's color variant. Add `reactedTile(result, t, variant)`: if `result == EXPLOSION`, the variant is `u32(u.types[t].blastPower * 16)`, else the tile's own variant. Use it in `main`, `mainLiquid` and `mainGas`.
- **`blastSource`** reads the neighbor's power and divides its hop cost and the `absorb` term by it, with stochastic rounding (`floor(cost / power + rand)`) so fractional costs average out over a path and the front stays round instead of picking up the octagon that rounding 14 / 2.5 would give. It returns the power with the spent reach; `blastTile(spent, power)` writes it, so a front inherits the power of the cheapest neighbor (where two blasts meet, the stronger one's cheaper spent wins on its own).
- **Fireball life.** In `ageTile`, an explosion tile's age gain is `AGE_RATE / power` (one `select` on `t == EXPLOSION`). Because `SPREAD_WINDOW` and `FADE_AGE` are in age units, the spread window and the fade stretch with it, which keeps a big blast filled instead of a ring.
- `blastFill`'s rim sparks: speed up to `min(5 + power, 7)` so a bigger blast throws them further (the nibble caps at 7).

### TNT (new element, type 51, pickable)

`new-element.bat tnt static no`. Static, flammable, same detonation rules as Bomb (blast at chance 1, flame, ember, spark, hot steel, arc, live steel and copper), `blastPower` 2.5, a red block color. Radius about 50 cells in air (200 CSS px at 4 px tiles, about a tenth of a 1080p screen's width each side). Bomb stays the small, world-safe charge.

Front speed: at 1 cell per step a 50-cell blast takes about 1.3 s to reach full size (slowed by `MIN_SPEED`). Try that first. If it looks slow, let a blast of power 2 or more pull from two cells away in `blastFill` (air only, the cell between must be air or blast so it cannot jump a one-cell wall), which doubles the front speed for big blasts only.

## 2. Thrown debris

### Debris (new hidden element, type 52)

- **Encoding:** value = velocity (vx bits 0-3, vy bits 4-7, each +8, as Spark), **variant = the type it was**, age = flight steps.
- **Phase solid, moved in `main`** with a new `updateDebris` case: it is the heaviest thing in flight, so it runs in the first dispatch and can claim through gases and liquids (`enterable`, density 3.0 so nothing enters it). Extract Spark's path trace into a shared `traceBallistic(x, y, t, velocity)` (cells toward `(x + vx, y + vy)`, claim the furthest reachable, fall back to earlier path cells) and use it from both movers. Gravity and drag by chance like Spark (`Debris.GRAVITY`, `Debris.DRAG`, `Debris.WATER_DRAG` when the path enters a liquid). `gravityQuantum` 0, so `updateFall` never sees it.
- **Landing:** blocked, out of velocity, or past `Debris.MAX_FLIGHT` steps (so a stuck tile cannot keep the sim awake): it writes its landing type with age 0 and a fresh random variant, through `settle` like a reaction result. Falling types then fall, liquids flow.
- **Landing type:** `TypeInfo._pad1` becomes `fragment : u32` (`Element.fragmentType`). Default: the type itself for falling types and liquids, `NONE` (not throwable, vaporized as now) for static solids, gases and every hidden or active type. Set explicitly: stone, steel, copper, rubble to rubble; wood, bark, charred bark to charcoal; leaves to ash; ice to water. Never throwable: bombs and TNT (their react rule fires first anyway), springs, torches, generators, void, fuses, mold, emitters.
- **Drawing:** one case in `RENDER_WGSL`: a debris cell is drawn with `colorTex[(variant, 0)]`, the color of the material it carries, so a flying sand grain looks like sand. Water debris is drawn as a tile of water's color (no haze), which reads as spray.
- `blastHit` skips debris like it skips explosion tiles, or the blast would eat its own ejecta.

### Where tiles get thrown

In `blastHit`, after the tile has failed its hold roll: if its type has a fragment and `spent / REACH > Debris.THROW_FROM` (0.45), it becomes debris with chance `(spent / REACH - THROW_FROM) / (1 - THROW_FROM) * Debris.THROW_SHARE` (0.7), otherwise a blast tile as now. The core still vaporizes; the shell is thrown.

Velocity: away from the source neighbor (as `rimSparkVelocity`), speed `2 + 3 * (1 - weak) * power` capped at 7, plus an upward bias of 1 (ejecta fly up out of a crater), plus a little scatter.

A tile in rock is thrown toward more rock, so its trace is blocked on the first cell and it lands in place as its fragment: the outer band of a buried blast turns to loose rubble without any extra rule. Rubble is a falling powder, so the roof of a cavity over the crater comes down.

## 3. Ground tuning

Start at `SOLID_COST` 15 to 8 and `ABSORB` 20 to 16: stone costs 32 per cell (about 6 cells at power 1, 15 at TNT's 2.5), dirt 24 (8 and 21), sand 21. Leave `blastResistance` alone at first: the hold rolls give the ragged crater edge, and the rubble band behind it widens the hole. Tune against a TNT buried 20 cells deep in stone and a bomb in dirt.

Also raise `Explosion.SMOKE_CHANCE` 0.25 to about 0.4 so a big blast leaves a rising plume (smoke already rises; no outcome entries added).

## 4. Blast light (optional)

A light buffer (`f32` per cell) written in the haze pass from emissive tiles (explosion by age, flame, ember, hot steel), blurred with the existing separable tent blur at a wider radius (about 10 tiles), and added in `RENDER_WGSL` to the background and to tiles near it, tinted orange. Cost: one more blur pass on stepping frames, same shape as the haze. It benefits every fire, which is why it is worth it, but the explosion work above does not depend on it.

## Worlds and the board

- `tools/worlds/circuits.ts` mirrors the blast costs (`BLAST`, `BLAST_RESISTANCE`); update it with the new costs and a per-explosive power (bomb 1, methane 1, TNT 2.5), and divide costs by power in the chain walk exactly as the shader does (expected cost, ignore the rounding noise).
- Debris adds range the checker does not model: a thrown tile at speed 7 travels further than the blast reaches. Add the worst measured throw distance for power 1 to `BLAST_CLEARANCE` (22 cells today) or measure that thrown rubble cannot reach a slot's keep-out zone. Chips are colliders, so debris cannot enter them; it can pile up in the hall and the gallery corridor's air, which `finishBoard` already requires to stay clear at build time but nothing protects at runtime.
- The shipped worlds use bombs and methane only, both power 1, so their blast sizes change only through the ground tuning. Rerun `npm run worlds`; the checker will flag any chain that now reaches the board.
- Placing TNT in a world (the death machine is the obvious home) is a separate decision, after the playground version feels right.
- A visitor's TNT can blow away chip rings, as bombs can today, just more of them. `Board.stamp` restores them on the next rebuild. Accept, or give ring cells a stamp-time marker later.

## Code changes

- `src/settings.ts`: `TNT_TYPE: 51`, `DEBRIS_TYPE: 52` (never renumber).
- `src/engine/element.ts`: `blastPower`, `fragmentType` fields; registry validation (power 0 or 1 to 15.9; fragment a registered, non-hidden type or none).
- `src/engine/gpu/gpu-simulation.ts` (`writeUniforms`): fill the two former padding words.
- `src/engine/gpu/shaders.ts`: `TypeInfo` fields; `reactedTile`; power in `blastSource` / `blastTile` / `blastFill`; `ageTile` explosion case; `traceBallistic` shared with `updateSpark`; `updateDebris` in `main`; debris throw in `blastHit`; debris color in `RENDER_WGSL`; optional light buffer.
- `src/elements/explosion.ts`, `bomb.ts`, `methane.ts`: powers, new tuning statics. New `tnt.ts`, `debris.ts` (via `new-element.bat`), registered in `index.ts`.
- Fragment types on stone, steel, copper, wood, bark, charred bark, leaves, ice, rubble, grass.
- `tools/worlds/circuits.ts`: costs, power, clearance.
- `npm run elements`, then AGENTS.md (Explosion and file map) and this plan's As built section.

## Risks

- **Idle.** Every debris tile must land within `MAX_FLIGHT`, or a stuck tile keeps its chunk awake for ever. Check that the sim goes idle after a TNT in air and in rock.
- **Tile loss.** Debris is a mover under the usual claim contract; a tile that loses every claim must land in place (claim its own cell) rather than vanish. Count sand before and after a TNT under a sand pile (thrown sand must come back as sand, minus what the core vaporized).
- **Front precision.** Stochastic cost rounding makes edges noisy; if a TNT blast looks fuzzy rather than round, round the per-power costs once (a small table for the allowed powers) instead.
- **Performance.** A 50-cell blast is about 8,000 blast tiles plus a few thousand debris tiles; trivial on a real GPU, slow on the software one. Check steps/s and dropped steps in the perf HUD with five TNT at once.
- **Debris through sleeping chunks.** `traceBallistic` goes through `enterable`, which already refuses to displace a fluid in a sleeping chunk and wakes it; landing writes through `commit`. No new rule, but worth a look in a pool that has gone to sleep.

## Testing

No new permanent test unless a regression would go unnoticed (the sim going non-idle after a blast is the candidate; if added, it belongs next to `test:pulse` as a slow sim check, not in `test:gpu`). Scene checks in the warm session (`session.mjs eval` to stamp, `readgrid.mjs --session --steps N --png`):

- TNT in open air: radius, debris peak count, all debris landed and the sim idle after a few seconds.
- TNT 20 cells deep in stone under a sand layer and a water pocket: crater size, rubble lining, the sand falls in, water splashes.
- A row of bombs: chain still works, power stays 1.
- Bomb at today's settings vs after phase 3 in dirt and stone, for the before/after numbers in As built.
- `npm run test:gpu`, `npm run test:pulse` (bombs near wires), `npm run worlds` (checker), `npx tsc --noEmit`, `npm run build`.

## Phases

1. Blast power, TNT, explosion age scaling, circuits power. Bomb unchanged in size.
2. Debris element, fragment table, throw band.
3. Ground cost tuning and smoke plume; measure, record in As built.
4. Blast light, if the first three land well.
5. Worlds: rerun the checker; decide separately whether a world gets TNT.

## Open questions

- Keep Bomb at its current size and add TNT for the big one (recommended, keeps the worlds balanced), or grow Bomb itself?
- Name and look of the big explosive (TNT, Dynamite, Charge).
- Is the blast light worth one more blur pass per stepping frame?
