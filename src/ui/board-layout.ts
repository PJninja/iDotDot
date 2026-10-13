import { worldPlacement } from '../engine/world-file';
import {
  COMPACT,
  COMPACT_MIN_WIDTH,
  MIN_CANVAS_HEIGHT,
  MOBILE,
  NARROW,
  NARROW_MIN_WIDTH,
  RING_CELLS,
  TALL_CANVAS_HEIGHT,
  WIDE,
  WIDE_MIN_WIDTH,
  WORLD_CELLS,
  footprint,
  isMobileWorld,
  type BoardGeometry,
  type CellRect,
} from '../worlds/board-slots';

/** A rectangle of grid cells. */
export interface CellBox {
  gx: number;
  gy: number;
  gw: number;
  gh: number;
}

/** Shortest gallery at text scale 1, in CSS px: one line of 13px text with room for its underline. */
const GALLERY_MIN_PX = 24;

export type BoardMode = 'wide' | 'narrow' | 'compact';

export interface BoardPlacement {
  mode: BoardMode;
  /** Chip interiors (the colliders); the ring sits `ring` cells outside each. */
  chips: CellBox[];
  /** Interior of the gallery corridor. */
  gallery: CellBox;
  /** Ring thickness in cells. */
  ring: number;
  /** Chip and gallery text scale of the layout. */
  chipScale: number;
  galleryScale: number;
}

export interface PlacementInput {
  /** CSS px per cell. */
  tile: number;
  gridWidth: number;
  gridHeight: number;
  /** Window size in CSS px. */
  windowWidth: number;
  windowHeight: number;
  /** Height of the header above the canvas in CSS px. */
  headerHeight: number;
  /** Size of the default world the board sits in (the 640-wide worlds when omitted, e.g. an empty grid). */
  world?: { width: number; height: number; tileCss: number };
}

/**
 * Place the board for the current window: the wide block (four big chips) from
 * `WIDE_MIN_WIDTH`, one column of two big chips from `NARROW_MIN_WIDTH`, and one column of
 * two small chips below that (in the phone world, `MOBILE`, when that is the loaded world). Slots are world cells mapped through the same
 * bottom-center anchor as the default world, so a chip stays on the same patch of rock at
 * every window size. Null when the canvas is shorter than `MIN_CANVAS_HEIGHT`, narrower than
 * the compact layout, the phone world is loaded in a window that is not compact, or the
 * board would fall outside the visible grid; the caller then shows the plain page.
 */
export function placeBoard(input: PlacementInput): BoardPlacement | null {
  if (input.windowHeight - input.headerHeight < MIN_CANVAS_HEIGHT) return null;
  if (input.windowWidth < COMPACT_MIN_WIDTH) return null;
  const tall = input.windowHeight - input.headerHeight >= TALL_CANVAS_HEIGHT;
  const mode: BoardMode = !tall || input.windowWidth < NARROW_MIN_WIDTH ? 'compact' : input.windowWidth >= WIDE_MIN_WIDTH ? 'wide' : 'narrow';
  const world = input.world ?? WORLD_CELLS;
  const mobileWorld = isMobileWorld(world);
  if (mobileWorld && mode !== 'compact') return null;
  const geometry: BoardGeometry = mobileWorld ? MOBILE : { wide: WIDE, narrow: NARROW, compact: COMPACT }[mode];

  const { tile, gridWidth, gridHeight } = input;
  const at = worldPlacement(world, gridWidth, gridHeight, tile);
  const ring = Math.max(1, Math.round(RING_CELLS * at.scale));
  // Round inward so a mapped box never covers a cell the authored box did not.
  const map = (r: CellRect): CellBox => {
    const x0 = Math.ceil(r.x * at.scale) + at.dx;
    const y0 = Math.ceil(r.y * at.scale) + at.dy;
    return {
      gx: x0,
      gy: y0,
      gw: Math.floor((r.x + r.w) * at.scale) + at.dx - x0,
      gh: Math.floor((r.y + r.h) * at.scale) + at.dy - y0,
    };
  };

  const chips = geometry.slots.map(map);
  const gallery = map(geometry.gallery);
  // Large tiles make the corridor shorter than one line of text; grow it down into the lining.
  gallery.gh = Math.max(gallery.gh, Math.ceil((GALLERY_MIN_PX * geometry.galleryScale) / tile));
  const visibleColumns = Math.floor(input.windowWidth / tile);
  const boxes = [...geometry.slots.map((s) => footprint(s)), geometry.gallery].map(map);
  for (const box of boxes) {
    const inside = box.gx >= 0 && box.gy >= 0 && box.gx + box.gw <= Math.min(gridWidth, visibleColumns) && box.gy + box.gh <= gridHeight;
    if (!inside || box.gw < 1 || box.gh < 1) return null;
  }
  return { mode, chips, gallery, ring, chipScale: geometry.chipScale, galleryScale: geometry.galleryScale };
}
