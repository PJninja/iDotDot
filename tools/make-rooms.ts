/**
 * Scratch tool: renders one room of a world script alone (in a small grid with a stone frame)
 * so it can be simulated quickly. Usage: node tools/make-rooms.ts <world> <room> --out <dir>
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Grid, T } from './world-kit.ts';

const [worldName, roomName, ...rest] = process.argv.slice(2);
const outDir = rest[rest.indexOf('--out') + 1] ?? '.';
const mod = await import(`./worlds/${worldName}.ts`);
const room = mod.ROOMS[roomName];
if (!room) throw new Error(`no room ${roomName}`);
const pad = room.pad ?? 0;
const g = new Grid(5, room.w + 8, room.h + 8 + pad);
g.rect(0, 0, g.width, g.height, T.STONE);
g.air(4, 4 + pad, room.w, room.h);
g.rect(0, 0, 0, 0, T.STONE);
g.at(4, 4 + pad, () => room.draw(g));
writeFileSync(join(outDir, `room-${roomName}.idw`), g.encode());
writeFileSync(join(outDir, `room-${roomName}.png`), g.png(3));
console.log(`room ${roomName}: ${g.width}x${g.height}`, [...g.typesUsed()].length, 'types');
