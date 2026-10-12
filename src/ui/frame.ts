import { snapToDevicePixels } from '../engine/grid-geometry';
import { SETTINGS } from '../settings';

/** Header height in CSS px, rounded to whole device pixels so the canvas under it starts on a pixel edge. */
export function headerHeight(): number {
  return snapToDevicePixels(SETTINGS.HEADER_HEIGHT, window.devicePixelRatio || 1);
}

/** Publish the snapped header height to the stylesheet (`--header-height`) and return it; call on load and every resize. */
export function applyHeaderHeight(): number {
  const height = headerHeight();
  document.documentElement.style.setProperty('--header-height', `${height}px`);
  return height;
}
