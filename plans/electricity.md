# Electricity: Live Steel, Arcs, Generators, Shocked Water

Status: proposal, nothing implemented. Every number below is a starting point to be tuned in a running sim.
Scope: 9 new elements (4 pickable, 5 hidden), reaction rules on Steel, Water, Wood, Grass, Charcoal, Bomb and Methane, and **no shader changes**. Everything uses mechanisms that already exist: one-sided reactions, aging with `agedInto`, the emitter (`emitType`), and static aging solids (as `Explosion` is).

Decisions already made:

- Scope: steel conduction, arcs and a generator, plus water conduction, plus overload and switch/insulator parts.
- Pulse speed: visibly traveling, about 10 to 20 cells/s, tunable.
- Overload: heavy current can heat the wire (live steel sometimes ages into hot steel).
- Generator: pulses on its own, forever.
- Conductors: steel and water only. Acid and everything else insulate.
- The default worlds in `tools/worlds/` stay unchanged. Electricity is a playground feature for now.

## The idea

Heat in steel is a loop: steel -> hot steel -> cooling steel -> steel. Cooling steel lasts longer than hot steel and ignores neighbors, so a heat wave runs through once and cannot bounce back.

Electricity is the same loop with a fast, short conducting state:

```
Steel ──(touching Live steel / Arc / Generator)──▶ Live steel
Live steel: ages for about 0.5 s, then ──▶ Spent steel (usually) or Hot steel (rarely, overload)
Spent steel: refractory, ages for about 1 s, ignores neighbors, then ──▶ Steel
```

Spread is a chance per step, not 1, so the pulse is visible. With `p` the spread chance, a pulse on a one-cell-wide wire moves about `60 * p` cells/s (60 steps/s), so `p = 0.2` gives about 12 cells/s. Thicker steel spreads faster because more neighbors roll. Live steel must live long enough that a neighbor almost surely catches before it expires: with 32 steps of life and `p = 0.2`, the chance a neighbor never catches is `0.8^32`, under 0.1%.

Insulators are free: only types with a rule conduct, so stone, wood, ice, sand, rubble, dirt and the rest block a pulse.

## Elements

Next free type ids start at 28 (append only, never renumber).

| Id | Name | Pickable | Kind | Role |
|---|---|---|---|---|
| 28 | Live steel | no | static, aging | The pulse front. Light blue-white, fading to steel grey. |
| 29 | Spent steel | no | static, aging | Refractory stage. Dull blue-grey, returns to steel. |
| 30 | Arc | no | static, aging, `agedInto` air | Short crackle. Emitted by live steel and generators into open air. |
| 31 | Generator | yes | static emitter | Starts pulses in steel touching it, forever. |
| 32 | Shocked water | no | static, aging | Water carrying a pulse. Drawn as pale blue tiles. |
| 33 | Numb water | no | static, aging | Refractory water. Returns to water. |
| 34 | Fuse | yes | static | A conductor that blows after one pulse. |
| 35 | Live fuse | no | static, aging, `agedInto` air | A fuse carrying a pulse; it vanishes when done. |
| 36 | Rubber | yes | static, flammable | Insulation that burns away and exposes the wire. |

### Live steel (28) and Spent steel (29)

- Live steel: `ageRate` about 8 (32 steps, 0.53 s). `agedInto`: Spent steel 0.997, Hot steel 0.003 (the overload chance; chances may add up to at most 1, the rest vanishes, so these two must sum to 1). Reactions: Steel touching Live steel becomes Live steel (the spread rule lives on Steel, see below). `emitType` Arc, `emitChance` about 0.02, `emitBelow` true, so exposed live wire crackles on every side.
- Spent steel: `ageRate` about 4 (64 steps, 1.07 s), so it outlasts Live steel (same rule as `CoolingSteel.AGE_RATE` < `HotSteel.AGE_RATE`). `agedInto` Steel. No reactions, so it neither conducts nor is conducted into. Blast resistance 0.98 like steel.
- Both are hidden. Both blast resistance 0.98.

Rules added to **Steel**:

| with | becomes | chance | note |
|---|---|---|---|
| Live steel | Live steel | `Steel.PULSE_CHANCE` (0.2) | the spread; sets pulse speed |
| Arc | Live steel | 0.5 | an arc landing on a wire starts a pulse |
| Generator | Live steel | `Steel.GENERATOR_CHANCE` (0.01) | per touching tile per step |
| Live fuse | Live steel | `Steel.PULSE_CHANCE` | fuses feed wires |

