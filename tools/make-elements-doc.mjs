// Writes elements.md (every element's properties and reactions) from the element registry.
// Run with `npm run elements`; rerun after changing an element so the doc matches the code.
// The registry is loaded through a throwaway Vite server because the sources import
// without file extensions, which plain Node cannot resolve.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = fileURLToPath(new URL('../elements.md', import.meta.url));
const HAZE_NAMES = ['smoke', 'water', 'steam', 'methane'];
const AIR_TYPE = 0;
const NO_FRAGMENT = 255;

const server = await createServer({
  root,
  configFile: false,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true },
});

try {
  const { createElementRegistry } = await server.ssrLoadModule('/src/elements/index.ts');
  const elements = createElementRegistry().list().slice().sort((a, b) => a.type - b.type);
  writeFileSync(out, render(elements));
  const reactionCount = elements.reduce((n, e) => n + e.reactions.length, 0);
  console.log(`elements.md: ${elements.length} elements, ${reactionCount} reactions`);
} finally {
  await server.close();
}

function render(elements) {
  const nameOf = (type) => elements.find((e) => e.type === type)?.displayName ?? `#${type}`;
  const percent = (n) => `${Number((n * 100).toPrecision(3))}%`;
  const num = (n) => String(Number(n.toPrecision(3)));
  const hex = (c) => '`#' + c.map((v) => v.toString(16).padStart(2, '0')).join('') + '`';
  const table = (head, rows) => [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');

  const properties = elements.map((e) => {
    const isGas = e.phase === 'gas';
    const falls = e.gravityQuantum > 0;
    const kind = e.phase === 'solid' ? (falls ? 'powder' : 'static') : e.phase;
    const thrown = e.thrownAs === e.type ? 'thrown' : e.thrownAs !== NO_FRAGMENT && `thrown as ${nameOf(e.thrownAs)}`;
    const flags = [
      e.flammable && 'flammable', e.holdsOnFlammable && 'holds on flammable', e.fuelFed && 'fuel fed',
      e.blastPower > 0 && `blast power ${num(e.blastPower)}`, e.glow > 0 && `glow ${num(e.glow)}`, thrown,
    ].filter(Boolean).join(', ');
    const outcomes = e.agedInto.length === 0
      ? 'gone'
      : e.agedInto.map((o) => `${nameOf(o.type)} ${percent(o.chance)}`).join(', ')
        + (e.agedInto.reduce((n, o) => n + o.chance, 0) < 1 - 1e-9 ? ', else gone' : '');
    const emits = e.emitType !== AIR_TYPE && e.emitChance > 0
      ? `${nameOf(e.emitType)} ${percent(e.emitChance)}${e.emitBelow ? ' (also below)' : ''}`
      : '';
    return [
      e.type, e.displayName, kind, e.hidden ? 'hidden' : 'yes', hex(e.defaultColor),
      isGas || e.phase === 'liquid' || falls ? num(e.density) : '',
      falls ? num(e.gravityQuantum / 256) : '',
      falls ? num(e.slideChance) : '',
      e.cohesion > 0 ? num(e.cohesion) : '',
      isGas ? num(e.riseSpeed) : '',
      isGas && e.dissipationChance > 0 ? percent(e.dissipationChance) : '',
      e.hazeChannel === null ? 'tiles' : HAZE_NAMES[e.hazeChannel],
      e.ageRate > 0 ? num(e.ageRate) : '',
      e.ageRate > 0 ? outcomes : '',
      emits,
      e.blastResistance > 0 ? num(e.blastResistance) : '',
      flags,
    ];
  });

  const reactions = elements.flatMap((e) => e.reactions.map((r) => [
    e.displayName,
    r.with === AIR_TYPE ? 'Air' : nameOf(r.with),
    r.becomes === AIR_TYPE ? 'Air (vanishes)' : nameOf(r.becomes),
    percent(r.chance),
    r.consumes ? 'yes' : '',
    r.radius && r.radius > 1 ? r.radius : '',
  ]));

  return `# Elements

All ${elements.length} registered elements, generated from the element registry (\`src/elements/index.ts\`) by \`npm run elements\`. Type ids are stable: never renumber them, or saved \`.idw\` worlds corrupt. Air is type 0.

## Properties

How to read the columns:
- **Kind**: \`static\` solids never move, \`powder\` solids fall in \`main\`, \`liquid\` and \`gas\` run in \`mainLiquid\` and \`mainGas\`.
- **In picker**: hidden elements are internal stages (aging, pulses, blasts) that no brush can place.
- **Density**: a tile sinks through liquids and gases that are lighter. Water is 1.
- **Fall**: effective fall rate in cells per sim step (60 steps per second), for powders only.
- **Slide**: chance a powder on a slope rolls off (1 = no friction).
- **Cohesion**: chance a powder clings to cohesive neighbors instead of falling or rolling.
- **Rise** and **Dissipates**: gases only, chance per step to rise one cell or to vanish.
- **Age rate**: age steps per sim step (age runs 0 to 255, so the mean life is about 256 / rate steps).
- **Ages into**: outcomes once the age passes 255, rolled in order.
- **Emits**: an empty cell beside or above this element pulls in that tile at the chance per step, without using the emitter up.
- **Blast resist.**: chance per step a tile holds against an adjacent explosion, raised to the blast's power times \`Explosion.SHATTER\`.
- **Flags**: \`blast power\` is the size of the blast an explosive sets off (1 is about 20 cells of reach in air), \`glow\` how strongly a tile lights its surroundings, \`thrown\` that a blast's outer part throws the tile as debris that lands as itself (or as the named type).

${table(['Type', 'Element', 'Kind', 'In picker', 'Color', 'Density', 'Fall (cells/step)', 'Slide', 'Cohesion', 'Rise', 'Dissipates', 'Drawn as', 'Age rate', 'Ages into', 'Emits', 'Blast resist.', 'Flags'], properties)}

## Reactions

${reactions.length} one-sided rules. A tile of the element in the first column that touches a \`with\` tile (8 neighbors, or within \`radius\` cells) becomes the result at that chance per step. **Consumes** means the touched tile turns into air at the same time.

${table(['Element', 'Touching', 'Becomes', 'Chance', 'Consumes', 'Radius'], reactions)}
`;
}
