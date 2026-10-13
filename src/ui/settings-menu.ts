import type { GpuSimulation } from '../engine/gpu/gpu-simulation';
import { decodeWorld, encodeWorld } from '../engine/world-file';
import { wireHeaderMenu } from './header-menu';

const GEAR_ICON =
  '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="9" cy="9" r="5"/><circle cx="9" cy="9" r="2"/>' +
  '<path d="M9 1.5 V4 M9 14 V16.5 M1.5 9 H4 M14 9 H16.5 M3.7 3.7 L5.46 5.46 M12.54 12.54 L14.3 14.3 M14.3 3.7 L12.54 5.46 M5.46 12.54 L3.7 14.3"/></svg>';

const MESSAGE_MS = 4000;

/** What the menu's world items do; the caller owns which world is the current one. */
export interface WorldActions {
  /** Restore a fresh copy of the current world. */
  reset: () => void;
  /** Switch to an empty world (the board stays). */
  empty: () => void;
  /** Switch to the next bundled world. */
  nextPreset: () => void;
}

/**
 * The gear at the right of the header and its list of world actions: Reset, Load, Save,
 * New empty world and Next preset. Save and Load write the grid to a .idw file and read one
 * back, which is how default worlds are authored (paint, Save, drop the file into
 * src/worlds/). Loading resamples to the current tile size and anchors the world
 * bottom-center (see engine/world-file.ts).
 */
export class SettingsMenu {
  private readonly message = document.createElement('div');
  private messageTimer = 0;

  constructor(private readonly sim: GpuSimulation, actions: WorldActions) {
    const nav = document.querySelector('#header nav');
    if (nav === null) throw new Error('#header nav not found');

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.idw';
    input.hidden = true;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) void this.load(file);
    });

    const wrap = document.createElement('div');
    wrap.className = 'settings-menu';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'settings-button';
    button.title = 'Settings';
    button.setAttribute('aria-label', 'Settings');
    button.innerHTML = GEAR_ICON;

    const panel = document.createElement('div');
    panel.className = 'header-panel settings-panel';

    wrap.append(button, panel, input);
    nav.appendChild(wrap);
    const close = wireHeaderMenu(wrap, button, panel);

    const items: [string, () => void][] = [
      ['Reset world', actions.reset],
      ['Load world', () => input.click()],
      ['Save world', () => void this.save()],
      ['New empty world', actions.empty],
      ['Next preset', actions.nextPreset],
    ];
    for (const [label, run] of items) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu-item';
      item.textContent = label;
      item.addEventListener('click', () => {
        close(true);
        run();
      });
      panel.appendChild(item);
    }

    this.message.className = 'world-message';
    this.message.hidden = true;
    document.body.appendChild(this.message);
  }

  private async save(): Promise<void> {
    try {
      const blob = await encodeWorld(await this.sim.snapshotWorld());
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `world-${this.sim.width}x${this.sim.height}.idw`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      this.show(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async load(file: File): Promise<void> {
    try {
      this.sim.loadWorld(await decodeWorld(await file.arrayBuffer()));
    } catch (err) {
      this.show(`Could not load ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private show(text: string): void {
    this.message.textContent = text;
    this.message.hidden = false;
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => {
      this.message.hidden = true;
    }, MESSAGE_MS);
  }
}
