import type { Project } from '../projects/project';
import type { ProjectWindow } from './project-window';

const hashId = (): string | null => /^#\/(.+)$/.exec(window.location.hash)?.[1] ?? null;

/**
 * Keep the URL hash and the project window in step: opening the detail view writes `#/<id>`,
 * Back or a hash change closes it, and a URL with a hash opens that project. The preview
 * has no URL of its own.
 */
export class ProjectRoute {
  constructor(
    private readonly window: ProjectWindow,
    private readonly projects: readonly Project[],
    private readonly chipFor: (id: string) => HTMLElement | null,
  ) {
    window.onModeChange = (mode, project, quiet) => {
      if (quiet) return;
      if (mode === 'detail' && project !== null && hashId() !== project.id) {
        history.pushState({ idotdot: true }, '', `#/${project.id}`);
      } else if (mode === 'closed' && hashId() !== null) {
        if ((history.state as { idotdot?: boolean } | null)?.idotdot === true) history.back();
        else history.replaceState(null, '', `${location.pathname}${location.search}`);
      }
    };
    globalThis.addEventListener('popstate', () => this.sync());
    globalThis.addEventListener('hashchange', () => this.sync());
  }

  /** Apply the current URL to the window (also used once at startup). */
  sync(): void {
    const id = hashId();
    const project = this.projects.find((p) => p.id === id);
    if (project !== undefined) {
      if (this.window.currentProject?.id !== id || this.window.currentMode !== 'detail') {
        this.window.openDetail(project, this.chipFor(project.id), true);
      }
    } else if (this.window.currentMode !== 'closed') {
      this.window.close(true);
    }
  }
}
