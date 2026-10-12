import type { ProjectFilter } from './project-filter';

const NO_MATCH = 'No projects match.';

/**
 * The one line of controls in the corridor under the chips: a search field, the most shared
 * tags as plain words, and the pager. It only draws state; `ProjectFilter` owns it. The input
 * is created once so typing keeps focus while the rest is redrawn.
 */
export class Gallery {
  readonly element = document.createElement('div');
  private readonly search = document.createElement('input');
  private readonly tags = document.createElement('span');
  private readonly clear = document.createElement('button');
  private readonly empty = document.createElement('span');
  private readonly pager = document.createElement('span');
  private readonly previous = document.createElement('button');
  private readonly next = document.createElement('button');
  private readonly position = document.createElement('span');

  constructor(private readonly filter: ProjectFilter) {
    this.element.className = 'gallery';
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', 'Find projects');

    this.search.type = 'text';
    this.search.className = 'gallery-search';
    this.search.placeholder = 'Search';
    this.search.setAttribute('aria-label', 'Search projects');
    this.search.autocomplete = 'off';
    this.search.spellcheck = false;
    this.search.value = filter.currentQuery;
    this.search.addEventListener('input', () => filter.setQuery(this.search.value));

    this.tags.className = 'gallery-tags';

    this.clear.type = 'button';
    this.clear.className = 'tag-clear';
    this.clear.textContent = 'Clear';
    this.clear.addEventListener('click', () => {
      this.search.value = '';
      filter.clear();
    });

    this.empty.className = 'gallery-empty';
    this.empty.textContent = NO_MATCH;

    this.pager.className = 'gallery-pager';
    for (const [button, label, aria] of [[this.previous, 'Prev', 'Previous page'], [this.next, 'Next', 'Next page']] as const) {
      button.type = 'button';
      button.className = 'gallery-step';
      button.textContent = label;
      button.setAttribute('aria-label', aria);
    }
    this.position.className = 'gallery-position';
    this.pager.append(this.previous, this.position, this.next);

    this.element.append(this.search, this.tags, this.empty, this.clear, this.pager);
  }

  /** Redraw the tag words, the Clear word and the pager for a page size. */
  render(pageSize: number): void {
    const filter = this.filter;
    const pages = filter.pageCount(pageSize);
    const page = filter.currentPage(pageSize);

    this.tags.replaceChildren(
      ...filter.tagWords().map((tag) => {
        const word = document.createElement('button');
        word.type = 'button';
        word.className = 'tag-word';
        word.textContent = tag;
        word.setAttribute('aria-pressed', String(filter.isSelected(tag)));
        word.addEventListener('click', () => filter.toggleTag(tag));
        return word;
      }),
    );
    this.clear.hidden = !filter.active;
    this.empty.hidden = filter.results().length > 0;

    this.pager.hidden = pages < 2;
    this.position.textContent = `${page + 1} / ${pages}`;
    this.previous.disabled = page === 0;
    this.next.disabled = page >= pages - 1;
    this.previous.onclick = () => filter.setPage(page - 1);
    this.next.onclick = () => filter.setPage(page + 1);
  }

  /** Layouts without room for the tag words drop them and keep the search and pager. */
  setCompact(compact: boolean): void {
    this.element.classList.toggle('is-compact', compact);
  }
}
