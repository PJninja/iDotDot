import type { Project } from '../projects/project';

/**
 * The tag bar: every tag used by a project, as plain words. Selecting words filters by
 * any match (the matching chips' rings are lit by the caller); the selection is mirrored
 * in `?tag=a,b` so a filtered view can be shared.
 */
export class TagFilter {
  private readonly selected = new Set<string>();
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private readonly clear: HTMLButtonElement;

  /** Called with the ids of the matching projects, or null when no tag is selected. */
  onChange: ((matching: ReadonlySet<string> | null) => void) | null = null;

  constructor(
    bar: HTMLElement,
    private readonly projects: readonly Project[],
  ) {
    const tags = [...new Set(projects.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b));
    const fromUrl = new URLSearchParams(window.location.search).get('tag');
    for (const tag of fromUrl?.split(',') ?? []) if (tags.includes(tag)) this.selected.add(tag);

    for (const tag of tags) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tag-word';
      button.textContent = tag;
      button.addEventListener('click', () => this.toggle(tag));
      this.buttons.set(tag, button);
      bar.append(button, ' ');
    }
    this.clear = document.createElement('button');
    this.clear.type = 'button';
    this.clear.className = 'tag-clear';
    this.clear.textContent = 'Clear';
    this.clear.addEventListener('click', () => {
      this.selected.clear();
      this.apply();
    });
    bar.appendChild(this.clear);
    bar.hidden = tags.length === 0;
    this.render();
  }

  /** Ids of the projects matching the current selection, or null when nothing is selected. */
  matching(): ReadonlySet<string> | null {
    if (this.selected.size === 0) return null;
    return new Set(this.projects.filter((p) => p.tags.some((t) => this.selected.has(t))).map((p) => p.id));
  }

  private toggle(tag: string): void {
    if (!this.selected.delete(tag)) this.selected.add(tag);
    this.apply();
  }

  private apply(): void {
    this.render();
    const url = new URL(window.location.href);
    if (this.selected.size === 0) url.searchParams.delete('tag');
    else url.searchParams.set('tag', [...this.selected].join(','));
    window.history.replaceState(window.history.state, '', url);
    this.onChange?.(this.matching());
  }

  private render(): void {
    for (const [tag, button] of this.buttons) button.setAttribute('aria-pressed', String(this.selected.has(tag)));
    this.clear.hidden = this.selected.size === 0;
  }
}
