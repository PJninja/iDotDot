import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';
import { POWER_HOLD_AGE_RATE, poweredBy } from './powered';
import { Torch } from './torch';

/**
 * Lit torch A (type 44) - a powered torch that is burning, hidden from the picker. It emits
 * flames like a Torch and keeps its chunk awake. It ages back into a powered torch; a pulse
 * touching it swaps it for its twin, lit torch B, which restarts the age. See `poweredBy`.
 */
export class LitTorchA extends Element {
  readonly type = SETTINGS.LIT_TORCH_A_TYPE;
  readonly name = 'lit-torch-a';
  readonly displayName = 'Lit Torch';
  readonly defaultColor: [number, number, number] = [226, 138, 56];
  readonly hidden = true;

  readonly ageRate = POWER_HOLD_AGE_RATE;
  readonly agedInto = [{ type: SETTINGS.POWERED_TORCH_TYPE, chance: 1 }];
  readonly emitType = SETTINGS.FLAME_TYPE;
  readonly emitChance = Torch.EMIT_CHANCE;
  readonly blastResistance = 0.3;
  readonly reactions: readonly Reaction[] = poweredBy(SETTINGS.LIT_TORCH_B_TYPE);

  getColor(_value: number, _age: number): [number, number, number] {
    return this.defaultColor;
  }
}
