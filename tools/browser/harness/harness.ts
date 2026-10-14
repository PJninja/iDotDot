/**
 * Test page for the portfolio UI without a GPU: the real Board, Overlay, ProjectFilter, ProjectWindow,
 * ProjectRoute and ContactMenu run against a fake world whose `stampCells` records the tiles and
 * draws them into a 2D canvas. Query: `n` (pad the project list to n entries), `tile` (CSS px per
 * cell), `colliders` (outline the colliders), plus the app's `q`, `tag` and `page`. Exposes `window.__h` for tests/test-ui.mjs.
 */
import { SETTINGS } from '../../../src/settings';
import { computeGridGeometry } from '../../../src/engine/grid-geometry';
import { applyHeaderHeight } from '../../../src/ui/frame';
import { ColliderManager } from '../../../src/engine/collider';
import { createElementRegistry } from '../../../src/elements';
import { loadProjects } from '../../../src/projects';
import type { Project } from '../../../src/projects/project';
import type { GpuSimulation } from '../../../src/engine/gpu/gpu-simulation';
import { initHeader } from '../../../src/ui/header';
import { Overlay } from '../../../src/ui/overlay';
import { Board } from '../../../src/ui/board';
import { ProjectFilter } from '../../../src/ui/project-filter';
import { ProjectWindow } from '../../../src/ui/project-window';
import { ProjectRoute } from '../../../src/ui/project-route';
import { ContactMenu } from '../../../src/ui/contact-menu';
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

const headerLinks = initHeader();
const canvas = document.getElementById('sandbox') as HTMLCanvasElement;
const dpr = window.devicePixelRatio || 1;
const geometry = computeGridGeometry(window.innerWidth, window.innerHeight - applyHeaderHeight(), dpr, tile, SETTINGS.MAX_SIM_DIMENSION);
const { tilePx, tileSize, width, height, originY } = geometry;
canvas.width = geometry.deviceWidth;
canvas.height = geometry.deviceHeight;
canvas.style.width = `${geometry.cssWidth}px`;
canvas.style.height = `${geometry.cssHeight}px`;
const ctx = canvas.getContext('2d')!;
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
  ctx.fillStyle = '#0d2a1f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const s of stamped) {
    for (let j = 0; j < s.h; j++) {
      for (let i = 0; i < s.w; i++) {
        const word = s.words[j * s.w + i];
        if (word === 0) continue;
        const el = registry.get(word & 0xff);
        const [r, g, b] = el?.getColor(0, (word >> 16) & 0xff) ?? [255, 0, 255];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect((s.x + i) * tilePx, canvas.height - (height - s.y - j) * tilePx, tilePx, tilePx);
      }
    }
  }
  if (params.has('colliders')) {
    ctx.strokeStyle = 'rgba(255,0,0,0.9)';
    colliders.forEachRect((r) => ctx.strokeRect(r.x * tilePx + 0.5, canvas.height - (height - r.y) * tilePx + 0.5, r.w * tilePx - 1, r.h * tilePx - 1));
  }
}

const overlay = new Overlay('overlay', colliders, fake);
const filter = new ProjectFilter(projects);
const board = new Board(fake, overlay, registry, filter);
board.setBase(null);
const win = new ProjectWindow((p) => board.borderElement(p), () => fake.tileSize);
board.onOpen = (p, chip) => win.openPreview(p, chip);
const route = new ProjectRoute(win, projects, (id) => board.chipFor(id));
new ContactMenu(headerLinks, null);
new ElementPicker(registry, 1);

const fits = board.place();
overlay.refreshColliders();
if (fits) board.stamp();
draw();
route.sync();
(window as unknown as Record<string, unknown>).__h = { fits, board, win, filter, draw, colliders, stamped, projects, gridWidth: width, tileSize, originY };
document.title = `harness fits=${fits}`;
