import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';
import { POWER_HOLD_AGE_RATE, poweredBy } from './powered';
import { Spring } from './spring';

/** Lit spring B (type 48) - the twin of lit spring A, identical except that a pulse swaps it back into A. */
export class LitSpringB extends Element {
  readonly type = SETTINGS.LIT_SPRING_B_TYPE;
  readonly name = 'lit-spring-b';
  readonly displayName = 'Live Spring';
  readonly defaultColor: [number, number, number] = [108, 190, 255];
  readonly hidden = true;

  readonly ageRate = POWER_HOLD_AGE_RATE;
  readonly agedInto = [{ type: SETTINGS.POWERED_SPRING_TYPE, chance: 1 }];
  readonly emitType = SETTINGS.WATER_TYPE;
  readonly emitChance = Spring.EMIT_CHANCE;
  readonly emitBelow = true;
  readonly blastResistance = 0.9;
  readonly reactions: readonly Reaction[] = poweredBy(SETTINGS.LIT_SPRING_A_TYPE);

  getColor(_value: number, _age: number): [number, number, number] {
    return this.defaultColor;
  }
}
