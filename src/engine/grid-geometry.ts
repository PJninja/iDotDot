/**
 * Canvas and grid sizes for one window, worked out in whole device pixels so nothing depends on
 * the browser rounding fractional CSS pixels (which is what happens at any non-round zoom or on
 * phones with a ratio like 2.625). Pure and import-free, so it can be checked in Node.
 */
export interface GridGeometry {
  /** Canvas backing size in device pixels. */
  deviceWidth: number;
  deviceHeight: number;
  /** Canvas size on screen in CSS px: the backing size divided by the ratio, so one canvas pixel is one device pixel. */
  cssWidth: number;
  cssHeight: number;
  /** Tile edge in device pixels (a whole number) and in CSS px (`tilePx / dpr`, may be fractional). */
  tilePx: number;
  tileSize: number;
  /** Grid size in cells. */
  width: number;
  height: number;
  /** CSS y of grid row 0 relative to the canvas top (<= 0: the grid is anchored to the canvas bottom). */
  originY: number;
}

/** Tolerance for a CSS size times the ratio that is whole except for floating-point error. */
const WHOLE_PIXEL_EPSILON = 1e-6;

/**
 * Geometry for an area of `cssWidth` x `cssHeight` CSS px at pixel ratio `dpr`. The canvas gets the
 * largest whole number of device pixels that fits, tiles are `requestedTile` CSS px rounded to whole
 * device pixels (grown if an axis would exceed `maxDimension` cells), and the grid is anchored to
 * the canvas bottom.
 */
export function computeGridGeometry(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  requestedTile: number,
  maxDimension: number,
): GridGeometry {
  const deviceWidth = Math.max(1, Math.floor(cssWidth * dpr + WHOLE_PIXEL_EPSILON));
  const deviceHeight = Math.max(1, Math.floor(cssHeight * dpr + WHOLE_PIXEL_EPSILON));
  const tilePx = Math.max(1, Math.round(requestedTile * dpr), Math.ceil(Math.max(deviceWidth, deviceHeight) / maxDimension));
  const width = Math.ceil(deviceWidth / tilePx);
  const height = Math.ceil(deviceHeight / tilePx);
  return {
    deviceWidth,
    deviceHeight,
    cssWidth: deviceWidth / dpr,
    cssHeight: deviceHeight / dpr,
    tilePx,
    tileSize: tilePx / dpr,
    width,
    height,
    originY: (deviceHeight - height * tilePx) / dpr,
  };
}

/** A CSS length rounded to whole device pixels (at least one), so what it positions starts on a pixel edge. */
export function snapToDevicePixels(cssPx: number, dpr: number): number {
  return Math.max(1, Math.round(cssPx * dpr)) / dpr;
}
