import { worldPlacement } from '../engine/world-file';
import {
  MIN_CANVAS_HEIGHT,
  NARROW,
  NARROW_MIN_WIDTH,
  RING_CELLS,
  WIDE,
  WIDE_MIN_WIDTH,
  WORLD_CELLS,
  footprint,
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

/** Shortest gallery, in CSS px: one line of 13px text with room for its underline. */
const GALLERY_MIN_PX = 24;

export type BoardMode = 'wide' | 'narrow';

export interface BoardPlacement {
  mode: BoardMode;
  /** Chip interiors (the colliders); the ring sits `ring` cells outside each. */
  chips: CellBox[];
  /** Interior of the gallery corridor. */
  gallery: CellBox;
  /** Ring thickness in cells. */
  ring: number;
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
}

/**
 * Place the board for the current window: the wide block (six slots) from `WIDE_MIN_WIDTH`,
 * the narrow column (two slots) below it. Slots are world cells mapped through the same
 * bottom-center anchor as the default world, so a chip stays on the same patch of rock at
 * every window size. Null when the canvas is shorter than `MIN_CANVAS_HEIGHT`, narrower than
 * the narrow layout, or the board would fall outside the visible grid; the caller then
 * shows the plain page.
 */
export function placeBoard(input: PlacementInput): BoardPlacement | null {
  if (input.windowHeight - input.headerHeight < MIN_CANVAS_HEIGHT) return null;
  if (input.windowWidth < NARROW_MIN_WIDTH) return null;
  const mode: BoardMode = input.windowWidth >= WIDE_MIN_WIDTH ? 'wide' : 'narrow';
  const geometry: BoardGeometry = mode === 'wide' ? WIDE : NARROW;

  const { tile, gridWidth, gridHeight } = input;
  const at = worldPlacement(WORLD_CELLS, gridWidth, gridHeight, tile);
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
  gallery.gh = Math.max(gallery.gh, Math.ceil(GALLERY_MIN_PX / tile));
  const visibleColumns = Math.floor(input.windowWidth / tile);
  const boxes = [...geometry.slots.map((s) => footprint(s)), geometry.gallery].map(map);
  for (const box of boxes) {
    const inside = box.gx >= 0 && box.gy >= 0 && box.gx + box.gw <= Math.min(gridWidth, visibleColumns) && box.gy + box.gh <= gridHeight;
    if (!inside || box.gw < 1 || box.gh < 1) return null;
  }
  return { mode, chips, gallery, ring };
}
