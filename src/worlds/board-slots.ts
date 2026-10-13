/**
 * Where the portfolio board sits in every default world, in world cells (640 x 380 at 4 px).
 * Shared by the runtime board and by the scene scripts in tools/, which build the
 * underground around these boxes. Pure and import-free so Node can load it.
 *
 * The board is two rows of chips with a one-line gallery corridor under them. A slot is the
 * chip interior (the collider); the tile ring sits `RING_CELLS` outside it. Three layouts
 * share one hall in the rock: wide (2 x 2 big chips), narrow (one column of big chips) and
 * compact (one column of small chips, for phones).
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
  /** Chip text and padding scale (1 = the original 216 x 108 px chip). */
  chipScale: number;
  /** Gallery text scale. */
  galleryScale: number;
}

/** Authoring size of the default worlds: 1440p wide at 4 px tiles, 32 rows taller than the screen shows at 1440p so the board fits above the floor. */
export const WORLD_CELLS = { width: 640, height: 380, tileCss: 4 } as const;

/** Big chip interior (520 x 280 CSS px at 4 px tiles); the compact chip is about a third of its area. */
export const CHIP_CELLS = { w: 130, h: 70 } as const;
export const COMPACT_CHIP_CELLS = { w: 50, h: 27 } as const;
export const RING_CELLS = 2;
/** Cells around a ring that scenery keeps inert: no fire, water, acid, heat, steel, ice or wood. */
export const KEEP_OUT_CELLS = 2;
/** Cells of brick lining around the gallery interior. */
export const GALLERY_LINING = 2;

/** Text scale of the big chips (2 was the 400 x 216 px chip; 2.6 grows it by 30%). */
const BIG_CHIP_SCALE = 2.6;
const COLUMNS = 2;
const ROWS = 2;
const COLUMN_GAP = 4;
const ROW_GAP = 8;
const FOOT_W = CHIP_CELLS.w + 2 * RING_CELLS;
const FOOT_H = CHIP_CELLS.h + 2 * RING_CELLS;
const COMPACT_FOOT_H = COMPACT_CHIP_CELLS.h + 2 * RING_CELLS;

/** Left edge and top of the whole block (the wide layout), ring included. */
export const BLOCK = {
  x: Math.round((WORLD_CELLS.width - (COLUMNS * FOOT_W + (COLUMNS - 1) * COLUMN_GAP)) / 2),
  y: 202,
  w: COLUMNS * FOOT_W + (COLUMNS - 1) * COLUMN_GAP,
  h: ROWS * FOOT_H + (ROWS - 1) * ROW_GAP,
} as const;

/** The free strip between the two chip rows, 4 rows tall: scenery runs through it in every layout. */
export const ROW_STRIP = { y: BLOCK.y + FOOT_H + KEEP_OUT_CELLS, h: ROW_GAP - 2 * KEEP_OUT_CELLS } as const;

const GALLERY_ROW = BLOCK.y + BLOCK.h + 4 + GALLERY_LINING;
const GALLERY_ROWS = 10;
const CENTER = WORLD_CELLS.width / 2;

function slotAt(column: number, row: number): CellRect {
  return {
    x: BLOCK.x + RING_CELLS + column * (FOOT_W + COLUMN_GAP),
    y: BLOCK.y + RING_CELLS + row * (FOOT_H + ROW_GAP),
    w: CHIP_CELLS.w,
    h: CHIP_CELLS.h,
  };
}

/** One big chip per row, centered on the world. */
function narrowSlot(row: number): CellRect {
  return { x: CENTER - CHIP_CELLS.w / 2, y: BLOCK.y + RING_CELLS + row * (FOOT_H + ROW_GAP), w: CHIP_CELLS.w, h: CHIP_CELLS.h };
}

/** Small chips stacked at the foot of the block, just above the gallery, with the row strip clear above them. */
function compactSlot(row: number): CellRect {
  const bottom = BLOCK.y + BLOCK.h;
  const y = bottom - (2 - row) * COMPACT_FOOT_H - (1 - row) * ROW_GAP;
  return { x: CENTER - COMPACT_CHIP_CELLS.w / 2, y: y + RING_CELLS, w: COMPACT_CHIP_CELLS.w, h: COMPACT_CHIP_CELLS.h };
}

/** Windows at least `WIDE_MIN_WIDTH` CSS px wide show four slots in two columns. */
export const WIDE: BoardGeometry = {
  slots: Array.from({ length: COLUMNS * ROWS }, (_, i) => slotAt(i % COLUMNS, Math.floor(i / COLUMNS))),
  gallery: { x: BLOCK.x + GALLERY_LINING, y: GALLERY_ROW, w: BLOCK.w - 2 * GALLERY_LINING, h: GALLERY_ROWS },
  chipScale: BIG_CHIP_SCALE,
  galleryScale: 1.5,
};

