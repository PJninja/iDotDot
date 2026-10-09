import { ElementRegistry } from '../engine/element';
import { Air } from './air';
import { Dirt } from './dirt';
import { Mud } from './mud';
import { Sand } from './sand';
import { Smoke } from './smoke';
import { Steam } from './steam';
import { Water } from './water';
import { WetSand } from './wet-sand';
import { Wood } from './wood';

/**
 * Create an ElementRegistry with every element type registered.
 * Type 0 is Air (reserved); all element types must be registered here.
 */
export function createElementRegistry(): ElementRegistry {
  const registry = new ElementRegistry();
  registry.register(new Air());
  registry.register(new Sand());
  registry.register(new Dirt());
  registry.register(new Smoke());
  registry.register(new Water());
  registry.register(new Steam());
  registry.register(new Wood());
  registry.register(new WetSand());
  registry.register(new Mud());
  return registry;
}
