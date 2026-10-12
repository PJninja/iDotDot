/**
 * Test page for the portfolio UI without a GPU: the real Board, Overlay, TagFilter, ProjectWindow,
 * ProjectRoute and ModeControls run against a fake world whose `stampCells` records the tiles and
 * draws them into a 2D canvas. Query: `n` (pad the project list to n entries), `tile` (CSS px per
 * cell), `colliders` (outline the colliders). Exposes `window.__h` for tests/test-ui.mjs.
 */
import { SETTINGS } from '../../../src/settings';
import { ColliderManager } from '../../../src/engine/collider';
import { createElementRegistry } from '../../../src/elements';
import { loadProjects } from '../../../src/projects';
import type { Project } from '../../../src/projects/project';
import type { GpuSimulation } from '../../../src/engine/gpu/gpu-simulation';
import { initHeader } from '../../../src/ui/header';
import { Overlay } from '../../../src/ui/overlay';
import { Board } from '../../../src/ui/board';
import { TagFilter } from '../../../src/ui/tag-filter';
import { ProjectWindow } from '../../../src/ui/project-window';
import { ProjectRoute } from '../../../src/ui/project-route';
import { ModeControls } from '../../../src/ui/mode-controls';
import { ElementPicker } from '../../../src/ui/picker';

const params = new URLSearchParams(location.search);
const tile = Number(params.get('tile') ?? 4);
const n = Number(params.get('n') ?? 0);
const registry = createElementRegistry();
let projects = loadProjects();
if (n > projects.length) {
  const base = projects;
  const mats: Project['border'][] = ['stone', 'steel', 'wood', 'ice'];
  const extra: Project[] = [];
  for (let i = base.length; i < n; i++) {
    const b = base[i % base.length];
    extra.push({ ...b, id: `${b.id}-${i}`, title: `${b.title} ${i}`, order: 10 + i, border: mats[i % 4], tags: [b.tags[0], `Tag ${i % 5}`, b.tags[2]] });
  }
  projects = [...base, ...extra];
}

initHeader();
const canvas = document.getElementById('sandbox') as HTMLCanvasElement;
const dpr = window.devicePixelRatio || 1;
const cssW = window.innerWidth;
const cssH = window.innerHeight - SETTINGS.HEADER_HEIGHT;
canvas.width = cssW * dpr;
canvas.height = cssH * dpr;
canvas.style.width = `${cssW}px`;
canvas.style.height = `${cssH}px`;
const ctx = canvas.getContext('2d')!;
ctx.scale(dpr, dpr);

const tilePx = Math.max(1, Math.round(tile * dpr));
const tileSize = tilePx / dpr;
const width = Math.ceil(canvas.width / tilePx);
const height = Math.ceil(canvas.height / tilePx);
const originY = (canvas.height - height * tilePx) / dpr;
const colliders = new ColliderManager();
const stamped: { x: number; y: number; w: number; h: number; words: Uint32Array }[] = [];

const fake = {
  tileSize,
  originY,
  width,
  height,
  stampCells(x: number, y: number, w: number, h: number, words: Uint32Array) {
    stamped.push({ x, y, w, h, words });
  },
  cellAt: (x: number, y: number) => [Math.floor(x / tileSize), Math.floor((y - originY) / tileSize)],
} as unknown as GpuSimulation;

function draw(): void {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, cssW, cssH);
  for (const s of stamped) {
    for (let j = 0; j < s.h; j++) {
      for (let i = 0; i < s.w; i++) {
        const word = s.words[j * s.w + i];
        if (word === 0) continue;
        const el = registry.get(word & 0xff);
        const [r, g, b] = el?.getColor(0, (word >> 16) & 0xff) ?? [255, 0, 255];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect((s.x + i) * tileSize, originY + (s.y + j) * tileSize, tileSize, tileSize);
      }
    }
  }
  if (params.has('colliders')) {
    ctx.strokeStyle = 'rgba(255,0,0,0.9)';
    colliders.forEachRect((r) => ctx.strokeRect(r.x * tileSize + 0.5, originY + r.y * tileSize + 0.5, r.w * tileSize - 1, r.h * tileSize - 1));
  }
}

const overlay = new Overlay('overlay', colliders, fake);
const board = new Board(fake, overlay, registry, projects);
const filter = new TagFilter(board.tagBar, projects);
filter.onChange = (m) => { board.setLit(m); draw(); };
board.setLit(filter.matching(), false);
const win = new ProjectWindow((p) => board.borderElement(p), () => fake.tileSize);
board.onOpen = (p, chip) => win.openPreview(p, chip);
const route = new ProjectRoute(win, projects, (id) => board.chipFor(id));
new ModeControls('portfolio');
new ElementPicker(registry, 1);

const fits = board.place();
overlay.refreshColliders();
if (fits) board.stamp();
draw();
route.sync();
(window as unknown as Record<string, unknown>).__h = { fits, board, win, filter, draw, colliders, stamped, projects };
document.title = `harness fits=${fits}`;
