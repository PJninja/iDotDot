import { SETTINGS } from './settings';
import { ColliderManager } from './engine/collider';
import { GpuSimulation, type Brush } from './engine/gpu/gpu-simulation';
import { createElementRegistry } from './elements';
import { loadProjects } from './projects';
import { initHeader } from './ui/header';
import { Overlay } from './ui/overlay';
import { applyHeaderHeight, headerHeight } from './ui/frame';
import { ElementPicker } from './ui/picker';
import { BrushPicker } from './ui/brush-picker';
import { BrushGhost } from './ui/brush-ghost';
import { PerfHud } from './ui/perf-hud';
import { loadPreferences, savePreferences } from './ui/preferences';
import { SettingsMenu } from './ui/settings-menu';
import { nextDefaultWorld, pickDefaultWorld } from './worlds';
import { NARROW_MIN_WIDTH, isMobileWorld } from './worlds/board-slots';
import { MESSAGE_NO_WEBGPU, showGpuErrorDialog } from './ui/gpu-error-dialog';
import { Board } from './ui/board';
import { ProjectFilter } from './ui/project-filter';
import { ContactMenu } from './ui/contact-menu';
import { ProjectWindow } from './ui/project-window';
import { ProjectRoute } from './ui/project-route';
import { PlainView } from './ui/plain-view';

const NOTICE_GPU_FAILED = 'The GPU could not be started, so the simulation cannot run.';
const NOTICE_TOO_SMALL = 'This window is too small to show the project board beside the simulation.';

