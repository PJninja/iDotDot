# Electricity in the shipped worlds

Status: all five phases built (copper, tooling, farmstead, alchemist lab, death machine). Remaining: look at the three worlds in the running sim, which has not been done. Phases 0 to 4 were checked statically (type check, registry rule count 119 of 128, outcomes 18 of 32, `checkCircuits` run on synthetic grids) and with the test suites; the simulation was not run by hand. Follows `plans/electricity.md` (implemented), which left the three default worlds unchanged on purpose. Checked on 2026-10-13: `src/worlds/alchemist-lab.idw`, `farmstead.idw` and `death-machine.idw` contain no tile of types 28 to 36, and no scene script names an electric element.

Decisions already made:

- Electricity is thematic per world. Farmstead: low use (a windmill dynamo and an electric fence). Alchemist lab: testing and combining (a conductivity bench, an electrolysis jar). Death machine: heavy use, as a weapon and to start ignitions.
- All three worlds in the first pass, built and checked one at a time.
- Copper details (all confirmed): live copper ignites flammables on contact only; fire and heat leave copper alone; the fuse is recolored so copper keeps the orange-brown metal look; blast resistance 0.95.
- Farmstead includes the water-trough switch, the alchemist lab includes the one-shot methane spark gap, and the death machine's first ignition comes from the generator's own chance a few seconds after load. Its set pieces may destroy the skull and the pocket 5 bomb line on every visit, never the board.
- `LiveSteel.OVERLOAD_CHANCE` stays at 0.0005. Instead a new **copper** wire element conducts like steel but never overloads and never throws arcs, so long-running circuits stay intact. Steel is still used where overload or arcs are wanted.

## Why the worlds need more than scene edits

Reading `tools/world-kit.ts`, `tools/worlds/*.ts` and the electric elements turned up these constraints. Each one is a rule for the scenes or a piece of tooling to build first.

1. **The drawing kit cannot name electric elements.** `T` and `LOOKS` in `tools/world-kit.ts` stop at 27, so scenes cannot place a generator, a preview PNG would draw it with no color, and `make-worlds.ts` would list all nine as unused.
2. **Conduction follows the 8 neighbors, arcs add a second path.** Steel next to live steel, a generator or an arc turns live. Live steel and generators throw arcs into empty cells beside them (`emitBelow`), and an arc lights any steel beside that cell. So two steel conductors with one air cell between them can pass a pulse (measured in a cleared grid: a 1-cell gap between two wires conducted, and both wires ended as plain steel). Water in a pool carries a pulse to every steel object touching it.
3. **The worlds are full of steel and water already.** Towers, gears, boilers, pipes, fences, cisterns with steel anchors. A generator touching any of it energizes the whole connected set, including whatever that set touches. Nothing in the repo today shows which structures are connected.
4. **Arcs and live steel ignite things.** Per step: wood 0.03 (arc) and 0.004 (live steel), grass 0.05 and 0.01, charcoal 0.03 and 0.004, bomb 0.3 and 0.1, methane 0.3 and 0.1. A live tile lasts 32 steps, so live steel beside grass ignites it on about 27% of pulses per touching tile. Flammables within 2 cells (Chebyshev) of steel or a generator are in arc range.
5. **The board must stay inert.** `pipeLattice` is steel in the death machine, `galleryCorridor` has a steel rail, and chip rings can be steel or wood (flammable). `checkBoard` today keeps only a fixed list of self-acting types out of the ring zone; it does not know generators or conduction.
6. **Blasts and the hall.** `Explosion.REACH` is 100 and `HOP_COST` 10, so a blast reaches about 10 cells in open air, and every bomb it reaches restarts it at full reach. The death machine's pocket 4 (columns 436 to 488) holds a methane reservoir and a bomb magazine about 7 cells from the hall wall at column 429. Today they are inert; wiring a detonator near them puts the ring cells at risk.
7. **Overload on steel.** The chance is 0.0005 per tile per pulse (a 60-cell wire: about 3% per pulse), one hot tile spreads heat through connected steel, and a generator pulses forever. That is why long wires use copper.
8. **Reaction budget.** `MAX_REACTIONS` is 128 and the registry rejects more. About 104 rules exist now (the acid table builds 10 more than a count of `with:` shows). Copper adds roughly 17, so about 121 of 128 (see Copper). Count in the registry after writing. If it does not fit, raise `MAX_REACTIONS`: the reaction block is 32 bytes each, so 192 rules is 2 KB more in the uniform buffer.
9. **Step rate.** The software GPU in the sandbox runs about 2 to 6 steps per second, so a world soak is slow. Circuits are tested in small rooms (`tools/make-rooms.ts`) and in a warm session; a full-world run covers only the first few pulses.

