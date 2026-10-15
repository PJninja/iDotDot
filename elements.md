# Elements

All 53 registered elements, generated from the element registry (`src/elements/index.ts`) by `npm run elements`. Type ids are stable: never renumber them, or saved `.idw` worlds corrupt. Air is type 0.

## Properties

How to read the columns:
- **Kind**: `static` solids never move, `powder` solids fall in `main`, `liquid` and `gas` run in `mainLiquid` and `mainGas`.
- **In picker**: hidden elements are internal stages (aging, pulses, blasts) that no brush can place.
- **Density**: a tile sinks through liquids and gases that are lighter. Water is 1.
- **Fall**: effective fall rate in cells per sim step (60 steps per second), for powders only.
- **Slide**: chance a powder on a slope rolls off (1 = no friction).
- **Cohesion**: chance a powder clings to cohesive neighbors instead of falling or rolling.
- **Rise** and **Dissipates**: gases only, chance per step to rise one cell or to vanish.
- **Age rate**: age steps per sim step (age runs 0 to 255, so the mean life is about 256 / rate steps).
- **Ages into**: outcomes once the age passes 255, rolled in order.
- **Emits**: an empty cell beside or above this element pulls in that tile at the chance per step, without using the emitter up.
- **Blast resist.**: chance per step a tile holds against an adjacent explosion, raised to the blast's power times `Explosion.SHATTER`.
- **Flags**: `blast power` is the size of the blast an explosive sets off (1 is about 20 cells of reach in air), `glow` how strongly a tile lights its surroundings, `thrown` that a blast's outer part throws the tile as debris that lands as itself (or as the named type).

