import type { Project } from '../projects/project';
import { SITE } from '../site';
import { renderPlainHtml } from './plain-html';

/**
 * The plain page: the same projects as an ordinary scrolling document, with no canvas and no
 * WebGPU. Shown when the simulation cannot run, when the board does not fit the window, or
 * on request (`?view=plain`). The build also writes a text-only copy into index.html for
 * crawlers and visitors without JavaScript.
 */
export class PlainView {
  private readonly root = document.getElementById('plain-view');

  constructor(private readonly projects: readonly Project[]) {}

  get active(): boolean {
    return document.documentElement.classList.contains('plain');
  }

  /** Render and show the page. `notice` states why the simulation is not shown. */
  show(options: { notice?: string; simulationHref?: string } = {}): void {
    if (this.root === null) return;
    this.root.innerHTML = renderPlainHtml(this.projects, SITE, { media: true, ...options });
    document.documentElement.classList.add('plain');
  }

  hide(): void {
    document.documentElement.classList.remove('plain');
  }
}