Hot steel, cooling steel and spent steel carry no rule for pulses, so heated or just-used sections are gaps in the wire.

### Overload

The Hot steel outcome is the whole mechanism. A pulse crosses each tile once, so with `n` wire tiles a pulse produces about `0.003 * n` hot tiles. At 100 tiles that is about 0.3 per pulse, so a busy wire glows within a few pulses. The tuning risk is the opposite of too weak: at 0.03 a 100-tile wire would heat 3 tiles per pulse. Tune it by watching a generator on a long wire.

A hot tile in a one-cell-wide wire breaks it for about 17 s (hot 7 s plus cooling 10 s), so an overloaded thin wire fails on its own. Thick wires route around it.

### Arc (30)

- Static aging solid like `Explosion`: `ageRate` about 32 (8 steps, 0.13 s), `agedInto` air by default, white to pale blue ramp. No shader work.
- Painting is not available (hidden), so arcs only come from live steel and generators.
- Reactions on other elements name Arc: Steel (above), Water (shocks it, below), plus ignition rules:

| Owner | with Arc becomes | chance | note |
|---|---|---|---|
| Wood | Ember | 0.03 | below `SPARK_IGNITE_CHANCE`, arcs are brief |
| Grass | Ember | 0.05 | |
| Charcoal | Ember | 0.03 | |
| Bomb | Explosion | 0.3 | live steel detonates bombs too, so a wire is a fast detonator |
| Methane | Flame | 0.3 | plus the existing rare `DETONATE_CHANCE` path for big pockets |

Live steel itself touching Bomb, Methane, Wood, Grass or Charcoal uses the same rules (name Live steel as `with` next to Arc).

### Generator (31)

- Static, pickable, not flammable, like Torch. `emitType` Arc, `emitChance` about 0.02, `emitBelow` true. It keeps its chunk awake, so a generator on screen prevents idle, as Spring and Torch do.
- Steel touching it turns live at `Steel.GENERATOR_CHANCE` per tile per step. After the pulse the tile passes through the spent stage (about 1 s) and then can fire again, so a single touching tile pulses about every 2 to 3 s. More touching tiles pulse sooner.
- Metallic color with a small variant spread, distinct from steel (a darker blue-grey with a yellow-tinged edge variant).

### Shocked water (32) and Numb water (33)

Water cannot age (`mainLiquid` does not age), so the pulse rides on static solids instead.

- Shocked water: static aging solid colored like pale water, `ageRate` about 16 (16 steps). `agedInto` Numb water. Hidden.
- Numb water: static aging solid colored like water, `ageRate` about 12 (21 steps), so it outlasts Shocked water. `agedInto` Water. No reactions. Hidden.
- Rules added to **Water**:

| with | becomes | chance |
|---|---|---|
| Live steel | Shocked water | `Water.CONDUCT_CHANCE` (0.35) |
| Live fuse | Shocked water | `Water.CONDUCT_CHANCE` |
| Shocked water | Shocked water | `Water.CONDUCT_CHANCE` |
| Arc | Shocked water | 0.35 |

- Steel touching Shocked water also goes live, so a pool carries a pulse from one wire to another (add `{ with: Shocked water, becomes: Live steel, chance: Steel.PULSE_CHANCE }` to Steel, and the same to Fuse).
- Known cost: while a pulse crosses a pool, tiles of water become frozen solids for about 0.3 s (shocked, then numb). Tiles above cannot flow into them in that time. The pulse is short and the pool is a ring of frozen tiles that moves outward, so it should read as a flash, but check it in the sim. If it looks bad, lower the lifetimes or the spread chance.
- The pool haze counts water occupancy, so shocked tiles punch a short hole in the smooth body that the tiles fill with a flash color. This is the intended look.
- Water touching steel never conducts by itself. Only live metal, an arc or already shocked water starts it.
- Emergent water switch: two steel ends with a gap between them conduct only when water fills the gap. No extra element needed.

### Fuse (34) and Live fuse (35)

A one-shot breaker.

- Fuse: static, pickable, a copper-orange conductor. Rules: Live steel, Live fuse and Shocked water turn it into Live fuse at the usual spread chance. Touching Hot steel, flame or ember burns it into a flame (it is flammable, `flammable` true).
- Live fuse: static aging, `ageRate` about 12, `agedInto` air, so the tile disappears after carrying its pulse and leaves a gap. Hidden. It feeds Steel and Water as shown above. No refractory is needed because the tile is gone afterward.
- Use: a safety link that opens a circuit permanently, or a one-shot trigger before a detonator.

