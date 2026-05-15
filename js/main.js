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

function renderProjects() {
  const grid = document.getElementById('project-grid');
  if (!grid) return;

  grid.innerHTML = PROJECTS.map(p => {
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
  }).join('');

  grid.addEventListener('click', e => {
    if (e.target.closest('a')) return;
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
  renderProjects();
  renderPosts();
  initFooter();
  initTypewriter();
  initGlitch();
});
