import type { Project } from '../projects/project';
import type { SITE } from '../site';

export interface PlainViewOptions {
  /** Include screenshots and video. Left out of the build-time copy, which only has dev-server asset URLs. */
  media: boolean;
  /** A fact shown above everything else, such as why the simulation is not running. */
  notice?: string;
  /** Link back to the simulation, offered when the browser can run it. */
  simulationHref?: string;
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderProject(p: Project, media: boolean): string {
  const facts = [
    ['Role', p.role],
    ['Timeline', p.timeline],
    ['Stack', p.stack.join(', ')],
    ['Outcome', p.outcome],
  ]
    .map(([label, text]) => `<p class="plain-fact"><span>${label}</span> ${escapeHtml(text)}</p>`)
    .join('');
  const sections = p.sections
    .map((s) => `<h3>${escapeHtml(s.heading)}</h3><p>${escapeHtml(s.body)}</p>`)
    .join('');
  const video =
    media && p.video
      ? `<video controls muted loop playsinline preload="none" poster="${escapeHtml(p.screenshots[0].src)}">` +
        (p.video.webm ? `<source src="${escapeHtml(p.video.webm)}" type="video/webm">` : '') +
        (p.video.mp4 ? `<source src="${escapeHtml(p.video.mp4)}" type="video/mp4">` : '') +
        '</video>'
      : '';
  const shots = media
    ? p.screenshots
        .map(
          (s) =>
            `<figure><img src="${escapeHtml(s.src)}" alt="${escapeHtml(s.alt)}" loading="lazy" decoding="async">` +
            (s.caption ? `<figcaption>${escapeHtml(s.caption)}</figcaption>` : '') +
            '</figure>',
        )
        .join('')
    : '';
  const links = p.links.length
    ? `<p class="plain-links">${p.links.map((l) => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`).join(' ')}</p>`
    : '';
  return (
    `<article id="project-${p.id}"><h2>${escapeHtml(p.title)}</h2>` +
    `<p class="plain-tags">${p.tags.map(escapeHtml).join(', ')}</p>` +
    `<p>${escapeHtml(p.blurb)}</p>${facts}${sections}${video}${shots}${links}</article>`
  );
}

/** Markup of the plain page, built from the same project modules as the board. Pure, so the build can run it in Node. */
export function renderPlainHtml(projects: readonly Project[], site: typeof SITE, options: PlainViewOptions): string {
  const contact = [
    site.email ? `<a href="mailto:${escapeHtml(site.email)}">Email</a>` : '',
    site.github ? `<a href="${escapeHtml(site.github)}">GitHub</a>` : '',
    site.resume ? `<a href="${escapeHtml(site.resume)}">Resume</a>` : '',
    options.simulationHref ? `<a href="${escapeHtml(options.simulationHref)}">Open the simulation</a>` : '',
  ]
    .filter((link) => link !== '')
    .join(' ');
  return (
    '<header class="plain-header">' +
    (options.notice ? `<p class="plain-notice">${escapeHtml(options.notice)}</p>` : '') +
    `<h1>${escapeHtml(site.name)}</h1>` +
    (contact ? `<p class="plain-links">${contact}</p>` : '') +
    '</header><main>' +
    projects.map((p) => renderProject(p, options.media)).join('') +
    '</main>'
  );
}
