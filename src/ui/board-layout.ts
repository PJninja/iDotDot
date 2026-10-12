/** Geometry of the chip board, in grid cells. Pure, so it can be checked without a browser. */
export interface ChipBox {
  /** Interior (the collider); the ring sits `ring` cells outside it. */
  gx: number;
  gy: number;
  gw: number;
  gh: number;
}

export interface BoardLayout {
  chips: ChipBox[];
  /** Ring thickness in cells. */
  ring: number;
  /** Shrink factor applied to the ideal chip size, used to scale chip text. */
  scale: number;
}

export interface BoardLayoutInput {
  /** CSS px per cell. */
  tile: number;
  /** Visible canvas width in CSS px. */
  canvasWidth: number;
  /** Grid size in cells; the grid is anchored to the canvas bottom. */
  gridHeight: number;
  /** First grid row chips may occupy. */
  topRow: number;
  count: number;
}

const IDEAL_WIDTH = 200;
const IDEAL_HEIGHT = 108;
const MIN_SCALE = 0.8;
const SCALE_STEP = 0.05;

/** Margin, in CSS px, kept around the board and between rings. */
export const BOARD_MARGIN = 24;
const RING_PX = 8;
const GAP_PX = 20;

/**
 * Place `count` chips in a left-aligned grid of whole cells. Chips shrink from their ideal
 * size down to MIN_SCALE until every row fits above the bottom margin; null means they do
 * not fit at all (small windows), and the caller shows the plain page instead.
 */
export function layoutChips(input: BoardLayoutInput): BoardLayout | null {
  const { tile, count } = input;
  const cells = (px: number): number => Math.max(1, Math.round(px / tile));
  const ring = cells(RING_PX);
  const margin = cells(BOARD_MARGIN);
  const gap = Math.max(cells(GAP_PX), 2);
  const availWidth = Math.floor(input.canvasWidth / tile) - 2 * margin;
  const availHeight = input.gridHeight - margin - input.topRow;
  if (count === 0) return { chips: [], ring, scale: 1 };

  for (let scale = 1; scale >= MIN_SCALE - 1e-9; scale -= SCALE_STEP) {
    const gw = cells(IDEAL_WIDTH * scale);
    const gh = cells(IDEAL_HEIGHT * scale);
    const footW = gw + 2 * ring;
    const footH = gh + 2 * ring;
    if (footW > availWidth) continue;
    const cols = Math.min(count, Math.max(1, Math.floor((availWidth + gap) / (footW + gap))));
    const rows = Math.ceil(count / cols);
    if (rows * footH + (rows - 1) * gap > availHeight) continue;
    const chips: ChipBox[] = [];
    for (let i = 0; i < count; i++) {
      chips.push({
        gx: margin + ring + (i % cols) * (footW + gap),
        gy: input.topRow + ring + Math.floor(i / cols) * (footH + gap),
        gw,
        gh,
      });
    }
    return { chips, ring, scale };
  }
  return null;
}
