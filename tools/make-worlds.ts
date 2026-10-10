/**
 * Builds the default worlds in src/worlds/*.idw from the scene scripts in tools/worlds/.
 * Usage: node tools/make-worlds.ts [--preview <dir>] [name ...]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPE_NAMES, type Grid } from './world-kit.ts';
import { buildAlchemistLab } from './worlds/alchemist-lab.ts';
import { buildFarmstead } from './worlds/farmstead.ts';
import { buildDeathMachine } from './worlds/death-machine.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const WORLDS: Record<string, () => Grid> = {
  'alchemist-lab': buildAlchemistLab,
  farmstead: buildFarmstead,
  'death-machine': buildDeathMachine,
};

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : null;
};
const previewDir = flag('--preview');
const outDir = flag('--out') ?? join(root, 'src', 'worlds');
const wanted = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));

for (const [name, build] of Object.entries(WORLDS)) {
  if (wanted.length > 0 && !wanted.includes(name)) continue;
  const grid = build();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${name}.idw`), grid.encode());
  const used = grid.typesUsed();
  console.log(`${name}: ${used.size} element types`);
  console.log('  ' + [...used].map(([t, n]) => `${TYPE_NAMES[t]}:${n}`).join(' '));
  const missing = Object.entries(TYPE_NAMES).filter(([t]) => !used.has(Number(t))).map(([, n]) => n);
  console.log(`  unused: ${missing.join(' ')}`);
  if (previewDir !== null) {
    mkdirSync(previewDir, { recursive: true });
    writeFileSync(join(previewDir, `${name}.png`), grid.png(2));
    const crop = flag('--crop');
    if (crop !== null) {
      const [x, y, w, h] = crop.split(',').map(Number);
      writeFileSync(join(previewDir, `${name}-crop.png`), grid.png(Number(flag('--scale') ?? 4), { x, y, w, h }));
    }
  }
}
