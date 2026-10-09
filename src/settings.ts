/**
 * All global configurable constants for the simulation and UI.
 */
export const SETTINGS = {
  /** Simulation tick rate (fixed timestep). */
  SIM_HZ: 60,
  /**
   * Tile edge in CSS pixels. Snapped to whole device pixels so every tile is
   * the same size at any devicePixelRatio. Bigger = chunkier, fewer tiles.
   */
  TILE_SIZE: 4,
  /** Max grid dimension per axis; tiles grow beyond TILE_SIZE on screens that would exceed it. */
  MAX_SIM_DIMENSION: 2048,
  /** Header height in CSS pixels; the canvas fills the viewport below it. */
  HEADER_HEIGHT: 48,
  /** Canvas background; shows through transparent (air) pixels. */
  CANVAS_BACKGROUND: '#1a1a2e',

  SAND_TYPE: 1,
  DIRT_TYPE: 2,
  WOOD_TYPE: 3,
  SMOKE_TYPE: 4,
  WATER_TYPE: 5,
  STEAM_TYPE: 6,
  WET_SAND_TYPE: 7,
  MUD_TYPE: 8,
  EMBER_TYPE: 9,
  FLAME_TYPE: 10,
  SPARK_TYPE: 11,
  EXPLOSION_TYPE: 12,
  BOMB_TYPE: 13,

  /**
   * Initial wind strength on the X axis, -1 (left) to +1 (right), 0 = none.
   * Change it at runtime with GpuSimulation.setWind.
   */
  WIND: 0,

  /**
   * Base gravity: fall rate in tiles per simulation step, shared by all
   * falling elements. Supports fractions (0.5 = fall every other step);
   * 0 disables gravity. Elements derive their own rate from this base
   * (scale/offset live in each element's class, e.g. Sand.GRAVITY_SCALE).
   */
  GRAVITY: 1,

  /**
   * Stack fall: a falling tile (sand, dirt, water) looks down through the tiles
   * stacked under it, up to this many, to the open air at the bottom, and shifts
   * down with the whole stack. Without it a stack unzips one tile per step and
   * leaves a stride-sized gap between tiles. Costs this many reads per falling
   * tile per step; taller stacks still unzip in blocks of this size.
   */
  FALL_CHAIN: 16,

  /**
   * Chunk sleeping: the grid is split into 16x16-tile chunks and only chunks
   * near a recent change are simulated. A chunk stays awake for this many steps
   * after the last change in it or a neighboring chunk (a safety net for random
   * moves that have not fired yet). Must be at least 2.
   */
  CHUNK_KEEPALIVE_STEPS: 30,

  /** Air must be 0: GPU buffers zero-initialize, so empty = air. */
  AIR_TYPE: 0,
} as const;
