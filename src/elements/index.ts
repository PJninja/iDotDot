import { ElementRegistry } from '../engine/element';
import { Air } from './air';
import { Bomb } from './bomb';
import { Dirt } from './dirt';
import { Ember } from './ember';
import { Explosion } from './explosion';
import { Flame } from './flame';
import { Mud } from './mud';
import { Sand } from './sand';
import { Smoke } from './smoke';
import { Spark } from './spark';
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
  registry.register(new Ember());
  registry.register(new Flame());
  registry.register(new Spark());
  registry.register(new Explosion());
  registry.register(new Bomb());
  return registry;
}
