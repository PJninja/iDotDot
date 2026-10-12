/**
 * Where the portfolio board sits in every default world, in world cells (640 x 348 at 4 px).
 * Shared by the runtime board and by the scene scripts in tools/, which build the
 * underground around these boxes. Pure and import-free so Node can load it.
 *
 * The block is a 3 x 2 grid of chip slots with a one-line gallery corridor under it. A slot
 * is the chip interior (the collider); the tile ring sits `RING_CELLS` outside it.
 */
export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardGeometry {
  /** Chip interiors in page order, left to right then top to bottom. */
  slots: readonly CellRect[];
  /** Interior of the corridor that holds the search, tag words and pager. */
  gallery: CellRect;
}

/** Authoring size of the default worlds: 1440p at 4 px tiles. */
export const WORLD_CELLS = { width: 640, height: 348, tileCss: 4 } as const;

export const CHIP_CELLS = { w: 50, h: 27 } as const;
export const RING_CELLS = 2;
/** Cells around a ring that scenery keeps inert: no fire, water, acid, heat, steel, ice or wood. */
export const KEEP_OUT_CELLS = 2;
/** Cells of brick lining around the gallery interior. */
export const GALLERY_LINING = 2;

const COLUMNS = 3;
const ROWS = 2;
const COLUMN_GAP = 10;
const ROW_GAP = 8;
const FOOT_W = CHIP_CELLS.w + 2 * RING_CELLS;
const FOOT_H = CHIP_CELLS.h + 2 * RING_CELLS;

/** Left edge and top of the whole block, ring included. */
export const BLOCK = {
  x: Math.round((WORLD_CELLS.width - (COLUMNS * FOOT_W + (COLUMNS - 1) * COLUMN_GAP)) / 2),
  y: 202,
  w: COLUMNS * FOOT_W + (COLUMNS - 1) * COLUMN_GAP,
  h: ROWS * FOOT_H + (ROWS - 1) * ROW_GAP,
} as const;

const GALLERY_ROW = BLOCK.y + BLOCK.h + 4 + GALLERY_LINING;
const GALLERY_ROWS = 8;

function slotAt(column: number, row: number): CellRect {
  return {
    x: BLOCK.x + RING_CELLS + column * (FOOT_W + COLUMN_GAP),
    y: BLOCK.y + RING_CELLS + row * (FOOT_H + ROW_GAP),
    w: CHIP_CELLS.w,
    h: CHIP_CELLS.h,
  };
}

/** Windows at least `WIDE_MIN_WIDTH` CSS px wide show all six slots. */
export const WIDE: BoardGeometry = {
  slots: Array.from({ length: COLUMNS * ROWS }, (_, i) => slotAt(i % COLUMNS, Math.floor(i / COLUMNS))),
  gallery: { x: BLOCK.x + GALLERY_LINING, y: GALLERY_ROW, w: BLOCK.w - 2 * GALLERY_LINING, h: GALLERY_ROWS },
};

/** Narrower windows show the middle column, so both layouts share that strip of rock. */
export const NARROW: BoardGeometry = {
  slots: [slotAt(1, 0), slotAt(1, 1)],
  gallery: { x: WORLD_CELLS.width / 2 - 40, y: GALLERY_ROW, w: 80, h: GALLERY_ROWS },
};

export const WIDE_MIN_WIDTH = 760;
export const NARROW_MIN_WIDTH = 320;
/** Shortest canvas (window height minus the header) that shows the whole block. */
export const MIN_CANVAS_HEIGHT = 600;

/** Slot interior plus its ring. */
export function footprint(slot: CellRect, ring = RING_CELLS): CellRect {
  return { x: slot.x - ring, y: slot.y - ring, w: slot.w + 2 * ring, h: slot.h + 2 * ring };
}

/** Gallery interior plus its brick lining. */
export function corridor(gallery: CellRect): CellRect {
  return {
    x: gallery.x - GALLERY_LINING,
    y: gallery.y - GALLERY_LINING,
    w: gallery.w + 2 * GALLERY_LINING,
    h: gallery.h + 2 * GALLERY_LINING,
  };
}
