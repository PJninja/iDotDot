import { PROJECTS, POSTS } from './data.js';
import { initFooter } from './footer.js';
import { initGlitch } from './glitch.js';
import { initTheme } from './theme.js';

const SUBTITLES = [
  "software developer",
  "maker of things",
  "problem solver",
  "code writer",
  "chaos tamer",
  "bit flipper",
  "data cruncher",
  "monster spawner",
  "father",
  "office attendant",
  "coffee devourer",
  "soccer player",
  "sanity breaker",
  "positivity spreader",
  "husband",
  "old school runescaper",
  "partially human",
  "full-time breather",
  "part-time laugher",
  "play cube11",
  "lorem ipsum decoder",
  "s0-af8uimase 34j309 gdsk",
  "error 0x0000001a fixer",
];

function initTypewriter() {
  const el = document.getElementById('hero-typewriter');
  if (!el) return;

  let i = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function run() {
    while (true) {
      const str = SUBTITLES[i % SUBTITLES.length];
      for (let c = 0; c <= str.length; c++) {
        el.textContent = str.slice(0, c);
        await sleep(80);
      }
      await sleep(3000);
      for (let c = str.length; c >= 0; c--) {
        el.textContent = str.slice(0, c);
        await sleep(45);
      }
      await sleep(200);
      i++;
    }
  }

  run();
}

const PAGE_SIZE = 9;
const filterState = { query: '', activeTags: new Set(), page: 1 };
let searchDebounce;

function allTags() {
  return [...new Set(PROJECTS.flatMap(p => p.tags))].sort();
}

function applyFilters() {
  const q = filterState.query.trim().toLowerCase();
  return PROJECTS.filter(p => {
    const textHit = !q
      || p.title.toLowerCase().includes(q)
      || p.desc.toLowerCase().includes(q)
      || p.tags.some(t => t.toLowerCase().includes(q));
    const tagHit = filterState.activeTags.size === 0
      || p.tags.some(t => filterState.activeTags.has(t));
    return textHit && tagHit;
  });
}

function cardHtml(p) {
  const tags = p.tags.map(t => `<span class="tag">${t}</span>`).join('');
  const links = Object.entries(p.links)
    .map(([type, url]) => {
      const external = url !== '#' ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${url}"${external}>${type.toUpperCase()}</a>`;
    })
    .join('');
  const href = p.file ? ` data-href="${p.file}"` : '';

  return `
    <article class="project-card"${href}>
      <h3>${p.title}</h3>
      <p>${p.desc}</p>
      <div class="project-tags">${tags}</div>
      <div class="project-links">${links}</div>
    </article>`;
}

function renderFilterChips() {
  const wrap = document.getElementById('filter-tags');
  if (!wrap) return;
  wrap.innerHTML = [...filterState.activeTags].map(t => `
    <span class="filter-chip">${t}<button type="button" class="filter-chip-x" data-tag="${t}" aria-label="remove ${t} filter">x</button></span>
  `).join('');

  const clearBtn = document.getElementById('filter-clear');
  if (clearBtn) {
    const hasFilters = filterState.activeTags.size > 0 || filterState.query.trim() !== '';
    clearBtn.hidden = !hasFilters;
  }
}

function renderPager(totalFiltered) {
  const pager = document.getElementById('project-pager');
  if (!pager) return;
  const pages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  if (pages <= 1) {
    pager.hidden = true;
    pager.innerHTML = '';
    return;
  }
  pager.hidden = false;

  const cur = filterState.page;
  const btns = [];
  btns.push(`<button type="button" class="pager-btn" data-page="${cur - 1}" ${cur === 1 ? 'disabled' : ''} aria-label="previous page">&lt;</button>`);

  const nums = new Set([1, pages, cur, cur - 1, cur + 1]);
  let last = 0;
  for (let n = 1; n <= pages; n++) {
    if (!nums.has(n)) continue;
    if (n - last > 1) btns.push(`<span class="pager-ellipsis">...</span>`);
    btns.push(`<button type="button" class="pager-btn" data-page="${n}" ${n === cur ? 'aria-current="page"' : ''}>${n}</button>`);
    last = n;
  }

  btns.push(`<button type="button" class="pager-btn" data-page="${cur + 1}" ${cur === pages ? 'disabled' : ''} aria-label="next page">&gt;</button>`);
  pager.innerHTML = btns.join('');
}

