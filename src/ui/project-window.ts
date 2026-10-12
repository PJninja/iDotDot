import type { Project } from '../projects/project';

interface FrameMaterial {
  getColor(value: number, variant: number): [number, number, number];
}

type Mode = 'closed' | 'preview' | 'detail';

const FOCUSABLE = 'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';
const THUMB_COLUMNS = 112;

/** Draw a block-stepped frame into a canvas: tile-sized blocks of the project's material, corners cut one block. */
function drawFrame(canvas: HTMLCanvasElement, material: FrameMaterial | null, block: number, thickness: number): void {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  ctx.scale(dpr, dpr);
  const cols = Math.ceil(cssW / block);
  const rows = Math.ceil(cssH / block);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const onFrame = x < thickness || y < thickness || x >= cols - thickness || y >= rows - thickness;
      const cutCorner = (x === 0 || x === cols - 1) && (y === 0 || y === rows - 1);
      if (!onFrame || cutCorner) continue;
      const [r, g, b] = material?.getColor(0, (x * 31 + y * 17) % 251) ?? [118, 116, 112];
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x * block, y * block, block, block);
    }
  }
}

/** A canvas holding the image downscaled to a coarse grid, so it reads as made of blocks. */
function pixelated(src: string, alt: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = 'win-thumb';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', alt);
  const image = new Image();
  image.onload = () => {
    canvas.width = THUMB_COLUMNS;
    canvas.height = Math.max(1, Math.round((THUMB_COLUMNS * image.naturalHeight) / image.naturalWidth));
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  };
  image.src = src;
  return canvas;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/**
 * The window that shows one project above the simulation: a flat dark scrim over the whole
 * page and a dialog in the middle. It is plain DOM and never touches the grid, so the world
 * keeps running underneath. The preview and the detail view are the same window, expanded.
 */
export class ProjectWindow {
  private readonly scrim = element('div', 'project-scrim');
  private readonly win = element('div', 'project-window');
  private readonly frame = element('canvas', 'window-frame');
  private readonly body = element('div', 'window-body');
  private readonly resizeObserver = new ResizeObserver(() => this.redrawFrame());
  private mode: Mode = 'closed';
  private project: Project | null = null;
  private opener: HTMLElement | null = null;
  private video: HTMLVideoElement | null = null;
  private galleryIndex = 0;

  /** Fired after the mode changes; `quiet` is true when the change came from the URL. */
  onModeChange: ((mode: Mode, project: Project | null, quiet: boolean) => void) | null = null;

  constructor(
    private readonly frameMaterial: (project: Project) => FrameMaterial | null,
    private readonly tileSize: () => number,
  ) {
    this.scrim.hidden = true;
    this.win.setAttribute('role', 'dialog');
    this.win.setAttribute('aria-modal', 'true');
    this.win.tabIndex = -1;
    this.win.append(this.frame, this.body);
    this.scrim.appendChild(this.win);
    document.body.appendChild(this.scrim);

    this.scrim.addEventListener('pointerdown', (e) => {
      if (e.target === this.scrim) this.close();
    });
    this.scrim.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.video?.pause();
      else this.playVideo();
    });
    this.resizeObserver.observe(this.win);
  }

  get currentMode(): Mode {
    return this.mode;
  }

  get currentProject(): Project | null {
    return this.project;
  }

  /** Open the preview for a project; `opener` gets focus back on close. */
  openPreview(project: Project, opener: HTMLElement | null): void {
    this.begin(project, opener, 'preview');
    this.renderPreview(project);
    this.finish(false);
  }

  /** Open (or expand to) the detail view. `quiet` skips the mode-change hook's URL work. */
  openDetail(project: Project, opener: HTMLElement | null, quiet = false): void {
    this.begin(project, opener ?? this.opener, 'detail');
    this.renderDetail(project);
    this.finish(quiet);
  }

  /** Close the window and return focus to the chip that opened it. */
  close(quiet = false): void {
    if (this.mode === 'closed') return;
    this.mode = 'closed';
    this.scrim.hidden = true;
    this.video?.pause();
    this.video = null;
    this.body.replaceChildren();
    this.opener?.setAttribute('aria-expanded', 'false');
    if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
    this.project = null;
    this.onModeChange?.('closed', null, quiet);
  }

  private begin(project: Project, opener: HTMLElement | null, mode: Mode): void {
    if (this.opener !== opener) this.opener?.setAttribute('aria-expanded', 'false');
    this.project = project;
    this.opener = opener;
    this.mode = mode;
    this.galleryIndex = 0;
    this.video = null;
    this.body.replaceChildren();
    this.win.classList.toggle('is-detail', mode === 'detail');
    this.scrim.hidden = false;
    opener?.setAttribute('aria-expanded', 'true');
  }

  private finish(quiet: boolean): void {
    const title = this.body.querySelector('h2');
    if (title !== null) {
      title.id = 'project-window-title';
      this.win.setAttribute('aria-labelledby', title.id);
    }
    this.body.scrollTop = 0;
    this.redrawFrame();
    this.win.focus({ preventScroll: true });
    this.playVideo();
    this.onModeChange?.(this.mode, this.project, quiet);
  }

  private redrawFrame(): void {
    if (this.mode === 'closed' || this.project === null) return;
    const block = Math.max(4, Math.round(this.tileSize()));
    this.win.style.setProperty('--frame', `${block * 2}px`);
    drawFrame(this.frame, this.frameMaterial(this.project), block, 2);
  }

  private header(project: Project): HTMLElement[] {
    const tags = element('p', 'win-tags');
    for (const tag of project.tags) tags.appendChild(element('span', undefined, tag));
    return [element('h2', 'win-title', project.title), tags];
  }

  private renderPreview(project: Project): void {
    const shot = project.screenshots[0];
    const actions = element('div', 'win-actions');
    const more = element('button', 'win-more', 'Read more');
    more.type = 'button';
    more.addEventListener('click', () => this.openDetail(project, this.opener));
    actions.append(more, this.closeButton());
    this.body.append(
      ...this.header(project),
      pixelated(shot.src, shot.alt),
      element('p', 'win-blurb', project.blurb),
      actions,
    );
  }

  private closeButton(): HTMLButtonElement {
    const close = element('button', 'win-close', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    return close;
  }

  private renderDetail(project: Project): void {
    const facts = element('p', 'win-facts');
    for (const [label, text] of [
      ['Role', project.role],
      ['Timeline', project.timeline],
      ['Stack', project.stack.join(', ')],
      ['Outcome', project.outcome],
    ]) {
      const fact = element('span', 'win-fact');
      fact.append(element('span', 'win-fact-label', label), ` ${text}`);
      facts.append(fact, ' ');
    }
    this.body.append(...this.header(project), facts);
    if (project.video) this.body.appendChild(this.createVideo(project));
    this.body.appendChild(this.createGallery(project));
    for (const section of project.sections) {
      this.body.append(element('h3', 'win-heading', section.heading), element('p', 'win-text', section.body));
    }
    if (project.links.length > 0) {
      const links = element('p', 'win-links');
      for (const link of project.links) {
        const a = element('a', undefined, link.label);
        a.href = link.href;
        a.target = '_blank';
        a.rel = 'noopener';
        links.append(a, ' ');
      }
      this.body.appendChild(links);
    }
    const actions = element('div', 'win-actions');
    actions.appendChild(this.closeButton());
    this.body.appendChild(actions);
  }

  private createVideo(project: Project): HTMLVideoElement {
    const video = element('video', 'win-video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.poster = project.screenshots[0].src;
    video.controls = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (project.video?.webm) video.appendChild(Object.assign(element('source'), { src: project.video.webm, type: 'video/webm' }));
    if (project.video?.mp4) video.appendChild(Object.assign(element('source'), { src: project.video.mp4, type: 'video/mp4' }));
    this.video = video;
    return video;
  }

  private playVideo(): void {
    if (this.video === null || this.mode !== 'detail' || document.hidden) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    void this.video.play().catch(() => undefined);
  }

  private createGallery(project: Project): HTMLElement {
    const shots = project.screenshots;
    const figure = element('figure', 'win-gallery');
    const image = element('img', 'win-image');
    image.decoding = 'async';
    const caption = element('figcaption', 'win-caption');
    const nav = element('div', 'win-gallery-nav');
    const show = (index: number): void => {
      this.galleryIndex = (index + shots.length) % shots.length;
      const shot = shots[this.galleryIndex];
      image.src = shot.src;
      image.alt = shot.alt;
      caption.textContent = `${shot.caption ?? shot.alt} (${this.galleryIndex + 1} of ${shots.length})`;
    };
    show(0);
    if (shots.length > 1) {
      for (const [label, step] of [['Previous', -1], ['Next', 1]] as const) {
        const button = element('button', 'win-step', label);
        button.type = 'button';
        button.addEventListener('click', () => show(this.galleryIndex + step));
        nav.appendChild(button);
      }
      figure.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') show(this.galleryIndex - 1);
        else if (e.key === 'ArrowRight') show(this.galleryIndex + 1);
      });
    }
    figure.append(image, caption, nav);
    return figure;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...this.win.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hidden);
    if (items.length === 0) {
      e.preventDefault();
      this.win.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === this.win)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
