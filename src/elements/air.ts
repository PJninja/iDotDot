import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Air (type 0) — the absence of an element. Must remain type 0 so that
 * a zero-initialized grid means "empty". Not rendered; the canvas
 * background shows through instead.
 */
export class Air extends Element {
  readonly type = SETTINGS.AIR_TYPE;
  readonly name = 'air';
  readonly displayName = 'Air';
  readonly defaultColor: [number, number, number] = [0, 0, 0];

  getColor(_value: number, _variant: number): [number, number, number] {
    return this.defaultColor;
  }
}
