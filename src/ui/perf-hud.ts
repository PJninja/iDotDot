import type { GpuSimulation, PerfStats } from '../engine/gpu/gpu-simulation';
import { SETTINGS } from '../settings';

/** Gauge icon for the performance button. */
const ICON_SVG =
  '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2.5 13.5 A6.5 6.5 0 1 1 15.5 13.5"/>' +
  '<path d="M9 9.5 L12 6"/>' +
  '<circle cx="9" cy="9.5" r="1"/>' +
  '</svg>';

const REFRESH_MS = 250;
/** Tile edges (CSS px) offered by the tile size dropdown. */
const TILE_SIZES = [1, 2, 4, 8, 16];

/** Smoothed fps below which the readout turns yellow / red. Dropped steps (the sim running slower than real time) also turn it red. */
const WARN_FPS = 50;
const BAD_FPS = 30;

type Health = 'good' | 'warn' | 'bad';

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

function rateHealth(p: PerfStats): Health {
  if (p.droppedStepsPerSecond > 0 || p.fps < BAD_FPS) return 'bad';
  if (p.fps < WARN_FPS) return 'warn';
  return 'good';
}

/**
 * Header icon button that toggles a small performance readout under the
 * header (top right). GPU tile counters are only collected while it is
 * visible. "moving" tiles changed cell last step; "chunks" are the 16x16
 * chunks simulated last step (sleeping ones are skipped), and "idle" means
 * nothing is awake and no frames are being submitted. The text turns yellow,
 * then red, as the frame rate drops or the sim falls behind. Also holds the tile
 * size dropdown; changing it rebuilds the world (the grid is cleared).
 */
export class PerfHud {
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLDivElement;
  private readonly stats: HTMLDivElement;
  private visible = false;
  private timer = 0;

  /** Called with the new tile edge (CSS px) when the tile size dropdown changes. */
  onTileSizeChange: ((cssPx: number) => void) | null = null;

  constructor(private readonly sim: GpuSimulation) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'picker-button';
    this.button.title = 'Performance stats';
    this.button.setAttribute('aria-pressed', 'false');
    this.button.innerHTML = ICON_SVG;
    this.button.addEventListener('click', () => this.setVisible(!this.visible));

    this.panel = document.createElement('div');
    this.panel.className = 'perf-hud';
    this.panel.hidden = true;
    this.stats = document.createElement('div');
    this.panel.appendChild(this.stats);
    this.panel.appendChild(this.createTileSizeSelect());
    document.body.appendChild(this.panel);

    const actions = document.querySelector('#header .header-actions');
    if (actions === null) throw new Error('#header .header-actions not found');
    actions.appendChild(this.button);
  }

  private createTileSizeSelect(): HTMLLabelElement {
    const label = document.createElement('label');
    label.className = 'perf-hud-control';
    label.textContent = 'Tile Size ';
    const select = document.createElement('select');
    for (const size of TILE_SIZES) {
      const option = document.createElement('option');
      option.value = String(size);
      option.textContent = `${size}px`;
      select.appendChild(option);
    }
    select.value = String(SETTINGS.TILE_SIZE);
    select.addEventListener('change', () => {
      this.onTileSizeChange?.(Number(select.value));
      this.render();
    });
    label.appendChild(select);
    return label;
  }

  private setVisible(visible: boolean): void {
    this.visible = visible;
    this.panel.hidden = !visible;
    this.button.setAttribute('aria-pressed', String(visible));
    this.sim.setStatsEnabled(visible);
    window.clearInterval(this.timer);
    if (visible) {
      this.render();
      this.timer = window.setInterval(() => this.render(), REFRESH_MS);
    }
  }

  private render(): void {
    const p: PerfStats = this.sim.perf;
    const resting = Math.max(0, p.tiles - p.moving);
    const pct = p.cells > 0 ? ((p.tiles / p.cells) * 100).toFixed(1) : '0.0';
    this.stats.textContent = [
      `${fmt(p.fps)} fps  ${p.frameMs.toFixed(1)} ms`,
      `tiles ${fmt(p.tiles)} (${pct}% of ${fmt(p.cells)})`,
      `moving ${fmt(p.moving)}  resting ${fmt(resting)}`,
      `chunks ${fmt(p.activeChunks)} of ${fmt(p.chunks)} awake${p.idle ? '  (idle)' : ''}`,
      `gpu ${p.gpuMs.toFixed(1)} ms  ${fmt(p.stepsPerSecond)} steps/s` +
        (p.droppedStepsPerSecond > 0 ? `  (${fmt(p.droppedStepsPerSecond)} dropped)` : ''),
      `grid ${this.sim.width}x${this.sim.height} @${+this.sim.tileSize.toFixed(2)}px`,
    ].join('\n');
    this.panel.dataset.health = rateHealth(p);
  }
}