function renderProjects() {
  const grid = document.getElementById('project-grid');
  if (!grid) return;

  const filtered = applyFilters();
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (filterState.page > pages) filterState.page = pages;

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="filter-empty">no projects match</p>`;
  } else {
    const start = (filterState.page - 1) * PAGE_SIZE;
    grid.innerHTML = filtered.slice(start, start + PAGE_SIZE).map(cardHtml).join('');
  }

  renderPager(filtered.length);
}

function togglePopover(force) {
  const pop = document.getElementById('filter-popover');
  const btn = document.getElementById('filter-add');
  if (!pop || !btn) return;
  const show = force !== undefined ? force : pop.hidden;
  if (show) {
    const remaining = allTags().filter(t => !filterState.activeTags.has(t));
    pop.innerHTML = remaining.length === 0
      ? `<span class="filter-popover-empty">no more tags</span>`
      : remaining.map(t => `<button type="button" class="filter-popover-item" data-tag="${t}">${t}</button>`).join('');
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  } else {
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }
}

function initFilters() {
  const search = document.getElementById('filter-search');
  const addBtn = document.getElementById('filter-add');
  const popover = document.getElementById('filter-popover');
  const tagsWrap = document.getElementById('filter-tags');
  const clearBtn = document.getElementById('filter-clear');

  if (!search || !addBtn || !popover || !tagsWrap || !clearBtn) return;

  search.addEventListener('input', e => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      filterState.query = e.target.value;
      filterState.page = 1;
      renderFilterChips();
      renderProjects();
    }, 120);
  });

  addBtn.addEventListener('click', e => {
    e.stopPropagation();
    togglePopover();
  });

  popover.addEventListener('click', e => {
    const item = e.target.closest('.filter-popover-item');
    if (!item) return;
    filterState.activeTags.add(item.dataset.tag);
    filterState.page = 1;
    togglePopover(false);
    renderFilterChips();
    renderProjects();
  });

  tagsWrap.addEventListener('click', e => {
    const x = e.target.closest('.filter-chip-x');
    if (!x) return;
    filterState.activeTags.delete(x.dataset.tag);
    filterState.page = 1;
    renderFilterChips();
    renderProjects();
  });

  clearBtn.addEventListener('click', () => {
    filterState.query = '';
    filterState.activeTags.clear();
    filterState.page = 1;
    search.value = '';
    togglePopover(false);
    renderFilterChips();
    renderProjects();
  });

  document.addEventListener('click', e => {
    if (popover.hidden) return;
    if (e.target.closest('.filter-add-wrap')) return;
    togglePopover(false);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !popover.hidden) togglePopover(false);
  });
}

function initPager() {
  const pager = document.getElementById('project-pager');
  if (!pager) return;
  pager.addEventListener('click', e => {
    const btn = e.target.closest('.pager-btn');
    if (!btn || btn.disabled) return;
    const page = Number(btn.dataset.page);
    if (!Number.isFinite(page) || page < 1) return;
    filterState.page = page;
    renderProjects();
    document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function initGridNav() {
  const grid = document.getElementById('project-grid');
  if (!grid) return;
  grid.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    if (e.target.closest('button')) return;
    const card = e.target.closest('[data-href]');
    if (card) window.location = card.dataset.href;
  });
}

function renderPosts() {
  const list = document.getElementById('post-list');
  if (!list) return;

  list.innerHTML = POSTS.map(post => `
    <li>
      <a href="${post.file}">${post.title}</a>
      <span class="post-date">${post.date}</span>
    </li>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initFilters();
  initPager();
  initGridNav();
  renderProjects();
  renderPosts();
  initFooter();
  initTypewriter();
  initGlitch();
});