## Copper

New pickable element **Copper** (type 37) with hidden **Live copper** (38) and **Spent copper** (39). Ids are append-only. It mirrors the steel loop exactly, without the two things the request excludes.

| Behavior | Steel family | Copper family |
|---|---|---|
| Conducts a pulse (live 32 steps in both; spent rest 64 steps for steel, 85 for copper) | yes | yes |
| Throws arcs from live tiles (`emitType`) | yes | **no** |
| Ages into hot steel at `OVERLOAD_CHANCE` | yes | **no**, live copper ages into spent copper with chance 1 |
| Heats from flame, ember, spark, hot steel; conducts heat | yes | no, fire and heat leave it alone |
| Dissolved by acid | yes | yes (copper, live and spent copper join Acid's table) |
| Blast resistance | 0.98 | 0.95 |

Interop and reactions (all one-sided, so each side needs its rule):

- Copper turns live beside live copper, live steel, live fuse, shocked water, an arc or a generator (the generator at the same low chance as steel). Same chances as steel.
- Steel, Water and Fuse each gain one rule for live copper, so a pulse crosses steel to copper, copper to a pool, and copper to a fuse in either direction.
- Live copper lights wood, grass, charcoal, bombs and methane **on contact only**, with the live-steel chances (5 rules on those elements). Without arcs it ignites nothing at a distance and cannot jump a gap. This is the split that makes copper a safe run and a deliberate detonator at its tip. Confirmed.
- Rubber and every other element insulate, as for steel.
- Color: a metallic orange-brown distinct from steel. `Fuse` is already copper-orange (186, 118, 72), so the fuse changes to a tan cord color (a one-line edit to `fuse.ts`, no behavior change) and copper takes the orange-brown.
- `test:pulse` gains a copper case: a 31-cell copper wire carries a pulse end to end, ends all copper with the sim idle, and across many forced pulses produces no hot steel and no arc. Break the spent stage once to show the check can fail, as the existing case does.
- Docs: AGENTS.md element list, file map, the electricity paragraph, and `plans/electricity.md` gets a pointer here.

## Tooling (before any scene)

1. `tools/world-kit.ts`: add `T` ids 28 to 39 and `LOOKS` entries copied from the element colors (hidden aging types use their age-0 color). Make `make-worlds.ts` skip hidden types in its "unused" line.
2. `tools/worlds/underground.ts`:
   - Add generator, arc, live steel, live copper and shocked water to the self-acting list so none appears in a chip's keep-out zone.
   - New `checkCircuits(g, world, circuits)`, run from `finishBoard` after `checkBoard`, so a bad wire fails the build the way a bad pocket does. Each scene declares its circuits: `{ name, sources, loads, allowedIgnitions }`. For every generator it flood-fills over conductors (steel family, copper family, fuse, water) through the 8 neighbors, plus a hop from steel or a generator to any conductor within 2 cells (arcs). It fails when:
     - the reached set touches the board lattice, the gallery rail, or any cell within `KEEP_OUT_CELLS` of a ring;
     - a declared load is not reached, or an undeclared structure is;
     - a wood, grass, charcoal, bomb, mold or methane cell sits within arc range of steel or a generator, or in contact with copper, unless it is listed in `allowedIgnitions`;
     - an `allowedIgnitions` target lies within `2 * REACH / HOP_COST` (about 20) cells of the board footprint, other than listed exceptions.
   - It also prints each circuit's tile counts and path length, which is the number to check against pulse speed (about 12 to 20 cells per second).
3. `tools/make-rooms.ts`: add the new rooms to each scene's `ROOMS` export so a circuit can be simulated alone in a small grid.
4. Electric tile counts need no extra script: `make-worlds.ts` already prints the tiles per type for each world.

As built (phase 1): `tools/worlds/circuits.ts` holds `checkCircuits(g, world, circuits)`, called by `finishBoard(g, world, circuits = [])`. A `Circuit` is `{ name, sources, bounds, loads, ignites? }`: `sources` is the box holding its generators, `bounds` the boxes every powered cell must lie in (a leak into any other structure fails the build), `loads` the things that must be powered, and `ignites` the boxes where a powered cell may deliberately light flammables. Conduction follows the elements' own rules: contact between conductors (steel family, copper family, fuse, water) over the 8 neighbors, plus arcs from steel and generators to any steel, copper or water within one empty cell, so a one-cell air gap conducts for steel and not for copper. It also fails when a pulse comes within `KEEP_OUT_CELLS + 3` of a chip ring, the hall or the gallery, and when the explosive chain set off by an allowed ignition (bombs within 10 cells of each other, a whole connected body of methane) comes within 12 cells of those zones. It prints each circuit's powered, ignitable and blast-chain cell counts. The world-kit has the type ids and colors for 28 to 39, and `make-worlds.ts` leaves hidden types out of its unused list. The three worlds regenerate byte-identical, since no scene declares a circuit yet.

## Farmstead: low electricity

Hooks already in the scene: `windmill()` (steel hub disc at about (305, 114)), `barn()`, the two `sheep()` on the orchard side, `field()`, `pond()`, the boiler hall (springs, torches).

- A small generator at the windmill's foot, housed in stone so its arcs land on stone. A copper line leaves it, supported on rubber stand-offs (the first use of rubber in any world), and runs to an electric fence round the sheep or the field edge.
- The fence wire is copper at least 3 cells above the ground: grass covers the surface, and copper ignites grass on contact. Posts are stone or ice, not wood. Nothing flammable touches the line.
- The visible result is a blue-white pulse traveling the fence every few seconds. No ignition, no water on the circuit. Keep it away from the pond and the boiler hall's water and steel.
- **Water-trough switch**: a gap in the fence line with a stone trough across it. The pulse passes only while the trough holds water, since water conducts between the two copper ends. Water here means the pulse also shocks the trough (a flash). Keep the trough clear of the pond and give it a feed that keeps it full (a spring or the field drain) without letting it reach the rest of the line. `checkCircuits` lists the trough water as part of this circuit and must show it touches nothing else.

As built (phase 2): `dynamoFence` in `tools/worlds/farmstead.ts`, drawn last so no earlier random draw shifts (the regenerated world differs from the old one only inside x 323 to 371, y 141 to 168, 408 cells). The generator (2 x 2) sits in a stone shed at the windmill's foot, walled in except for a 2 x 2 air notch above it (the visible crackle; its arcs cannot leave the notch). A copper lead leaves through the shed wall and runs along one cable post (stone column, rubber seat, copper wire above) to a stone trough built into the slope. The wire drops into the trough through two copper legs 5 cells apart with 4 cells of water between them, and rises on the far side to a two-rail fence (two copper rails joined at the near end) between two stone posts at the field drain. No wood, grass or steel lies within contact of any copper cell. `checkCircuits` reports 138 powered cells, none ignitable, no blast chain; with the trough water removed the fence rails are no longer powered (checked on the generated grid), so the trough is a real switch. Deviation: the trough is a sealed, prefilled box with no spring or drain feed. A perpetual feed could only be tuned by running the sim, and a spring floods without a sink, so the water simply stays unless a visitor moves it. Not looked at in the running sim: pulse crossing time, the water flash, how the notch crackle reads.

## Alchemist lab: testing and combining

Hooks already in the scene: the acid lab room (a race between seven samples in acid), the distillery, the forge, the cold cellar, the gas cellar.

- **Conductivity bench** beside the acid lab's sample race: a generator in a stone box feeds copper leads to a row of test gaps. Each gap holds one sample between two copper electrodes: steel and water (in a glass tube) pass the pulse on, rubber, stone and ice stop it, and a fuse passes it once and is gone for the rest of the visit. A lit copper tail after each gap shows the result. Wood and other flammables stay off the bench (copper ignites them on contact).
- **Electrolysis jar**: two copper electrodes in a glass (ice) jar of water. Each pulse shocks the water into a flash, the "combining" beat.
- **Spark gap (one-shot)**: two steel electrodes in a sealed stone box in the gas cellar, set to light the methane there once per visit. The sealed volume must be small enough that the blast stays in the cellar; check it in the room sim, and shrink the box or thin the gas if it does not. This uses steel on purpose, since the arcs are the point.
- Keep every circuit off the cistern's steel anchor, the distillery's torches and the forge's hot steel.

As built (phase 3): `conductivityBench` and `sparkGap` in `tools/worlds/alchemist-lab.ts`, drawn last (inside `g.at`) so no earlier random draw shifts; the regenerated world differs from the old one in 1112 cells, all inside the two circuit boxes. They are also part of the `acidLab` and `gasCellar` room exports, so `make-rooms.ts` shows them.

- **Bench** (acid lab, local rows 23 to 45, clear of the acid, which starts at row 61): a generator sealed in a stone box (only a 2 x 2 air notch above it) feeds one copper bus on a stone shelf. Six fingers branch off it, each a stem, a sample and a tail: steel, the water jar, rubber, stone, ice and a fuse, left to right. Fingers rather than one chain, because a blocking sample in a chain would leave every station after it dark. On the generated grid the tails of steel, the jar and the fuse are powered, the tails of rubber, stone and ice are not, and with the fuse removed its tail goes dark. 158 powered cells, none ignitable.
- **Electrolysis jar** is station 2 of the bench rather than a separate jar: a 7 x 9 stone jar of water with a copper tip entering from below and another from above, so each pulse shocks 35 tiles of water. It is stone, not the planned glass, because ice freezes the water beside it (`Water.FREEZE_CHANCE`) and the jar would stop conducting.
- **Spark gap** (gas cellar, local x 22 to 49, y 12 to 30, above the crates and the bell): a 14 x 5 methane chamber (62 methane tiles after the electrodes) in 7-thick stone, because a blast reaches about 3 stone cells in (stone resists 0.9, so each cell costs 28 of the blast's 100). The generator is walled into the top-left stone, and two copper leads inside the stone reach two steel electrodes whose tips are 6 cells apart. Live steel lights methane on contact, so the first pulse sets it off, and detonation is likely (0.004 per burning tile per step over 62 tiles). 52 powered cells, 22 ignitable and 62 in the blast chain, all inside the chamber, and the chain is far from the board (the chamber is about 140 columns from the hall).
- Not looked at in the running sim: pulse timing along the bus, the jar flash, whether the 7-thick walls hold through a full detonation, how the methane and its haze read.

## Death machine: electricity as weapon and ignition

Hooks already in the scene: the skull tower (methane brain, torch eyes, bomb teeth), the acid tower, the depot, the right yard's spiked steel fence and acid moat, the furnace hall (pocket 2), the reservoir and magazine (pocket 4), the bomb line (pocket 5). The methane spine already uses rows around `DUCT_Y` 184 and `SPINE_X` 438, so the power bus uses other rows.

- **Power room**: a bank of generators in a stone vault (furnace hall side), copper bus running through the rock above the chips (rows about 170 to 197, clear of the methane duct) to the machine's parts. Copper because the bus runs hundreds of cells and never overloads.
- **Electrified fence**: the right yard's steel spikes joined to the bus. Steel here is deliberate: arcs crackle along the fence and across the moat gap.
- **Ignition**: spark-plug electrodes (steel, with a gap) in the skull's methane brain and at the bomb teeth, so the head flashes and detonates. At least one trigger is a fuse run, which gives a one-time sequence: each fuse tile is spent after its pulse, so the countdown runs once per visit.
- **Bomb line**: a detonator wire to the conveyor bombs in pocket 5, which is 65 or more cells from the hall. Cap the chain at pocket 5 and the skull; do not wire the pocket 4 magazine or the reservoir, which sit next to the hall.
- The lattice (steel) and the gallery rail (steel) stay unconnected; `checkCircuits` enforces it.
- Timing: the generator's own chance starts the first pulse, with no fuse delay for it. That chance is 0.002 per step per touching tile, so on the order of seconds, not instant, and a pulse needs about 5 s to cross 100 cells. Measure the time to first ignition in a room, and add generators or touching tiles if it is too slow.
- Destruction is allowed for the skull and the pocket 5 bomb line, once per visit. Never the board, the pocket 4 magazine or the reservoir.
- **Constraint found in phase 1: the skull's methane is next to the reservoir's.** In the generated world there are two methane bodies: the skull's brain and neck (1805 cells, rows 38 to 156) and the spine with the reservoir (3716 cells from row 158, as close as 8 cells to the block). Only the one-cell stone cap at row 157 (the spine's hull) separates them. A flame cannot cross the cap, but a detonation in the brain is within blast reach (10 cells) of the spine's top, and `checkCircuits` counts that as a chain into the reservoir and fails the build. So spark plugs in the brain are not possible as the scene stands. The bomb teeth are no safer: the methane neck runs down the middle of the mouth and the teeth sit about 5 cells from it, inside blast reach, so detonating them also counts as a chain into the brain and on to the reservoir. Sites that look clear (far from the block and the spine; `checkCircuits` will confirm): the pocket 5 bomb line and the depot's bomb stacks. Options for phase 4: keep ignitions to those sites and the fire-based parts, or restructure the skull (a longer stone neck, teeth moved away from it). This needs a decision before the death machine is built.

As built (phase 4): the skull was restructured and three circuits added, all in `tools/worlds/death-machine.ts`. The electric parts are drawn last (`skullWiring`, `teslaCoil`, `bombLineWiring`). The restructure itself changes the random draws that follow it, so unlike the other two worlds this one differs from the old file in tile color variants and scatter positions (steam, ice, mold) across the whole world as well as in the intended cells (1,807 tiles changed type).

- **Skull restructure**: the neck is now solid stone from the brain's floor to the tower (the methane core down the middle of it is gone), so the brain is a sealed methane body of 1,165 cells (rows 38 to 65, 137 cells from the block) and the spine and reservoir are a separate body of 3,716 cells starting at row 158, 93 rows below it. The bomb teeth moved out to the cheeks (`TEETH_X`, four columns, a top and a bottom row each), 6 or more cells from the neck, and are aligned top to bottom. The head is no taller: the world's top row limits it, so "a longer neck" is a methane-free neck rather than a higher head. The spine now starts at the ground without a methane column above it.
- **Skull circuit**: a generator walled into the neck at rows 140 and 141, a copper trunk up the neck's middle inside the stone, a copper row along the mouth's ceiling touching every top tooth, and two steel spark plugs in the brain's floor with 3 methane cells between their tips. 143 powered cells, 50 ignitable (the brain's contact cells and the teeth), 1,365 cells in the blast chain (the brain and the teeth, two separate chains), none within 12 cells of the board.
- **Bomb line detonator** (pocket 5): a generator in a stone vault at the crane rail's left end powers the crane's rail, rope and hook (the hook touches the hanging bomb), and a copper line down the left wall reaches the first conveyor bomb. The copper stops 3 cells short of the gear, which is steel and touches two conveyor bombs, because the circuit check flagged the leak into it on the first attempt. 270 powered cells, 12 ignitable, 104 in the blast chain (the hook bomb and the five conveyor bombs; the press and the stacks are out of reach).
- **Tesla coil** (the empty meadow left of the stacks, columns 120 to 137): a generator in a stone base, a copper riser with five copper windings round a stone core, and a steel terminal sphere on top that throws arcs. The terminal is the only steel, so an overloaded pulse can only make it glow. 141 powered cells, nothing ignitable.
- Deviations from the plan above: no long copper bus (each weapon has its own sealed generator, because a 400 cell bus would take about 20 s to deliver the first pulse), no electrified right-yard fence (the existing steel fence, pole, flag and drum are one body of about 600 steel tiles, so it would overload within minutes; the tesla coil replaces it), no depot detonator and no fuse countdown. Both can still be added, and `checkCircuits` will say whether the depot is clear.
- Not looked at in the running sim: the order and timing of the teeth, the brain and the pocket 5 detonations, whether the cranium's 6 to 9 cell stone holds around the brain, how much of the skull survives, and the coil's arcs.

