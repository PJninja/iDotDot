import { Element, NO_FRAGMENT } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Debris (type 51) - a tile a blast threw, hidden from the picker. The outer part of a
 * blast launches the tiles it takes instead of destroying them (blastHit in
 * engine/gpu/shaders.ts): the debris tile keeps the type it was in its variant byte, its
 * velocity in the value byte (as Spark) and its flight time in the age byte. It flies
 * ballistically through air, gases and liquids (updateDebris) and lands as the thrown
 * type's fragment (Element.thrownAs: sand stays sand, stone lands as rubble). A tile
 * thrown into more rock is blocked at once and lands in place, which is what loosens
 * the ground around a buried blast. It is drawn in the color of the type it carries.
 */
export class Debris extends Element {
  readonly type = SETTINGS.DEBRIS_TYPE;
  readonly name = 'debris';
  readonly displayName = 'Debris';
  readonly defaultColor: [number, number, number] = [112, 104, 98];
  readonly hidden = true;

  /** Chance per step that gravity adds one cell per step of downward speed. */
  static GRAVITY = 0.5;
  /** Chance per step that the sideways speed drops by one. */
  static DRAG = 0.15;
  /** Steps a tile may fly before it lands wherever it is, so none flies for ever. */
  static MAX_FLIGHT = 180;
  /** Fraction of the blast's reach past which the tiles it takes are thrown instead of destroyed. */
  static THROW_FROM = 0.3;
  /** Share of the tiles taken at the very edge of the reach that are thrown (less further in). */
  static THROW_SHARE = 0;

  /** Heavier than anything, so nothing displaces it and it plows through liquids and gases. */
  readonly density = 3;
  readonly fragmentType = NO_FRAGMENT;

  getColor(_value: number, _variant: number): [number, number, number] {
    return this.defaultColor;
  }
}