async function main(): Promise<void> {
  const projects = loadProjects();
  const plain = new PlainView(projects);
  const prefs = loadPreferences();

  if (new URLSearchParams(window.location.search).get('view') === 'plain') {
    plain.show({ simulationHref: navigator.gpu ? window.location.pathname : undefined });
    return;
  }
  if (!navigator.gpu) {
    plain.show({ notice: MESSAGE_NO_WEBGPU });
    return;
  }

  const headerLinks = initHeader();
  applyHeaderHeight();

  const canvas = document.getElementById('sandbox');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('#sandbox canvas not found');
  }

  // Colliders persist across resizes (they belong to overlay content and are
  // re-measured after each rebuild); the grid's state resets on resize.
  const colliders = new ColliderManager();
  const registry = createElementRegistry();
  let world: GpuSimulation;
  try {
    world = await GpuSimulation.create(
      canvas,
      colliders,
      registry,
      window.innerWidth,
      window.innerHeight - headerHeight(),
      prefs.tileSize,
    );
  } catch (err) {
    console.error('[gpu]', err);
    plain.show({ notice: NOTICE_GPU_FAILED });
    return;
  }
  (window as unknown as { __world: GpuSimulation }).__world = world; // DEBUG-TEMP
  const overlay = new Overlay('overlay', colliders, world);

  // --- Portfolio board ---------------------------------------------------------
  const filter = new ProjectFilter(projects);
  const board = new Board(world, overlay, registry, filter);
  const projectWindow = new ProjectWindow(
    (project) => board.borderElement(project),
    () => world.tileSize,
  );
  board.onOpen = (project, chip) => projectWindow.openPreview(project, chip);
  const route = new ProjectRoute(projectWindow, projects, (id) => board.chipFor(id));

  // Every world rebuild (start, resize, tile size) clears the grid, then restores the current
  // world: this visit's default one until the settings menu picks another preset or an empty world.
  const phoneWindow = (): boolean => window.innerWidth < NARROW_MIN_WIDTH;
  let baseWorld = await pickDefaultWorld(phoneWindow());
  const loadBaseWorld = (): void => {
    if (baseWorld !== null) world.loadWorld(baseWorld);
  };
  board.setBase(baseWorld);

  // The simulation yields to the plain page when the chips cannot fit the window.
  let plainForSize = false;
  const applyFit = (fits: boolean): void => {
    if (!fits) {
      projectWindow.close(true);
      plain.show({ notice: NOTICE_TOO_SMALL });
      if (!plainForSize) world.stop();
      plainForSize = true;
    } else if (plainForSize) {
      world.start();
      plainForSize = false;
    }
  };

  /** Re-lay the board, then restore the default world and stamp the tiles that belong to the board. */
  const rebuildWorld = (): void => {
    // The overlay has no size while the plain page covers it, so lay it out as the simulation would.
    if (plainForSize) plain.hide();
    const fits = board.place();
    overlay.refreshColliders();
    loadBaseWorld();
    if (fits) board.stamp();
    applyFit(fits);
  };
  rebuildWorld();
  route.sync();

  // Header pickers. The brush picker is created first so its button sits
  // to the left of the element picker in the header actions block.
  const brush: Brush = {
    shape: prefs.brushShape,
    radius: prefs.brushRadius,
    density: prefs.brushDensity,
    type: SETTINGS.SAND_TYPE,
  };
  const brushPicker = new BrushPicker(brush.shape, brush.radius, brush.density, prefs.displayBrush);
  brushPicker.onChange = (shape, radius, density) => {
    brush.shape = shape;
    brush.radius = radius;
    brush.density = density;
    savePreferences({ brushShape: shape, brushRadius: radius, brushDensity: density });
    updateGhost();
  };
  brushPicker.onDisplayChange = (display) => {
    savePreferences({ displayBrush: display });
    updateGhost();
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
    e.target.closest('#header, #overlay, .perf-hud, .project-scrim, .gpu-error-backdrop') !== null;

  const pointerGrid = (): [number, number] =>
    world.cellAt(pointerX, pointerY - headerHeight());

  // Display brush: the outline follows a hovering mouse or pen over the world (touch has no hover).
  const ghost = new BrushGhost();
  let hovering = false;
  const updateGhost = (): void => {
    if (!brushPicker.display || !hovering || plainForSize) {
      ghost.hide();
      return;
    }
    const [gx, gy] = pointerGrid();
    ghost.show(gx, gy, brush.shape, brush.radius, world.tileSize, headerHeight() + world.originY);
  };

  world.onDeviceLost = (reason) => {
    world.stop();
    showGpuErrorDialog(`device lost: ${reason}`);
  };

  // Third header button: toggleable performance readout and tile size dropdown.
  const perfHud = new PerfHud(world, prefs.tileSize);
  perfHud.onTileSizeChange = (cssPx) => {
    world.setTileSize(cssPx);
    savePreferences({ tileSize: cssPx });
    rebuildWorld();
    [lastGX, lastGY] = pointerGrid();
    updateGhost();
  };

  const resizeWorld = (): void => {
    // Phone windows have their own small world; a resize across the layout limit swaps it.
    if (baseWorld !== null && isMobileWorld(baseWorld) !== phoneWindow()) {
      void pickDefaultWorld(phoneWindow()).then(switchWorld);
      return;
    }
    applyHeaderHeight();
    world.resize(window.innerWidth, window.innerHeight - headerHeight());
    rebuildWorld();
    [lastGX, lastGY] = pointerGrid();
    updateGhost();
  };

  new ContactMenu(headerLinks, null);

  const switchWorld = (next: typeof baseWorld): void => {
    baseWorld = next;
    board.setBase(next);
    resizeWorld();
  };
  new SettingsMenu(world, {
    reset: resizeWorld,
    empty: () => switchWorld(null),
    nextPreset: () => void nextDefaultWorld(phoneWindow()).then(switchWorld),
  });

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
    if (e.clientY < headerHeight()) return;
    painting = true;
    tapPending = true;
    pointerX = e.clientX;
    pointerY = e.clientY;
    [lastGX, lastGY] = pointerGrid();
  });
  window.addEventListener('pointermove', (e) => {
    hovering = e.pointerType !== 'touch' && e.clientY >= headerHeight() && (painting || !isUiTarget(e));
    if (painting || hovering) {
      pointerX = e.clientX;
      pointerY = e.clientY;
    }
    updateGhost();
  });
  document.documentElement.addEventListener('pointerleave', () => {
    hovering = false;
    updateGhost();
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
      resizeWorld();
    });
  });

  if (!plainForSize) world.start();
}

void main();
