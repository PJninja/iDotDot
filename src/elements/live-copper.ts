import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Live copper (type 38) - copper carrying an electric pulse, hidden from the picker. Static,
 * flashes warm white and fades to copper as it ages. Copper, steel, fuses and water beside it
 * turn live or shocked (their own rules name it). Unlike live steel it throws no arcs and
 * always ends as spent copper, never as hot steel.
 */
export class LiveCopper extends Element {
  readonly type = SETTINGS.LIVE_COPPER_TYPE;
  readonly name = 'live-copper';
  readonly displayName = 'Live Copper';
  readonly defaultColor: [number, number, number] = [255, 226, 190];
  readonly hidden = true;

  /** Age steps per sim step (8 = 32 steps); shorter-lived than SpentCopper, or the pulse bounces. */
  static AGE_RATE = 8;

  readonly ageRate = LiveCopper.AGE_RATE;
readonly glow = 0.25;
  readonly agedInto = [{ type: SETTINGS.SPENT_COPPER_TYPE, chance: 1 }];
  readonly blastResistance = 0.95;

  private readonly ramp = buildGradient([
    { at: 0, color: [255, 240, 220] },
    { at: 0.3, color: [255, 186, 120] },
    { at: 1, color: [184, 104, 62] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