| Type | Element | Kind | In picker | Color | Density | Fall (cells/step) | Slide | Cohesion | Rise | Dissipates | Drawn as | Age rate | Ages into | Emits | Blast resist. | Flags |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Air | static | yes | `#000000` |  |  |  |  |  |  | tiles |  |  |  |  |  |
| 1 | Sand | powder | yes | `#c2b280` | 1.5 | 3 | 1 |  |  |  | tiles |  |  |  | 0.2 | thrown |
| 2 | Dirt | powder | yes | `#866043` | 1.5 | 4 | 0.25 |  |  |  | tiles |  |  |  | 0.35 | thrown |
| 3 | Wood | static | yes | `#8b5a36` |  |  |  |  |  |  | tiles |  |  |  | 0.3 | flammable, thrown as Charcoal |
| 4 | Smoke | gas | yes | `#96969e` | 0.2 |  |  |  | 0.35 | 0.2% | smoke |  |  |  |  |  |
| 5 | Water | liquid | yes | `#3478c8` | 1 |  |  |  |  |  | water |  |  |  | 0.75 | thrown |
| 6 | Steam | gas | yes | `#eef2f8` | 0.1 |  |  |  | 0.5 | 0.06% | steam |  |  |  |  |  |
| 7 | Wet Sand | powder | hidden | `#968458` | 1.8 | 3 | 0.3 | 0.85 |  |  | tiles |  |  |  | 0.5 | thrown |
| 8 | Mud | powder | hidden | `#5c402c` | 1.8 | 4 | 0.15 | 0.9 |  |  | tiles |  |  |  | 0.5 | thrown |
| 9 | Ember | powder | hidden | `#f06e1e` | 1.5 | 1.5 | 0.4 | 0.8 |  |  | tiles | 0.4 | Charcoal 10%, Ash 25%, else gone | Flame 0.6% | 0.3 | holds on flammable, glow 0.5 |
| 10 | Flame | gas | yes | `#ffa028` | 0.25 |  |  |  | 0.8 |  | tiles | 8 | Smoke 80%, Spark 3%, else gone |  |  | fuel fed, glow 0.6 |
| 11 | Spark | gas | hidden | `#ffe078` | 0.3 |  |  |  | 0 |  | tiles | 6 | gone |  |  | glow 0.7 |
| 12 | Explosion | static | hidden | `#ffbe46` |  |  |  |  |  |  | tiles | 20 | Scorch 100% |  |  | glow 1 |
| 13 | Bomb | static | yes | `#3e3e48` |  |  |  |  |  |  | tiles |  |  |  |  | flammable, blast power 2.5 |
| 14 | Charcoal | powder | yes | `#262428` | 1.5 | 3 | 0.3 |  |  |  | tiles |  |  |  | 0.2 | flammable, thrown |
| 15 | Stone | static | yes | `#767470` |  |  |  |  |  |  | tiles |  |  |  | 0.9 | thrown as Rubble |
| 16 | Grass | powder | yes | `#4a8e34` | 1.5 | 3 | 0.08 |  |  |  | tiles |  |  |  | 0.1 | flammable, thrown |
| 17 | Steel | static | yes | `#9ea8b6` |  |  |  |  |  |  | tiles |  |  |  | 0.98 | thrown as Rubble |
| 18 | Hot Steel | static | hidden | `#ff963c` |  |  |  |  |  |  | tiles | 0.6 | Cooling Steel 100% |  | 0.98 | glow 0.35 |
| 19 | Cooling Steel | static | hidden | `#963c28` |  |  |  |  |  |  | tiles | 0.4 | Steel 100% |  | 0.98 |  |
| 20 | Acid | liquid | yes | `#8cd630` | 1.2 |  |  |  |  |  | tiles |  |  |  | 0.75 | thrown |
| 21 | Ice | static | yes | `#b0e0f8` |  |  |  |  |  |  | tiles |  |  |  | 0.2 | thrown as Water |
| 22 | Methane | gas | yes | `#bcd668` | 0.08 |  |  |  | 0.6 | 0.03% | methane |  |  |  |  | blast power 1 |
| 23 | Mold | static | yes | `#60a88c` |  |  |  |  |  |  | tiles | 0.12 | Dirt 100% |  | 0.1 | flammable |
| 24 | Ash | powder | yes | `#949296` | 1.3 | 2 | 0.7 |  |  |  | tiles |  |  |  | 0.05 | thrown |
| 25 | Rubble | powder | yes | `#706862` | 1.8 | 3 | 0.2 |  |  |  | tiles |  |  |  | 0.4 | thrown |
| 26 | Spring | static | yes | `#4a84c4` |  |  |  |  |  |  | tiles |  |  | Water 12% (also below) | 0.9 |  |
| 27 | Torch | static | yes | `#c4702c` |  |  |  |  |  |  | tiles |  |  | Flame 5% | 0.3 |  |
| 28 | Live Steel | static | hidden | `#96cdff` |  |  |  |  |  |  | tiles | 8 | Spent Steel 100%, Hot Steel 0.05% | Arc 1% (also below) | 0.98 | glow 0.3 |
| 29 | Spent Steel | static | hidden | `#4a5e86` |  |  |  |  |  |  | tiles | 4 | Steel 100% |  | 0.98 |  |
| 30 | Arc | static | hidden | `#c8e6ff` |  |  |  |  |  |  | tiles | 32 | gone |  |  | glow 0.9 |
| 31 | Generator | static | yes | `#5c6aa8` |  |  |  |  |  |  | tiles |  |  | Arc 0.2% (also below) | 0.5 |  |
| 32 | Shocked Water | static | hidden | `#c8ecff` |  |  |  |  |  |  | water | 16 | Numb Water 100% |  | 0.75 |  |
| 33 | Numb Water | static | hidden | `#3a78c4` |  |  |  |  |  |  | water | 10 | Water 100% |  | 0.75 |  |
| 34 | Fuse | static | yes | `#bea470` |  |  |  |  |  |  | tiles |  |  |  | 0.3 |  |
| 35 | Live Fuse | static | hidden | `#ffd696` |  |  |  |  |  |  | tiles | 12 | gone |  | 0.3 |  |
| 36 | Rubber | static | yes | `#42303a` |  |  |  |  |  |  | tiles |  |  |  | 0.3 | flammable |
| 37 | Copper | static | yes | `#b8683e` |  |  |  |  |  |  | tiles |  |  |  | 0.95 | thrown as Rubble |
| 38 | Live Copper | static | hidden | `#ffe2be` |  |  |  |  |  |  | tiles | 8 | Spent Copper 100% |  | 0.95 | glow 0.25 |
| 39 | Spent Copper | static | hidden | `#704232` |  |  |  |  |  |  | tiles | 3 | Copper 100% |  | 0.95 |  |
| 40 | Bark | static | yes | `#684c38` |  |  |  |  |  |  | tiles |  |  |  | 0.35 | flammable, thrown as Charcoal |
| 41 | Charred Bark | static | hidden | `#281e1c` |  |  |  |  |  |  | tiles | 0.4 | Ember 45%, Charcoal 30%, Ash 15%, else gone |  | 0.15 | thrown as Charcoal |
| 42 | Leaves | static | yes | `#387a30` |  |  |  |  |  |  | tiles |  |  |  | 0.05 | flammable, thrown as Ash |
| 43 | Powered Torch | static | yes | `#625248` |  |  |  |  |  |  | tiles |  |  |  | 0.3 |  |
| 44 | Lit Torch | static | hidden | `#e28a38` |  |  |  |  |  |  | tiles | 1 | Powered Torch 100% | Flame 5% | 0.3 |  |
| 45 | Lit Torch | static | hidden | `#e28a38` |  |  |  |  |  |  | tiles | 1 | Powered Torch 100% | Flame 5% | 0.3 |  |
| 46 | Powered Spring | static | yes | `#485a70` |  |  |  |  |  |  | tiles |  |  |  | 0.9 |  |
| 47 | Live Spring | static | hidden | `#6cbeff` |  |  |  |  |  |  | tiles | 1 | Powered Spring 100% | Water 12% (also below) | 0.9 |  |
| 48 | Live Spring | static | hidden | `#6cbeff` |  |  |  |  |  |  | tiles | 1 | Powered Spring 100% | Water 12% (also below) | 0.9 |  |
| 49 | Oil | liquid | yes | `#16110c` | 0.8 |  |  |  |  |  | tiles |  |  |  | 0.1 | flammable, thrown |
| 50 | Void | static | yes | `#10081a` |  |  |  |  |  |  | tiles |  |  |  | 0.99 |  |
| 51 | Debris | static | hidden | `#706862` |  |  |  |  |  |  | tiles |  |  |  |  |  |
| 52 | Scorch | static | hidden | `#5a281e` |  |  |  |  |  |  | tiles | 20 | Smoke 40%, Flame 3%, else gone |  |  |  |

