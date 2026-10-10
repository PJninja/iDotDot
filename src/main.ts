import { SETTINGS } from './settings';
import { ColliderManager } from './engine/collider';
import { GpuSimulation, type Brush } from './engine/gpu/gpu-simulation';
import { createElementRegistry } from './elements';
import { initHeader } from './ui/header';
import { Overlay } from './ui/overlay';
import { ElementPicker } from './ui/picker';
import { BrushPicker } from './ui/brush-picker';
import { PerfHud } from './ui/perf-hud';
import { WorldMenu } from './ui/world-menu';
import { pickDefaultWorld } from './worlds';
import { showGpuErrorDialog } from './ui/gpu-error-dialog';

async function main(): Promise<void> {
  initHeader();

  const canvas = document.getElementById('sandbox');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('#sandbox canvas not found');
  }

  // Colliders persist across resizes (they belong to overlay content and are
  // re-measured after each rebuild); the grid's state resets on resize.
  const colliders = new ColliderManager();
  const registry = createElementRegistry();
  if (!navigator.gpu) {
    showGpuErrorDialog('navigator.gpu is unavailable');
    return;
  }
  let world: GpuSimulation;
  try {
    world = await GpuSimulation.create(
      canvas,
      colliders,
      registry,
      window.innerWidth,
      window.innerHeight - SETTINGS.HEADER_HEIGHT,
    );
  } catch (err) {
    showGpuErrorDialog(err instanceof Error ? err.message : 'device creation failed');
    return;
  }
  (window as unknown as { __world: GpuSimulation }).__world = world; // DEBUG-TEMP
  const overlay = new Overlay('overlay', colliders, world);

  // Every world rebuild (start, resize, tile size) clears the grid, then restores this visit's default world.
  const defaultWorld = await pickDefaultWorld();
  const loadDefaultWorld = (): void => {
    if (defaultWorld !== null) world.loadWorld(defaultWorld);
  };
  loadDefaultWorld();

  // Header pickers. The brush picker is created first so its button sits
  // to the left of the element picker in the header actions block.
  const brush: Brush = {
    shape: 'circle',
    radius: 4,
    density: 1,
    type: SETTINGS.SAND_TYPE,
  };
  const brushPicker = new BrushPicker(brush.shape, brush.radius, brush.density);
  brushPicker.onChange = (shape, radius, density) => {
    brush.shape = shape;
    brush.radius = radius;
    brush.density = density;
  };

  // Element picker: selects which element the brush paints.
  const picker = new ElementPicker(registry, SETTINGS.SAND_TYPE);
  picker.onChange = (type) => {
    brush.type = type;
  };

  // --- Click/drag painting -------------------------------------------------
  // The canvas has pointer-events: none, so we listen on window and skip
  // events targeting the header or overlay children.
  let painting = false;
  // A press is stamped on the next sim step even if it is released before then.
  let tapPending = false;
  let pointerX = 0;
  let pointerY = 0;
  // Grid cell of the last stamp; the next stamp sweeps from here to the pointer.
  let lastGX = 0;
  let lastGY = 0;

  const isUiTarget = (e: PointerEvent): boolean =>
    e.target instanceof Element &&
    e.target.closest('#header, #overlay, .perf-hud') !== null;

  const pointerGrid = (): [number, number] =>
    world.cellAt(pointerX, pointerY - SETTINGS.HEADER_HEIGHT);

  world.onDeviceLost = (reason) => {
    world.stop();
    showGpuErrorDialog(`device lost: ${reason}`);
  };

  new WorldMenu(world);

  // Third header button: toggleable performance readout and tile size dropdown.
  const perfHud = new PerfHud(world);
  perfHud.onTileSizeChange = (cssPx) => {
    world.setTileSize(cssPx);
    overlay.refreshColliders();
    loadDefaultWorld();
    [lastGX, lastGY] = pointerGrid();
  };

  // --- Frame hook: paint (if held) -------------------------------------------
  // One stamp per sim step, not per frame, so the paint rate is the same at any
  // refresh rate. The pointer's path since the last stamp is split across the
  // frame's steps, as it would have been at 60 Hz.
  world.onFrame = (steps) => {
    if (steps === 0 || !(painting || tapPending)) return;
    tapPending = false;
    const [gx, gy] = pointerGrid();
    let fromX = lastGX;
    let fromY = lastGY;
    for (let s = 1; s <= steps; s++) {
      const toX = Math.round(lastGX + ((gx - lastGX) * s) / steps);
      const toY = Math.round(lastGY + ((gy - lastGY) * s) / steps);
      world.paintStroke(fromX, fromY, toX, toY, brush);
      fromX = toX;
      fromY = toY;
    }
    lastGX = gx;
    lastGY = gy;
  };

  // --- Input events ----------------------------------------------------------
  window.addEventListener('pointerdown', (e) => {
    if (isUiTarget(e)) return;
    if (e.clientY < SETTINGS.HEADER_HEIGHT) return;
    painting = true;
    tapPending = true;
    pointerX = e.clientX;
    pointerY = e.clientY;
    [lastGX, lastGY] = pointerGrid();
  });
  window.addEventListener('pointermove', (e) => {
    if (!painting) return;
    pointerX = e.clientX;
    pointerY = e.clientY;
  });
  window.addEventListener('pointerup', () => {
    painting = false;
  });
  window.addEventListener('pointercancel', () => {
    painting = false;
  });

  // --- Resize: rebuild the world (grid state resets) --------------------------
  let resizePending = false;
  window.addEventListener('resize', () => {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => {
      resizePending = false;
      world.resize(window.innerWidth, window.innerHeight - SETTINGS.HEADER_HEIGHT);
      overlay.refreshColliders();
      loadDefaultWorld();
      [lastGX, lastGY] = pointerGrid();
    });
  });

  world.start();
}

void main();