## Verification

For each world, in this order:

1. `node tools/make-worlds.ts <world>` passes `checkBoard` and `checkCircuits`, and the electric tile count script shows the expected elements.
2. Each circuit alone in a room (`make-rooms.ts`) and a warm session: pulse crosses, nothing ignites except the declared targets, the sim returns to idle when the generator is the only active thing (a generator keeps its chunk awake; torches and springs already prevent idle in all three worlds, so the cost is no worse).
3. Whole world in the warm session: run a few hundred steps, read the grid, and compare element counts for the board zone (rings, lattice, rail, hall) with the unmodified world. `--png` to look at the render.
4. `npx tsc --noEmit`, `npm run build`, `npm run test:ui`, `npm run test:gpu`, `npm run test:pulse` (now with the copper case). `test:gpu` catches a registry overflow as a failed boot.

Not covered by tests, left to review: pulse colors and flash look, how the death machine's sequence reads, timing of the set pieces.

## Phases

0. Copper: element files, settings ids, rules on the other elements, registry count, `test:pulse` copper case, docs. Render check of the color.
1. Tooling: world-kit ids and colors, `underground.ts` lists, `checkCircuits`, room exports.
2. Farmstead.
3. Alchemist lab.
4. Death machine (largest; its blast constraints need the most sim time).
5. Regenerate the three `.idw` files with `npm run worlds`, update AGENTS.md ("Each places 25+ of the 27 element types", the electricity paragraph, the worlds section, the plans line), mark this plan as built with measured values.

Each phase ends with the checks in Verification step 4.

## Decisions

None open. The earlier open questions are settled: live copper ignites on contact only, copper does not pass heat, the fuse is recolored, and the death machine may destroy the skull and the pocket 5 line each visit but never the board or pocket 4. Copper's blast resistance is 0.95. The farmstead trough switch and the lab's methane spark gap are in scope.
