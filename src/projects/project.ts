/** Border materials a project can choose: static solids, so the ring holds until something burns, melts or dissolves it. */
export const BORDER_MATERIALS = ['stone', 'steel', 'wood', 'ice'] as const;
export type BorderMaterial = (typeof BORDER_MATERIALS)[number];

/** Longest chip description and tag that fit a chip without being cut off. */
export const MAX_SUMMARY_CHARS = 56;
export const MAX_TAG_CHARS = 14;

export interface Screenshot {
  /** Bundled image URL (import it with Vite). */
  src: string;
  alt: string;
  caption?: string;
}

export interface ProjectLink {
  label: string;
  href: string;
}

export interface ProjectSection {
  heading: string;
  body: string;
}

/** Optional short silent clip; the poster is the first screenshot. */
export interface ProjectVideo {
  webm?: string;
  mp4?: string;
}

/**
 * One portfolio entry. Every project has the same shape so the board, the preview window,
 * the detail view and the plain page render it identically. Add a project by creating
 * `src/projects/<id>.ts` with a default export of this type.
 */
export interface Project {
  /** kebab-case; also the URL hash (`#/<id>`). */
  id: string;
  title: string;
  /** Chip description, two lines at most (`MAX_SUMMARY_CHARS`). */
  summary: string;
  /** Exactly three, shown on the chip and used by the tag filter. */
  tags: readonly [string, string, string];
  /** Inline SVG markup drawn with `currentColor`, 24 x 24 viewBox. */
  icon: string;
  /** Material of the chip's tile ring. */
  border: BorderMaterial;
  /** Lower comes first. */
  order: number;
  /** Text in the preview window. */
  blurb: string;
  sections: readonly ProjectSection[];
  screenshots: readonly Screenshot[];
  links: readonly ProjectLink[];
  role: string;
  timeline: string;
  stack: readonly string[];
  outcome: string;
  video?: ProjectVideo;
}