/** Windows from `NARROW_MIN_WIDTH` show one column of two big chips. */
export const NARROW: BoardGeometry = {
  slots: [narrowSlot(0), narrowSlot(1)],
  gallery: { x: CENTER - FOOT_W / 2 + GALLERY_LINING, y: GALLERY_ROW, w: FOOT_W - 2 * GALLERY_LINING, h: GALLERY_ROWS },
  chipScale: BIG_CHIP_SCALE,
  galleryScale: 1.5,
};

/** Windows under `NARROW_MIN_WIDTH` (phones) or shorter than `TALL_CANVAS_HEIGHT` show one column of two small chips. */
export const COMPACT: BoardGeometry = {
  slots: [compactSlot(0), compactSlot(1)],
  gallery: { x: CENTER - 40, y: GALLERY_ROW, w: 80, h: GALLERY_ROWS },
  chipScale: 1,
  galleryScale: 1,
};

/**
 * The phone world (`meadow-mobile`): a small world cut to a phone's grid (about 80 to 135
 * columns at 4 px) instead of the middle slice of a 640-wide one. It has its own compact
 * layout, so the same slot sizes sit at different cells: the corridor ends 4 rows above the
 * floor and the block is stacked on it, the same way as in the big worlds.
 */
export const MOBILE_WORLD_CELLS = { width: 136, height: 248, tileCss: 4 } as const;

/** Phone chip interior: the compact chip 30% larger (260 x 140 CSS px at 4 px tiles, text scale 1.3). */
export const MOBILE_CHIP_CELLS = { w: 65, h: 35 } as const;
export const MOBILE_CHIP_SCALE = 1.3;
const MOBILE_FOOT_W = MOBILE_CHIP_CELLS.w + 2 * RING_CELLS;
const MOBILE_FOOT_H = MOBILE_CHIP_CELLS.h + 2 * RING_CELLS;

const MOBILE_CENTER = MOBILE_WORLD_CELLS.width / 2;
const MOBILE_FLOOR_ROWS = 4;
const MOBILE_GALLERY_ROW = MOBILE_WORLD_CELLS.height - MOBILE_FLOOR_ROWS - GALLERY_LINING - GALLERY_ROWS;
const MOBILE_BLOCK_H = 2 * MOBILE_FOOT_H + ROW_GAP;

/** The compact block in the phone world, ring included; the row strip between its chips is `MOBILE_ROW_STRIP`. */
export const MOBILE_BLOCK: CellRect = {
  x: Math.floor(MOBILE_CENTER - MOBILE_FOOT_W / 2),
  y: MOBILE_GALLERY_ROW - GALLERY_LINING - 4 - MOBILE_BLOCK_H,
  w: MOBILE_FOOT_W,
  h: MOBILE_BLOCK_H,
};
export const MOBILE_ROW_STRIP = { y: MOBILE_BLOCK.y + MOBILE_FOOT_H, h: ROW_GAP } as const;

/** One column of two chips in the phone world. */
export const MOBILE: BoardGeometry = {
  slots: [0, 1].map((row) => ({
    x: MOBILE_BLOCK.x + RING_CELLS,
    y: MOBILE_BLOCK.y + RING_CELLS + row * (MOBILE_FOOT_H + ROW_GAP),
    w: MOBILE_CHIP_CELLS.w,
    h: MOBILE_CHIP_CELLS.h,
  })),
  gallery: { x: MOBILE_CENTER - 40, y: MOBILE_GALLERY_ROW, w: 80, h: GALLERY_ROWS },
  chipScale: MOBILE_CHIP_SCALE,
  galleryScale: 1,
};

/** True for a world authored at the phone world's size, which the board lays out with `MOBILE`. */
export function isMobileWorld(world: { width: number; height: number }): boolean {
  return world.width === MOBILE_WORLD_CELLS.width && world.height === MOBILE_WORLD_CELLS.height;
}

export const WIDE_MIN_WIDTH = 1120;
export const NARROW_MIN_WIDTH = 540;
export const COMPACT_MIN_WIDTH = 320;
/** Shortest canvas (window height minus the header) that shows the compact layout. */
export const MIN_CANVAS_HEIGHT = 600;
/** Shortest canvas that shows the whole wide or narrow block (rows 198 to the floor of a 380-row world). */
export const TALL_CANVAS_HEIGHT = 728;

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
