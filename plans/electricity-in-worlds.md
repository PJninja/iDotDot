# Electricity in the shipped worlds

Status: phase 0 (copper) built, the rest is plan. Phase 0 was checked statically (type check, registry rule count 119 of 128, outcomes 18 of 32) and with the test suites; the simulation was not run by hand. Follows `plans/electricity.md` (implemented), which left the three default worlds unchanged on purpose. Checked on 2026-10-13: `src/worlds/alchemist-lab.idw`, `farmstead.idw` and `death-machine.idw` contain no tile of types 28 to 36, and no scene script names an electric element.

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
| Conducts a pulse (same timings: live 32 steps, spent 64) | yes | yes |
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
4. A small node script (not shipped as a test) that decodes the three `.idw` files and counts electric tiles, used in the checks below.

## Farmstead: low electricity

Hooks already in the scene: `windmill()` (steel hub disc at about (305, 114)), `barn()`, the two `sheep()` on the orchard side, `field()`, `pond()`, the boiler hall (springs, torches).

- A small generator at the windmill's foot, housed in stone so its arcs land on stone. A copper line leaves it, supported on rubber stand-offs (the first use of rubber in any world), and runs to an electric fence round the sheep or the field edge.
- The fence wire is copper at least 3 cells above the ground: grass covers the surface, and copper ignites grass on contact. Posts are stone or ice, not wood. Nothing flammable touches the line.
- The visible result is a blue-white pulse traveling the fence every few seconds. No ignition, no water on the circuit. Keep it away from the pond and the boiler hall's water and steel.
- **Water-trough switch**: a gap in the fence line with a stone trough across it. The pulse passes only while the trough holds water, since water conducts between the two copper ends. Water here means the pulse also shocks the trough (a flash). Keep the trough clear of the pond and give it a feed that keeps it full (a spring or the field drain) without letting it reach the rest of the line. `checkCircuits` lists the trough water as part of this circuit and must show it touches nothing else.

## Alchemist lab: testing and combining

Hooks already in the scene: the acid lab room (a race between seven samples in acid), the distillery, the forge, the cold cellar, the gas cellar.

- **Conductivity bench** beside the acid lab's sample race: a generator in a stone box feeds copper leads to a row of test gaps. Each gap holds one sample between two copper electrodes: steel and water (in a glass tube) pass the pulse on, rubber, stone and ice stop it, and a fuse passes it once and is gone for the rest of the visit. A lit copper tail after each gap shows the result. Wood and other flammables stay off the bench (copper ignites them on contact).
- **Electrolysis jar**: two copper electrodes in a glass (ice) jar of water. Each pulse shocks the water into a flash, the "combining" beat.
- **Spark gap (one-shot)**: two steel electrodes in a sealed stone box in the gas cellar, set to light the methane there once per visit. The sealed volume must be small enough that the blast stays in the cellar; check it in the room sim, and shrink the box or thin the gas if it does not. This uses steel on purpose, since the arcs are the point.
- Keep every circuit off the cistern's steel anchor, the distillery's torches and the forge's hot steel.

## Death machine: electricity as weapon and ignition

Hooks already in the scene: the skull tower (methane brain, torch eyes, bomb teeth), the acid tower, the depot, the right yard's spiked steel fence and acid moat, the furnace hall (pocket 2), the reservoir and magazine (pocket 4), the bomb line (pocket 5). The methane spine already uses rows around `DUCT_Y` 184 and `SPINE_X` 438, so the power bus uses other rows.

- **Power room**: a bank of generators in a stone vault (furnace hall side), copper bus running through the rock above the chips (rows about 170 to 197, clear of the methane duct) to the machine's parts. Copper because the bus runs hundreds of cells and never overloads.
- **Electrified fence**: the right yard's steel spikes joined to the bus. Steel here is deliberate: arcs crackle along the fence and across the moat gap.
- **Ignition**: spark-plug electrodes (steel, with a gap) in the skull's methane brain and at the bomb teeth, so the head flashes and detonates. At least one trigger is a fuse run, which gives a one-time sequence: each fuse tile is spent after its pulse, so the countdown runs once per visit.
- **Bomb line**: a detonator wire to the conveyor bombs in pocket 5, which is 65 or more cells from the hall. Cap the chain at pocket 5 and the skull; do not wire the pocket 4 magazine or the reservoir, which sit next to the hall.
- The lattice (steel) and the gallery rail (steel) stay unconnected; `checkCircuits` enforces it.
- Timing: the generator's own chance starts the first pulse, with no fuse delay for it. That chance is 0.002 per step per touching tile, so on the order of seconds, not instant, and a pulse needs about 5 s to cross 100 cells. Measure the time to first ignition in a room, and add generators or touching tiles if it is too slow.
- Destruction is allowed for the skull and the pocket 5 bomb line, once per visit. Never the board, the pocket 4 magazine or the reservoir.

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
