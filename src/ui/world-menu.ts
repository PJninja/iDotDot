import type { GpuSimulation } from '../engine/gpu/gpu-simulation';
import { decodeWorld, encodeWorld } from '../engine/world-file';

const SAVE_ICON =
  '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9 2.5 V11.5"/><path d="M5.5 8 L9 11.5 L12.5 8"/><path d="M3 14.5 H15"/></svg>';
const LOAD_ICON =
  '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9 11.5 V2.5"/><path d="M5.5 6 L9 2.5 L12.5 6"/><path d="M3 14.5 H15"/></svg>';

const MESSAGE_MS = 4000;

/**
 * Header buttons that save the world to a .idw file and load one back into the current
 * grid. This is how default worlds are authored: paint, Save, drop the file into
 * src/worlds/. Loading resamples to the current tile size and anchors the world
 * bottom-center (see engine/world-file.ts).
 */
export class WorldMenu {
  private readonly message: HTMLDivElement;
  private messageTimer = 0;

  constructor(private readonly sim: GpuSimulation) {
    const actions = document.querySelector('#header .header-actions');
    if (actions === null) throw new Error('#header .header-actions not found');

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.idw';
    input.hidden = true;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) void this.load(file);
    });

    this.message = document.createElement('div');
    this.message.className = 'world-message';
    this.message.hidden = true;

    actions.append(
      this.createButton('Save world', SAVE_ICON, () => void this.save()),
      this.createButton('Load world', LOAD_ICON, () => input.click()),
      input,
    );
    document.body.appendChild(this.message);
  }

  private createButton(title: string, icon: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'picker-button';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML = icon;
    button.addEventListener('click', onClick);
    return button;
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
