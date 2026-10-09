import { SETTINGS } from '../settings';

/**
 * Which GPU dispatch moves an element. Solids run in `main`: they fall when
 * they have a gravityQuantum (powders) and otherwise stay put. Liquids run in
 * `mainLiquid` (all liquids share Water's flow tuning), gases in `mainGas`
 * (rising with the shared smoke flow field).
 */
export type ElementPhase = 'solid' | 'liquid' | 'gas';

/**
 * Reaction: a tile of the owning element touching (8-neighborhood) a tile of
 * type `with` turns into type `becomes` with `chance` per step. By default it is
 * one-sided: only the owning tile changes, which keeps reactions conflict-free
 * on the GPU; give the other element its own rule for a two-sided reaction.
 * With `consumes`, the touched tile turns into air in the same step, one per
 * conversion (e.g. sand soaking up water). A non-consuming rule can reach
 * further with `radius` (Chebyshev distance, default 1 = the 8 neighbors),
 * e.g. sand soaking up moisture from nearby water.
 */
export interface Reaction {
  with: number;
  becomes: number;
  chance: number;
  consumes?: boolean;
  radius?: number;
}

/** Most reaction rules across all elements (size of the GPU reaction table). */
export const MAX_REACTIONS = 64;

/** Largest reaction radius; within one chunk so a change in range always wakes the reacting chunk. */
export const MAX_REACTION_RADIUS = 8;

/**
 * One instance per element TYPE (not per tile). Elements are display and
 * tuning metadata only: per-tile behavior runs on the GPU in the compute
 * shader (engine/gpu/shaders.ts), driven by per-type tables built from
 * these fields.
 */
export abstract class Element {
  abstract readonly type: number;
  abstract readonly name: string;
  /** Human-readable name for UI display. */
  abstract readonly displayName: string;
  abstract readonly defaultColor: [number, number, number];

  abstract getColor(value: number, variant: number): [number, number, number];

  /** Which dispatch moves this element (see ElementPhase). */
  readonly phase: ElementPhase = 'solid';

  /**
   * Effective fall rate in fixed-point quanta (256 = 1 cell/step); 0 = does
   * not fall. Falling elements set it from computeGravityQuantum; the GPU
   * backend uploads it as its per-type gravity table.
   */
  readonly gravityQuantum: number = 0;

  /**
   * Falling elements only: probability a tile resting on a slope (exactly one
   * open diagonal) rolls off. 1 = no friction (classic piles); lower values
   * give steep, clumpy piles. A tile on a point (both diagonals open) always
   * rolls; a fully supported tile rests.
   */
  readonly slideChance: number = 1;

  /**
   * Relative density. A falling tile or liquid sinks through liquid and gas
   * tiles with a lower density, displacing them (water is 1, so the default
   * makes falling solids sink in water).
   */
  readonly density: number = 1.5;

  /**
   * Falling elements only: how strongly tiles stick to other cohesive tiles
   * (0..1, 0 = loose powder). Per step, a tile about to fall clings to a resting
   * cohesive neighbor beside it, and one about to roll off a slope stays put while
   * touching a cohesive tile, each with this chance. Gives clumps and overhangs.
   */
  readonly cohesion: number = 0;

  /** Gases only: chance per step that a tile rises one cell (0..1). */
  readonly riseSpeed: number = 0;

  /** Gases only: chance per step that a tile vanishes (0..1). */
  readonly dissipationChance: number = 0;

  /**
   * Draw this element through a haze channel instead of as tiles:
   * 0 = smoke-style haze, 1 = water body, 2 = steam-style haze (see
   * RENDER_WGSL). null = drawn as tiles from getColor.
   */
  readonly hazeChannel: number | null = null;

  /**
   * Age steps a tile gains per sim step (fractions roll by chance per tile), so the
   * mean lifetime is about 256 / ageRate steps. 0 = does not age. The age lives in
   * the tile's age byte; for an aging type getColor's second argument is the age
   * (0..255) instead of the variant, so the color can follow a ramp over its life.
   */
  readonly ageRate: number = 0;

  /** What an aging tile turns into once its age passes 255 (AIR = it vanishes). */
  readonly agedInto: number = SETTINGS.AIR_TYPE;

  /** One-sided reactions this element undergoes (see Reaction). */
  readonly reactions: readonly Reaction[] = [];
}

/**
 * Maps element type IDs (0–255) to Element instances.
 * Type 0 is reserved for Air.
 */
export class ElementRegistry {
  private readonly elements: (Element | null)[] = new Array<Element | null>(256).fill(null);

  register(element: Element): void {
    const type = element.type;
    if (!Number.isInteger(type) || type < 0 || type > 255) {
      throw new Error(`Element type must be an integer in [0, 255], got ${type}`);
    }
    if (type !== SETTINGS.AIR_TYPE && element.name === 'air') {
      throw new Error('Type 0 is reserved for Air');
    }
    const existing = this.elements[type];
    if (existing !== null) {
      throw new Error(`Element type ${type} already registered as "${existing.name}"`);
    }
    if (!Number.isFinite(element.ageRate) || element.ageRate < 0 || element.ageRate > 255) {
      throw new Error(`Age rate of "${element.name}" must be in [0, 255], got ${element.ageRate}`);
    }
    if (!Number.isInteger(element.agedInto) || element.agedInto < 0 || element.agedInto > 255) {
      throw new Error(`agedInto of "${element.name}" is an invalid type ${element.agedInto}`);
    }
    for (const r of element.reactions) {
      for (const t of [r.with, r.becomes]) {
        if (!Number.isInteger(t) || t < 0 || t > 255) {
          throw new Error(`Reaction of "${element.name}" names invalid type ${t}`);
        }
      }
      const radius = r.radius ?? 1;
      if (!Number.isInteger(radius) || radius < 1 || radius > MAX_REACTION_RADIUS) {
        throw new Error(`Reaction radius of "${element.name}" must be an integer in [1, ${MAX_REACTION_RADIUS}], got ${radius}`);
      }
      if (r.consumes && radius !== 1) {
        throw new Error(`Consuming reaction of "${element.name}" must have radius 1`);
      }
    }
    // A tile cannot both take and make a consuming offer in one step.
    const consumes = element.reactions.filter((r) => r.consumes);
    for (const other of this.list()) {
      const othersConsume = other.reactions.filter((r) => r.consumes);
      if (consumes.some((r) => r.with === other.type) && othersConsume.length > 0
        || othersConsume.some((r) => r.with === type) && consumes.length > 0) {
        throw new Error(`"${element.name}" and "${other.name}" both own consuming reactions and one consumes the other`);
      }
    }
    const ruleCount = this.list().reduce((n, e) => n + e.reactions.length, 0);
    if (ruleCount + element.reactions.length > MAX_REACTIONS) {
      throw new Error(`More than ${MAX_REACTIONS} reaction rules registered`);
    }
    this.elements[type] = element;
  }

  get(type: number): Element | null {
    return this.elements[type] ?? null;
  }

  /** All registered elements, ordered by type ID. */
  list(): Element[] {
    return this.elements.filter((e): e is Element => e !== null);
  }
}