### Rubber (36)

Insulation that can be removed.

- Static, pickable, flammable. Touching a flame, ember, spark or hot steel it turns into a flame at a small chance, which then ages into smoke. It has no rules for electricity, so it blocks pulses.
- Use: coat a wire, then burn the coating off to expose it.

## Insulator and switch toolbox

What the rule system supports, and what it does not.

Available now (emergent, no extra code):

- **Insulation**: any material without a pulse rule. Rubber burns away; stone does not; ice melts into water, which does conduct.
- **Water bridge switch**: a gap between two wires closes when water fills it.
- **Thermal switch**: an ice plug in a gap blocks the circuit; heat melts it into water, which closes the circuit (and can then carry a pulse).
- **Acid cutter**: acid dissolves steel, so it cuts a wire permanently.
- **Fuse breaker**: described above.

Not possible without shader changes:

- **Diode / one-way wire**, **latched relay**: reactions are symmetric over the 8 neighbors and tiles carry no direction or signal memory, so a direction cannot be expressed.
- **Lightning from the sky**: needs a path-tracing function like `updateSpark`.

A later addition, not in this plan: a **delay element** (a pulse in produces a pulse out after a few seconds) built from three hidden elements. It would oscillate on a wire that touches both its input and output unless it gets its own refractory stage, so it needs a design pass of its own.

## Engine and code changes

All data and registration. No `COMPUTE_WGSL`, `RENDER_WGSL`, buffer or `TypeInfo` changes.

1. `src/settings.ts`: add `LIVE_STEEL_TYPE` 28 through `RUBBER_TYPE` 36.
2. `src/elements/`: nine new files, scaffolded with `new-element.bat`, then filled in. Register them in `src/elements/index.ts`.
3. Edit existing elements' reaction tables: Steel, Water, Wood, Grass, Charcoal, Bomb, Methane.
4. Reaction budget: about 63 rules exist now and the limit is `MAX_REACTIONS` = 128. This adds roughly 25 (Steel 5, Water 4, Fuse 4, Wood/Grass/Charcoal/Bomb/Methane 2 each for Arc and Live steel, Live steel/Arc/Live fuse ignition, Rubber 4), so it fits, but count after writing.
5. Registry rule: the registry rejects two elements with consuming rules where one consumes the other. None of these rules set `consumes`.
6. `AGENTS.md`: add a Steel / electricity entry to the Architecture section and the file map.
7. `tools/worlds/underground.ts` `finishBoard`: the list of things that act on their own around the chips should include Generator, and the hidden electric types if the check lists types by id. The shipped worlds do not contain any of these, so it should only matter if a world is regenerated with them.
8. `src/ui/tile-art.ts` and any picker previews: check how pickable elements get their art.

## Risks and things to verify in the sim

- Pulse speed and length: `PULSE_CHANCE`, live lifetime and spent lifetime interact. Live must outlast the time a neighbor needs to catch; spent must outlast live plus the neighbor delay, or the pulse bounces.
- Does an idle sim stay idle once a generator is removed? Aging tiles keep their chunks awake only while they exist.
- Pools: how the frozen-tile flash looks, and whether tiles above a pulse get stuck for too long.
- Overload rate: see above. Check also that Hot steel appearing inside live wire does not break the pulse in confusing ways on thick plates.
- Thick steel: spread chance applies per neighbor, so a 7-wide bar conducts noticeably faster than a 1-wide wire. That matches heat, but it could surprise.
- Painted Live steel: the picker hides these, but world files saved from a session that contained them store the ids. Ids are stable, so loading such a file works.

## Phases

1. Steel conduction: Live steel, Spent steel, Steel rules, a Generator, temporary Arc. Tune speed on a long wire. Check idle.
2. Arc ignition: rules on Wood, Grass, Charcoal, Bomb, Methane. Test a wire to a bomb and a wire in a methane pocket.
3. Overload: add the Hot steel outcome and tune.
4. Water: Shocked and Numb water, Water rules, pool tests.
5. Switch parts: Fuse, Live fuse, Rubber.
6. Docs: update `AGENTS.md`, mark this plan implemented with deviations.
