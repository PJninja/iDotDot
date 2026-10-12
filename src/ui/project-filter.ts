import type { Project } from '../projects/project';

const MAX_TAG_WORDS = 3;

/**
 * What the board lists: the projects matching a search and any selected tags, split into
 * pages. Search matches the title, summary and tags; selected tags match by any. The state
 * is mirrored in `?q=`, `?tag=a,b` and `?page=` so a filtered view can be shared.
 */
export class ProjectFilter {
  private query = '';
  private readonly tags = new Set<string>();
  /** Zero-based; clamped against the page count when read, since the page size changes with the window. */
  private page = 0;

  /** Called after the query, tags or page change. */
  onChange: (() => void) | null = null;

  constructor(private readonly projects: readonly Project[]) {
    const params = new URLSearchParams(window.location.search);
    this.query = params.get('q') ?? '';
    const known = new Set(projects.flatMap((p) => p.tags));
    for (const tag of params.get('tag')?.split(',') ?? []) if (known.has(tag)) this.tags.add(tag);
    this.page = Math.max(0, (Number.parseInt(params.get('page') ?? '1', 10) || 1) - 1);
  }

  get currentQuery(): string {
    return this.query;
  }

  /** True while a search or a tag narrows the list. */
  get active(): boolean {
    return this.query.trim() !== '' || this.tags.size > 0;
  }

  isSelected(tag: string): boolean {
    return this.tags.has(tag);
  }

  /** The projects that match, in board order. */
  results(): Project[] {
    const words = this.query.toLowerCase().split(/\s+/).filter((w) => w !== '');
    return this.projects.filter((p) => {
      if (this.tags.size > 0 && !p.tags.some((t) => this.tags.has(t))) return false;
      const haystack = [p.title, p.summary, ...p.tags].join(' ').toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }

  pageCount(size: number): number {
    return Math.max(1, Math.ceil(this.results().length / size));
  }

  /** Zero-based page, clamped to the pages that exist. */
  currentPage(size: number): number {
    return Math.min(this.page, this.pageCount(size) - 1);
  }

  /** The projects on the current page. */
  pageItems(size: number): Project[] {
    const start = this.currentPage(size) * size;
    return this.results().slice(start, start + size);
  }

  /** Tags worth a word of their own: the most shared ones, plus any that are selected. */
  tagWords(): string[] {
    const counts = new Map<string, number>();
    for (const tag of this.projects.flatMap((p) => p.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    const ranked = [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
    const words = new Set([...ranked.slice(0, MAX_TAG_WORDS), ...this.tags]);
    return ranked.filter((t) => words.has(t));
  }

  setQuery(query: string): void {
    this.query = query;
    this.page = 0;
    this.changed();
  }

  toggleTag(tag: string): void {
    if (!this.tags.delete(tag)) this.tags.add(tag);
    this.page = 0;
    this.changed();
  }

  clear(): void {
    this.query = '';
    this.tags.clear();
    this.page = 0;
    this.changed();
  }

  /** Move to a zero-based page; the caller passes the clamped neighbor of `currentPage`. */
  setPage(page: number): void {
    this.page = Math.max(0, page);
    this.changed();
  }

  private changed(): void {
    const url = new URL(window.location.href);
    const set = (key: string, value: string | null): void => {
      if (value === null || value === '') url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    };
    set('q', this.query.trim() === '' ? null : this.query);
    set('tag', this.tags.size === 0 ? null : [...this.tags].join(','));
    set('page', this.page === 0 ? null : String(this.page + 1));
    window.history.replaceState(window.history.state, '', url);
    this.onChange?.();
  }
}