## Reactions

173 one-sided rules. A tile of the element in the first column that touches a `with` tile (8 neighbors, or within `radius` cells) becomes the result at that chance per step. **Consumes** means the touched tile turns into air at the same time.

| Element | Touching | Becomes | Chance | Consumes | Radius |
| --- | --- | --- | --- | --- | --- |
| Sand | Water | Wet Sand | 10% | yes |  |
| Sand | Water | Wet Sand | 8% |  | 4 |
| Dirt | Water | Mud | 10% | yes |  |
| Dirt | Water | Mud | 8% |  | 4 |
| Wood | Flame | Ember | 1.2% |  |  |
| Wood | Ember | Ember | 0.25% |  |  |
| Wood | Spark | Ember | 10% |  |  |
| Wood | Hot Steel | Ember | 0.4% |  |  |
| Wood | Arc | Ember | 3% |  |  |
| Wood | Live Steel | Ember | 0.4% |  |  |
| Wood | Live Copper | Ember | 0.4% |  |  |
| Wood | Mold | Mold | 0.12% |  |  |
| Water | Ember | Steam | 10% |  |  |
| Water | Hot Steel | Steam | 15% |  |  |
| Water | Ice | Ice | 0.6% |  |  |
| Water | Live Steel | Shocked Water | 35% |  |  |
| Water | Live Copper | Shocked Water | 35% |  |  |
| Water | Live Fuse | Shocked Water | 35% |  |  |
| Water | Shocked Water | Shocked Water | 35% |  |  |
| Water | Arc | Shocked Water | 35% |  |  |
| Steam | Ice | Water | 5% |  |  |
| Wet Sand | Flame | Sand | 4% |  | 2 |
| Wet Sand | Ember | Sand | 4% |  | 2 |
| Wet Sand | Spark | Sand | 30% |  |  |
| Wet Sand | Hot Steel | Sand | 10% |  |  |
| Mud | Flame | Dirt | 3% |  | 2 |
| Mud | Ember | Dirt | 3% |  | 2 |
| Mud | Spark | Dirt | 30% |  |  |
| Mud | Hot Steel | Dirt | 10% |  |  |
| Mud | Acid | Dirt | 10% |  |  |
| Mud | Water | Mud | 100% |  |  |
| Mud | Grass | Grass | 0.2% |  |  |
| Ember | Air | Flame | 1% |  |  |
| Ember | Air | Spark | 0.05% |  |  |
| Ember | Water | Air (vanishes) | 30% |  |  |
| Flame | Water | Air (vanishes) | 80% |  |  |
| Spark | Water | Air (vanishes) | 100% |  |  |
| Bomb | Explosion | Explosion | 40% |  |  |
| Bomb | Flame | Explosion | 5% |  |  |
| Bomb | Ember | Explosion | 3% |  |  |
| Bomb | Spark | Explosion | 30% |  |  |
| Bomb | Hot Steel | Explosion | 2% |  |  |
| Bomb | Arc | Explosion | 30% |  |  |
| Bomb | Live Steel | Explosion | 10% |  |  |
| Bomb | Live Copper | Explosion | 10% |  |  |
| Charcoal | Flame | Ember | 0.4% |  |  |
| Charcoal | Ember | Ember | 0.1% |  |  |
| Charcoal | Spark | Ember | 5% |  |  |
| Charcoal | Hot Steel | Ember | 0.3% |  |  |
| Charcoal | Arc | Ember | 3% |  |  |
| Charcoal | Live Steel | Ember | 0.4% |  |  |
| Charcoal | Live Copper | Ember | 0.4% |  |  |
| Grass | Mold | Mold | 0.8% |  |  |
| Grass | Flame | Ember | 8% |  |  |
| Grass | Ember | Ember | 3% |  |  |
| Grass | Spark | Ember | 30% |  |  |
| Grass | Hot Steel | Ember | 5% |  |  |
| Grass | Arc | Ember | 5% |  |  |
| Grass | Live Steel | Ember | 1% |  |  |
| Grass | Live Copper | Ember | 1% |  |  |
| Grass | Air | Grass | 100% |  |  |
| Grass | Water | Mud | 0.2% |  |  |
| Steel | Flame | Hot Steel | 2% |  |  |
| Steel | Ember | Hot Steel | 1% |  |  |
| Steel | Spark | Hot Steel | 10% |  |  |
| Steel | Hot Steel | Hot Steel | 3% |  |  |
| Steel | Live Steel | Live Steel | 20% |  |  |
| Steel | Live Copper | Live Steel | 20% |  |  |
| Steel | Live Fuse | Live Steel | 20% |  |  |
| Steel | Shocked Water | Live Steel | 20% |  |  |
| Steel | Arc | Live Steel | 15% |  |  |
| Steel | Generator | Live Steel | 0.2% |  |  |
| Hot Steel | Water | Cooling Steel | 15% |  |  |
| Acid | Stone | Smoke | 1.5% | yes |  |
| Acid | Steel | Smoke | 0.6% | yes |  |
| Acid | Hot Steel | Smoke | 0.6% | yes |  |
| Acid | Cooling Steel | Smoke | 0.6% | yes |  |
| Acid | Live Steel | Smoke | 0.6% | yes |  |
| Acid | Spent Steel | Smoke | 0.6% | yes |  |
| Acid | Copper | Smoke | 0.6% | yes |  |
| Acid | Live Copper | Smoke | 0.6% | yes |  |
| Acid | Spent Copper | Smoke | 0.6% | yes |  |
| Acid | Wood | Smoke | 4% | yes |  |
| Acid | Bark | Smoke | 4% | yes |  |
| Acid | Charred Bark | Smoke | 8% | yes |  |
| Acid | Leaves | Smoke | 15% | yes |  |
| Acid | Charcoal | Smoke | 8% | yes |  |
| Acid | Grass | Smoke | 15% | yes |  |
| Acid | Mold | Smoke | 12% | yes |  |
| Acid | Water | Water | 0.5% |  |  |
| Acid | Mud | Smoke | 10% |  |  |
| Ice | Flame | Water | 3% |  | 2 |
| Ice | Ember | Water | 3% |  | 2 |
| Ice | Spark | Water | 30% |  |  |
| Ice | Hot Steel | Water | 8% |  |  |
| Methane | Flame | Explosion | 0.4% |  |  |
| Methane | Flame | Flame | 50% |  |  |
| Methane | Ember | Flame | 10% |  |  |
| Methane | Spark | Flame | 70% |  |  |
| Methane | Hot Steel | Flame | 5% |  |  |
| Methane | Arc | Flame | 30% |  |  |
| Methane | Live Steel | Flame | 10% |  |  |
| Methane | Live Copper | Flame | 10% |  |  |
| Mold | Flame | Ember | 0.8% |  |  |
| Mold | Ember | Ember | 0.2% |  |  |
| Mold | Spark | Ember | 5% |  |  |
| Mold | Air | Methane | 0.03% |  |  |
| Fuse | Live Steel | Live Fuse | 20% |  |  |
| Fuse | Live Copper | Live Fuse | 20% |  |  |
| Fuse | Live Fuse | Live Fuse | 20% |  |  |
| Fuse | Shocked Water | Live Fuse | 20% |  |  |
| Fuse | Flame | Air (vanishes) | 3% |  |  |
| Fuse | Ember | Air (vanishes) | 3% |  |  |
| Fuse | Hot Steel | Air (vanishes) | 3% |  |  |
| Rubber | Flame | Flame | 2% |  |  |
| Rubber | Ember | Flame | 1% |  |  |
| Rubber | Spark | Flame | 20% |  |  |
| Rubber | Hot Steel | Flame | 1% |  |  |
| Copper | Live Copper | Live Copper | 20% |  |  |
| Copper | Live Steel | Live Copper | 20% |  |  |
| Copper | Live Fuse | Live Copper | 20% |  |  |
| Copper | Shocked Water | Live Copper | 20% |  |  |
| Copper | Arc | Live Copper | 15% |  |  |
| Copper | Generator | Live Copper | 0.2% |  |  |
| Bark | Flame | Charred Bark | 2% |  |  |
| Bark | Ember | Charred Bark | 0.6% |  |  |
| Bark | Spark | Charred Bark | 10% |  |  |
| Bark | Hot Steel | Charred Bark | 0.4% |  |  |
| Bark | Arc | Charred Bark | 3% |  |  |
| Bark | Live Steel | Charred Bark | 0.4% |  |  |
| Bark | Live Copper | Charred Bark | 0.4% |  |  |
| Bark | Charred Bark | Charred Bark | 0.15% |  |  |
| Bark | Mold | Mold | 0.06% |  |  |
| Leaves | Flame | Flame | 6% |  |  |
| Leaves | Flame | Ash | 1% |  |  |
| Leaves | Ember | Flame | 3% |  |  |
| Leaves | Spark | Flame | 30% |  |  |
| Leaves | Hot Steel | Flame | 5% |  |  |
| Leaves | Arc | Flame | 5% |  |  |
| Leaves | Live Steel | Flame | 1% |  |  |
| Leaves | Live Copper | Flame | 1% |  |  |
| Leaves | Mold | Mold | 0.4% |  |  |
| Powered Torch | Live Steel | Lit Torch | 20% |  |  |
| Powered Torch | Live Copper | Lit Torch | 20% |  |  |
| Powered Torch | Live Fuse | Lit Torch | 20% |  |  |
| Powered Torch | Shocked Water | Lit Torch | 20% |  |  |
| Lit Torch | Live Steel | Lit Torch | 20% |  |  |
| Lit Torch | Live Copper | Lit Torch | 20% |  |  |
| Lit Torch | Live Fuse | Lit Torch | 20% |  |  |
| Lit Torch | Shocked Water | Lit Torch | 20% |  |  |
| Lit Torch | Live Steel | Lit Torch | 20% |  |  |
| Lit Torch | Live Copper | Lit Torch | 20% |  |  |
| Lit Torch | Live Fuse | Lit Torch | 20% |  |  |
| Lit Torch | Shocked Water | Lit Torch | 20% |  |  |
| Powered Spring | Live Steel | Live Spring | 20% |  |  |
| Powered Spring | Live Copper | Live Spring | 20% |  |  |
| Powered Spring | Live Fuse | Live Spring | 20% |  |  |
| Powered Spring | Shocked Water | Live Spring | 20% |  |  |
| Live Spring | Live Steel | Live Spring | 20% |  |  |
| Live Spring | Live Copper | Live Spring | 20% |  |  |
| Live Spring | Live Fuse | Live Spring | 20% |  |  |
| Live Spring | Shocked Water | Live Spring | 20% |  |  |
| Live Spring | Live Steel | Live Spring | 20% |  |  |
| Live Spring | Live Copper | Live Spring | 20% |  |  |
| Live Spring | Live Fuse | Live Spring | 20% |  |  |
| Live Spring | Shocked Water | Live Spring | 20% |  |  |
| Oil | Flame | Flame | 50% |  | 3 |
| Oil | Ember | Flame | 20% |  |  |
| Oil | Spark | Flame | 80% |  |  |
| Oil | Hot Steel | Flame | 8% |  |  |
| Oil | Arc | Flame | 40% |  |  |
| Oil | Live Steel | Flame | 5% |  |  |
| Oil | Live Copper | Flame | 5% |  |  |
