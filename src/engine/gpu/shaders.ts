/**
 * WGSL sources for the GPU backend.
 *
 * The grid is a storage buffer of packed tiles (one u32 each, flat index
 * `y * width + x`): type bits 0-7, value bits 8-15, variant bits 16-23, age
 * bits 24-31 (only types with an ageRate advance it; it picks the color row of
 * an aging type instead of the variant).
 */

import { MAX_REACTIONS } from '../element';
import { Flame } from '../../elements/flame';
import { Smoke } from '../../elements/smoke';
import { Spark } from '../../elements/spark';
import { Steam } from '../../elements/steam';
import { Water } from '../../elements/water';
import { SETTINGS } from '../../settings';

const wgslColor = (c: readonly number[]): string => `vec3f(${c.map((v) => v / 255).join(', ')})`;

/** Chunk edge in tiles; equals the 16x16 workgroup, so one workgroup simulates one chunk. */
export const CHUNK_SIZE = 16;

/** Byte size of one TypeInfo entry and one Reaction entry (must match UNIFORMS_WGSL). */
export const TYPE_INFO_BYTES = 48;
export const REACTION_BYTES = 32;

/** Phase codes in TypeInfo.phase (see ElementPhase). */
export const PHASE_CODES = { solid: 0, liquid: 1, gas: 2 } as const;

/** TypeInfo.flags bits: some reaction consumes this type; fire sticks to this type. */
export const FLAG_CONSUMED = 1;
export const FLAG_FLAMMABLE = 2;

/** TypeInfo.haze value for elements drawn as tiles. */
export const HAZE_NONE = 255;

/**
 * Uniform buffer layout shared by every module: a 48-byte header (time and
 * frameSteps are written each frame) followed by the per-type table and the
 * reaction rules, both built from the element registry. A type's reaction
 * rules are `reactions[start .. start + count)`, packed `start | count << 16`.
 */
export const UNIFORMS_WGSL = /* wgsl */ `
const MAX_REACTIONS : u32 = ${MAX_REACTIONS}u;
const PHASE_SOLID : u32 = ${PHASE_CODES.solid}u;
const PHASE_LIQUID : u32 = ${PHASE_CODES.liquid}u;
const PHASE_GAS : u32 = ${PHASE_CODES.gas}u;
const HAZE_NONE : u32 = ${HAZE_NONE}u;
const FLAG_CONSUMED : u32 = ${FLAG_CONSUMED}u;
const FLAG_FLAMMABLE : u32 = ${FLAG_FLAMMABLE}u;
const SPARK_STUCK : u32 = 0xFFu;

struct TypeInfo {
  gravity : u32,
  phase : u32,
  haze : u32,
  reactions : u32,
  slide : f32,
  density : f32,
  rise : f32,
  dissipation : f32,
  cohesion : f32,
  flags : u32,
  ageRate : f32,
  agedInto : u32,
}

struct Reaction {
  other : u32,
  result : u32,
  chance : f32,
  consumes : u32,
  radius : i32,
  _pad0 : u32,
  _pad1 : u32,
  _pad2 : u32,
}

struct Uniforms {
  width : u32,
  height : u32,
  tilePx : f32,
  wind : f32,
  gridOrigin : vec2f,
  time : f32,
  frameSteps : f32,
  background : vec4f,
  types : array<TypeInfo, 256>,
  reactions : array<Reaction, MAX_REACTIONS>,
}
`;

/**
 * Full-screen triangle that maps each device pixel to its grid cell and
 * colors it from the (type, variant) color table (the row is the age for aging types). Air shows the background;
 * elements with a haze channel are drawn from the haze buffer instead.
 */
export const RENDER_WGSL = /* wgsl */ `
${UNIFORMS_WGSL}

@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read> grid : array<u32>;
@group(0) @binding(2) var colorTex : texture_2d<f32>;
@group(0) @binding(3) var<storage, read> haze : array<vec4f>;

@vertex
fn vs(@builtin(vertex_index) i : u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

const SMOKE : u32 = ${SETTINGS.SMOKE_TYPE}u;
const STEAM : u32 = ${SETTINGS.STEAM_TYPE}u;
const STEAM_LEVELS : u32 = ${Steam.DENSITY_LEVELS}u;
const STEAM_FULL : f32 = ${Steam.HAZE_FULL};
const STEAM_OPACITY : f32 = ${Steam.HAZE_OPACITY};
const HAZE_LEVELS : u32 = ${Smoke.SMOKE_DENSITY_LEVELS}u;
const HAZE_FULL : f32 = ${Smoke.HAZE_FULL};
const HAZE_OPACITY : f32 = ${Smoke.HAZE_OPACITY};
const WATER_TOP : vec3f = ${wgslColor(Water.SHALLOW_COLOR)};
const WATER_BOTTOM : vec3f = ${wgslColor(Water.DEEP_COLOR)};
const WATER_OPACITY : f32 = ${Water.OPACITY};
const WATER_EDGE_LOW : f32 = ${Water.EDGE_LOW};
const WATER_EDGE_HIGH : f32 = ${Water.EDGE_HIGH};
const WISP_AMOUNT : f32 = ${Smoke.WISP_AMOUNT};
const WISP_SCALE : f32 = ${Smoke.WISP_SCALE}.0;
const WISP_RISE : f32 = ${Smoke.RISE_SPEED * SETTINGS.SIM_HZ};

fn hash2(c : vec2u) -> f32 {
  var h = (c.x * 0x27d4eb2du) ^ (c.y * 0x165667b1u);
  h = (h ^ (h >> 15u)) * 0x2c1b3c6du;
  h = h ^ (h >> 12u);
  return f32(h >> 8u) / 16777216.0;
}

fn valueNoise(p : vec2f) -> f32 {
  let c = vec2u(floor(p));
  let t = smoothstep(vec2f(0.0), vec2f(1.0), p - floor(p));
  let top = mix(hash2(c), hash2(c + vec2u(1u, 0u)), t.x);
  let bottom = mix(hash2(c + vec2u(0u, 1u)), hash2(c + vec2u(1u, 1u)), t.x);
  return mix(top, bottom, t.y);
}

// Three octaves of noise scrolling upward at the smoke's rise speed (0..1).
fn wisps(g : vec2f) -> f32 {
  let q = vec2f(g.x, g.y + u.time * WISP_RISE) / WISP_SCALE;
  return 0.55 * valueNoise(q) + 0.3 * valueNoise(q * 2.1 + 17.0) + 0.15 * valueNoise(q * 4.3 + 41.0);
}

fn hazeCell(x : i32, y : i32) -> vec4f {
  let cx = u32(clamp(x, 0, i32(u.width) - 1));
  let cy = u32(clamp(y, 0, i32(u.height) - 1));
  return haze[cy * u.width + cx];
}

// Bilinear haze between cell centers, so gas edges stay smooth across large tiles.
fn hazeSmooth(g : vec2f) -> vec4f {
  let p = g - 0.5;
  let c = vec2i(floor(p));
  let t = p - floor(p);
  let top = mix(hazeCell(c.x, c.y), hazeCell(c.x + 1, c.y), t.x);
  let bottom = mix(hazeCell(c.x, c.y + 1), hazeCell(c.x + 1, c.y + 1), t.x);
  return mix(top, bottom, t.y);
}

@fragment
fn fs(@builtin(position) pos : vec4f) -> @location(0) vec4f {
  let g = max((pos.xy - u.gridOrigin) / u.tilePx, vec2f(0.0));
  let gx = min(u32(g.x), u.width - 1u);
  let gy = min(u32(g.y), u.height - 1u);
  let i = gy * u.width + gx;
  let p = grid[i];
  let t = p & 0xFFu;
  var color = u.background;
  if (t != 0u && u.types[t].haze == HAZE_NONE) {
    let row = select((p >> 16u) & 0xFFu, p >> 24u, u.types[t].ageRate > 0.0);
    color = textureLoad(colorTex, vec2u(t, row), 0);
  }

  let water = haze[i].y;
  if (water > 0.0) {
    let body = mix(WATER_TOP, WATER_BOTTOM, clamp(g.y / f32(u.height), 0.0, 1.0));
    color = mix(color, vec4f(body, 1.0), WATER_OPACITY * smoothstep(WATER_EDGE_LOW, WATER_EDGE_HIGH, water));
  }
  let hz = hazeSmooth(g);
  if (hz.x > 0.0) {
    let wisp = 1.0 - WISP_AMOUNT + 2.0 * WISP_AMOUNT * wisps(g);
    let s = clamp(hz.x / HAZE_FULL * wisp, 0.0, 1.0);
    let shade = textureLoad(colorTex, vec2u(SMOKE, u32(round(s * f32(HAZE_LEVELS - 1u)))), 0);
    color = mix(color, shade, HAZE_OPACITY * s);
  }
  if (hz.z > 0.0) {
    let wisp = 1.0 - WISP_AMOUNT + 2.0 * WISP_AMOUNT * wisps(g + vec2f(37.0, 11.0));
    let s = clamp(hz.z / STEAM_FULL * wisp, 0.0, 1.0);
    let shade = textureLoad(colorTex, vec2u(STEAM, u32(round(s * f32(STEAM_LEVELS - 1u)))), 0);
    color = mix(color, shade, STEAM_OPACITY * s);
  }
  return color;
}
`;

/**
 * Haze pre-pass, run on frames that stepped the sim: occupancy of each haze channel
 * (per-type TypeInfo.haze: x smoke-style, y water body, z steam-style) blurred
 * with a separable tent kernel of HAZE_RADIUS cells per side (radius
 * 1 = 1 2 1 / 4). blurH reads the grid into hazeA, blurV reads hazeA into hazeB, which
 * the render shader samples with a single read per pixel. Cells outside the grid count
 * as empty. The result is blended into the previous haze with weight HAZE_TEMPORAL per
 * sim step (compounded over the frame's steps, so it is refresh-rate independent),
 * which smooths flicker and short-lived pockets.
 */
export const HAZE_WGSL = /* wgsl */ `
${UNIFORMS_WGSL}

const RADIUS : i32 = ${Smoke.HAZE_RADIUS};
const TEMPORAL : vec4f = vec4f(${Smoke.HAZE_TEMPORAL}, ${Water.HAZE_TEMPORAL}, ${Steam.HAZE_TEMPORAL}, 0.0);

@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read> grid : array<u32>;
@group(0) @binding(2) var<storage, read_write> hazeA : array<vec4f>;
@group(0) @binding(3) var<storage, read_write> hazeB : array<vec4f>;

fn tap(k : i32) -> f32 {
  return f32(RADIUS + 1 - abs(k)) / f32((RADIUS + 1) * (RADIUS + 1));
}

@compute @workgroup_size(16, 16)
fn blurH(@builtin(global_invocation_id) gid : vec3u) {
  if (gid.x >= u.width || gid.y >= u.height) {
    return;
  }
  var sum = vec4f(0.0);
  for (var k = -RADIUS; k <= RADIUS; k++) {
    let x = i32(gid.x) + k;
    if (x >= 0 && x < i32(u.width)) {
      let channel = u.types[grid[gid.y * u.width + u32(x)] & 0xFFu].haze;
      if (channel < 4u) {
        sum[channel] += tap(k);
      }
    }
  }
  hazeA[gid.y * u.width + gid.x] = sum;
}

@compute @workgroup_size(16, 16)
fn blurV(@builtin(global_invocation_id) gid : vec3u) {
  if (gid.x >= u.width || gid.y >= u.height) {
    return;
  }
  var sum = vec4f(0.0);
  for (var k = -RADIUS; k <= RADIUS; k++) {
    let y = i32(gid.y) + k;
    if (y >= 0 && y < i32(u.height)) {
      sum += tap(k) * hazeA[u32(y) * u.width + gid.x];
    }
  }
  let i = gid.y * u.width + gid.x;
  let keep = pow(max(1.0 - TEMPORAL, vec4f(1e-6)), vec4f(u.frameSteps));
  hazeB[i] = mix(sum, hazeB[i], keep);
}
`;

/**
 * Simulation step: one thread per grid cell of each awake chunk, reading the
 * pre-step read buffer and writing the write buffer. Movers claim their
 * destination with an atomic (first claim wins, loser stays), which keeps
 * every write conflict-free and tiles conserved. A behavior returns stay(v)
 * or moveTo(x, y, v) for a destination it has already claimed. Solids with
 * a non-zero gravity quantum fall (updateFall, parameterized by the per-type
 * table), liquids run in mainLiquid and gases in mainGas; custom behaviors
 * are added by new-element.bat at the `new-element:` markers (types,
 * behaviors, cases); all other types stay put.
 *
 * Chunk sleeping: every entry point is dispatched indirectly over the awake
 * chunk list (one workgroup per 16x16 chunk). clearChunk empties the awake
 * chunks' write and claim cells first; sleeping chunks are not touched, and
 * their two grid buffers already match because a chunk only falls asleep
 * after a step in which none of its tiles changed. Every write that changes a
 * cell marks its chunk (commit), and CHUNKS_WGSL keeps a marked chunk and its
 * neighbors awake. A fluid in a sleeping chunk cannot get out of the way, so
 * it cannot be displaced or stack-followed into; trying wakes its chunk.
 *
 * The step counter is a dynamic-offset uniform (one 256-byte slot per step
 * in the frame), because all steps of a frame share one command buffer and
 * a plain uniform write would only be visible as its final value.
 */
export const COMPUTE_WGSL = /* wgsl */ `
${UNIFORMS_WGSL}

const AIR : u32 = ${SETTINGS.AIR_TYPE}u;
const CHUNK : u32 = ${CHUNK_SIZE}u;
const FALL_CHAIN : i32 = ${SETTINGS.FALL_CHAIN};
const CLING_SCAN : i32 = 16;
const WATER : u32 = ${SETTINGS.WATER_TYPE}u;
const WATER_FALL : i32 = ${Water.FALL_SPEED};
const WATER_SPREAD : f32 = ${Water.SPREAD_SPEED};
const WATER_RANGE : i32 = ${Water.SPREAD_RANGE};
const WATER_DEPTH_LIMIT : i32 = ${Water.DEPTH_LIMIT};
const WATER_WANDER : f32 = ${Water.WANDER_CHANCE};
const WATER_FLOW_SCALE : u32 = ${Water.FLOW_SCALE}u;
const WATER_FLOW_PERIOD : u32 = ${Water.FLOW_PERIOD}u;
const WATER_POCKET : u32 = ${Water.POCKET_NEIGHBORS}u;
const SMOKE_POCKET : u32 = ${Smoke.POCKET_NEIGHBORS}u;
const SMOKE_CURL_EPS : i32 = ${Math.max(1, Math.floor(Smoke.TURBULENCE_SCALE / 2))};
const SMOKE_RISE_VARIATION : f32 = ${Smoke.RISE_VARIATION};
const SMOKE_WIND_SPEED : f32 = ${Smoke.WIND_SPEED};
const SMOKE_TURB_SPEED : f32 = ${Smoke.TURBULENCE_SPEED};
const SMOKE_TURB_SCALE : f32 = ${Smoke.TURBULENCE_SCALE}.0;
const SMOKE_TURB_PERIOD : u32 = ${Smoke.TURBULENCE_PERIOD}u;
const STEAM : u32 = ${SETTINGS.STEAM_TYPE}u;
const STEAM_COMPACT : u32 = ${Steam.CONDENSE_NEIGHBORS}u;
const STEAM_CONDENSE_STEPS : u32 = ${Steam.CONDENSE_STEPS}u;
const STEAM_CONDENSE_CHANCE : f32 = ${Steam.CONDENSE_CHANCE};
const WATER_RETURN_TRIES : u32 = 24u;
const WATER_RETURN_REACH : i32 = 128;
const STEAM_COOL : u32 = ${Steam.COOL_RATE}u;
const FLAME : u32 = ${SETTINGS.FLAME_TYPE}u;
const SPARK : u32 = ${SETTINGS.SPARK_TYPE}u;
const FLAME_FLICKER : f32 = ${Flame.FLICKER};
const FLAME_WIND_FLICKER : f32 = ${Flame.WIND_FLICKER};
const SPARK_GRAVITY : f32 = ${Spark.GRAVITY};
const SPARK_DRAG : f32 = ${Spark.DRAG};
// new-element:types

struct StepUniform {
  step : u32,
}

@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read> readBuf : array<u32>;
@group(0) @binding(2) var<storage, read_write> writeBuf : array<u32>;
@group(0) @binding(3) var<storage, read_write> claimBuf : array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> solidBuf : array<u32>;
@group(0) @binding(5) var<uniform> stepU : StepUniform;
@group(0) @binding(6) var<storage, read> awake : array<u32>;
@group(0) @binding(7) var<storage, read_write> marks : array<atomic<u32>>;
@group(0) @binding(8) var<storage, read> activeChunks : array<u32>;

fn pack(t : u32, value : u32, variant : u32, age : u32) -> u32 {
  return t | (value << 8u) | (variant << 16u) | (age << 24u);
}

fn inBounds(x : i32, y : i32) -> bool {
  return x >= 0 && y >= 0 && x < i32(u.width) && y < i32(u.height);
}

fn chunkOf(x : u32, y : u32) -> u32 {
  return (y / CHUNK) * ((u.width + CHUNK - 1u) / CHUNK) + x / CHUNK;
}

// Grid cell of this thread: the workgroup picks an awake chunk from the list.
fn cellOf(wid : vec3u, lid : vec3u) -> vec2u {
  let c = activeChunks[wid.x];
  let chunksWide = (u.width + CHUNK - 1u) / CHUNK;
  return vec2u((c % chunksWide) * CHUNK + lid.x, (c / chunksWide) * CHUNK + lid.y);
}

fn chunkAwake(x : i32, y : i32) -> bool {
  return awake[chunkOf(u32(x), u32(y))] > 0u;
}

// Keep the chunk holding (x, y) and its neighbors awake next step.
fn mark(x : i32, y : i32) {
  let c = chunkOf(u32(x), u32(y));
  if (atomicLoad(&marks[c]) == 0u) {
    atomicStore(&marks[c], 1u);
  }
}

fn markCell(i : u32) {
  mark(i32(i % u.width), i32(i / u.width));
}

// Write a tile's result (packed, from cell origin whose pre-step content was
// before) and mark every chunk the write changed.
fn commit(origin : u32, dest : u32, packed : u32, before : u32) {
  writeBuf[dest] = packed;
  if (dest != origin) {
    markCell(origin);
    markCell(dest);
  } else if (packed != before) {
    markCell(dest);
  }
}

fn passable(x : i32, y : i32) -> bool {
  if (!inBounds(x, y)) {
    return false;
  }
  let i = u32(y) * u.width + u32(x);
  return (readBuf[i] & 0xFFu) == AIR && solidBuf[i] == 0u;
}

// Cell (x, y) can be entered by a tile of type t: air, or a liquid or gas tile
// lighter than t, which is displaced and resolved by its own later dispatch (or
// by the claim race within the same one). A fluid in a sleeping chunk would not
// run to get out of the way, so it blocks and wakes its chunk instead.
fn enterable(t : u32, x : i32, y : i32) -> bool {
  if (!inBounds(x, y)) {
    return false;
  }
  let i = u32(y) * u.width + u32(x);
  if (solidBuf[i] != 0u) {
    return false;
  }
  let other = readBuf[i] & 0xFFu;
  if (other == AIR) {
    return true;
  }
  let info = u.types[other];
  if (info.phase == PHASE_SOLID || info.density >= u.types[t].density) {
    return false;
  }
  if (!chunkAwake(x, y)) {
    mark(x, y);
    return false;
  }
  return true;
}

// Atomically take cell (x, y) for this step. Retries the weak compare-exchange's
// spurious failures, so false means another thread really holds the cell.
fn claim(x : i32, y : i32) -> bool {
  let i = u32(y) * u.width + u32(x);
  for (var k = 0; k < 4; k++) {
    let r = atomicCompareExchangeWeak(&claimBuf[i], 0u, 1u);
    if (r.exchanged) {
      return true;
    }
    if (r.old_value != 0u) {
      return false;
    }
  }
  return false;
}

// A tile that falls (a powder or a liquid) in an awake chunk, so it may be part
// of a falling stack. Tiles in sleeping chunks do not move, so they never are.
fn fallsAlong(x : i32, y : i32) -> bool {
  if (!inBounds(x, y)) {
    return false;
  }
  let t = readBuf[u32(y) * u.width + u32(x)] & 0xFFu;
  return t != AIR && (gravityOf(t) > 0u || u.types[t].phase == PHASE_LIQUID) && chunkAwake(x, y);
}

fn cohesiveAt(x : i32, y : i32) -> bool {
  if (!inBounds(x, y)) {
    return false;
  }
  let n = readBuf[u32(y) * u.width + u32(x)] & 0xFFu;
  return n != AIR && u.types[n].cohesion > 0.0;
}

// Whether the column under (x, y) is filled for CLING_SCAN cells, so a tile there
// rests instead of falling with a stack (a gap would let it fall).
fn restsOnColumn(x : i32, y : i32, t : u32) -> bool {
  for (var k = 1; k <= CLING_SCAN; k++) {
    if (enterable(t, x, y + k)) {
      return false;
    }
    if (!fallsAlong(x, y + k)) {
      return true;
    }
  }
  return true;
}

// A resting cohesive tile beside (x, y), which can hold up a cohesive tile there.
fn anchoredBeside(x : i32, y : i32) -> bool {
  for (var dx = -1; dx <= 1; dx += 2) {
    if (cohesiveAt(x + dx, y)) {
      let n = readBuf[u32(y) * u.width + u32(x + dx)] & 0xFFu;
      if (restsOnColumn(x + dx, y, n)) {
        return true;
      }
    }
  }
  return false;
}

// Whether the cohesive tile at (x, y) clings to an anchored cohesive neighbor this
// step instead of falling into the open cell below it. Deterministic per step, so
// the tiles stacked above agree with it (fallChain) and rest on it.
fn clings(x : i32, y : i32, t : u32) -> bool {
  let c = u.types[t].cohesion;
  return c > 0.0 && enterable(t, x, y + 1)
    && rand(u32(x), u32(y), stepU.step ^ 0x3C6EF372u) < c && anchoredBeside(x, y);
}

// A cohesive tile at (x, y) touches another cohesive tile (beside or below),
// so it resists rolling off its slope.
fn cohesiveContact(x : i32, y : i32) -> bool {
  return cohesiveAt(x - 1, y) || cohesiveAt(x + 1, y) || cohesiveAt(x, y + 1);
}

// Falling tiles stacked directly under (x, y), counted up to FALL_CHAIN; tiles a
// tile of type t can simply pass through (see enterable) are not part of the stack,
// and a tile that clings in place ends it like the ground would.
fn fallChain(x : i32, y : i32, t : u32) -> i32 {
  var n = 0;
  while (n < FALL_CHAIN && fallsAlong(x, y + n + 1) && !enterable(t, x, y + n + 1)
    && !clings(x, y + n + 1, readBuf[u32(y + n + 1) * u.width + u32(x)] & 0xFFu)) {
    n++;
  }
  return n;
}

// Whether the stack under (x, y) runs on past the FALL_CHAIN look-through onto an
// open cell: the tile is then held up by a stack that is still falling, not resting
// on anything. Scans the whole stack, so only call it for a tile about to spread.
fn onFallingStack(t : u32, x : i32, y : i32) -> bool {
  for (var cy = y + FALL_CHAIN + 1; cy < i32(u.height); cy++) {
    if (enterable(t, x, cy)) {
      return true;
    }
    if (!fallsAlong(x, cy)) {
      return false;
    }
  }
  return false;
}

// A falling tile that lost its own cell to a stack follower above it moves up into
// the nearest cell of the stack that the stack vacated, so no tile is lost.
fn fleeUp(x : i32, y : i32, newValue : u32) -> Move {
  for (var k = 1; k <= FALL_CHAIN; k++) {
    if (!fallsAlong(x, y - k)) {
      break;
    }
    if (claim(x, y - k)) {
      return moveTo(x, y - k, newValue);
    }
  }
  return tileGone();
}

fn rand(x : u32, y : u32, step : u32) -> f32 {
  var h = (x * 0x27d4eb2du) ^ (y * 0x165667b1u) ^ (step * 0x9e3779b9u);
  h = (h ^ (h >> 15u)) * 0x2c1b3c6du;
  h = (h ^ (h >> 12u)) * 0x297a2d39u;
  h = h ^ (h >> 15u);
  return f32(h >> 8u) / 16777216.0;
}

struct Move {
  moved : bool,
  dest : vec2i,
  newValue : u32,
}

fn stay(newValue : u32) -> Move {
  return Move(false, vec2i(0, 0), newValue);
}

fn moveTo(x : i32, y : i32, newValue : u32) -> Move {
  return Move(true, vec2i(x, y), newValue);
}

fn gravityOf(t : u32) -> u32 {
  return u.types[t].gravity;
}

fn slideChanceOf(t : u32) -> f32 {
  return u.types[t].slide;
}

const NO_OFFER : u32 = 0xFFFFFFFFu;

// A consuming reaction offered between two neighbors: the global rule index
// (NO_OFFER if none) and the other tile's cell.
struct Offer {
  rule : u32,
  cell : vec2i,
}

fn noOffer() -> Offer {
  return Offer(NO_OFFER, vec2i(0, 0));
}

// The consuming reaction the tile at (x, y) offers this step: the first of its
// consuming rules that rolls its chance while touching the rule's other type,
// offered to one of those neighbors picked at random. Deterministic per step, so
// the neighbor can recompute it (takenOffer). Both tiles must be in awake chunks.
fn offerOf(x : i32, y : i32) -> Offer {
  if (!chunkAwake(x, y)) {
    return noOffer();
  }
  let t = readBuf[u32(y) * u.width + u32(x)] & 0xFFu;
  let rules = u.types[t].reactions;
  let start = rules & 0xFFFFu;
  let count = rules >> 16u;
  for (var k = 0u; k < count; k++) {
    let rule = u.reactions[start + k];
    if (rule.consumes == 0u) {
      continue;
    }
    let touching = typeAround(x, y, rule.other);
    if (touching == 0u || rand(u32(x), u32(y), stepU.step ^ (0x632BE5ABu + k)) >= rule.chance) {
      continue;
    }
    var pick = min(u32(rand(u32(x), u32(y), stepU.step ^ 0x1B873593u) * f32(touching)), touching - 1u);
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if ((dx != 0 || dy != 0) && typeAt(x + dx, y + dy, rule.other) == 1u) {
          if (pick == 0u) {
            if (!chunkAwake(x + dx, y + dy)) {
              return noOffer();
            }
            return Offer(start + k, vec2i(x + dx, y + dy));
          }
          pick--;
        }
      }
    }
  }
  return noOffer();
}

// The offer the tile at (x, y) (type t) takes this step: the first neighbor, in
// scan order, whose offer targets it. Only a type some rule consumes can take one.
fn takenOffer(x : i32, y : i32, t : u32) -> Offer {
  if ((u.types[t].flags & FLAG_CONSUMED) == 0u) {
    return noOffer();
  }
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let n = vec2i(x + dx, y + dy);
      if ((dx == 0 && dy == 0) || !inBounds(n.x, n.y)) {
        continue;
      }
      let nt = readBuf[u32(n.y) * u.width + u32(n.x)] & 0xFFu;
      if ((u.types[nt].reactions >> 16u) == 0u) {
        continue;
      }
      let offer = offerOf(n.x, n.y);
      if (offer.rule != NO_OFFER && all(offer.cell == vec2i(x, y))) {
        return Offer(offer.rule, n);
      }
    }
  }
  return noOffer();
}

// Consuming reactions change both tiles in the same step: the tile whose offer is
// taken turns into the rule's result, and the tile that takes it turns into air,
// so every conversion uses up exactly one tile. Returns t if neither happens.
fn reactConsuming(x : i32, y : i32, t : u32) -> u32 {
  if (takenOffer(x, y, t).rule != NO_OFFER) {
    return AIR;
  }
  let offer = offerOf(x, y);
  if (offer.rule == NO_OFFER) {
    return t;
  }
  let other = readBuf[u32(offer.cell.y) * u.width + u32(offer.cell.x)] & 0xFFu;
  let taken = takenOffer(offer.cell.x, offer.cell.y, other);
  if (taken.rule != NO_OFFER && all(taken.cell == vec2i(x, y))) {
    return u.reactions[offer.rule].result;
  }
  return t;
}

// Reactions: the type tile t at (x, y) turns into, or t if no rule fired. A
// one-sided rule fires with its chance per step while any tile within its radius
// (1 = the 8 neighbors) is its other type; a consuming rule fires together with the tile it uses up (see
// reactConsuming). A touching rule that did not fire keeps the chunk awake.
// AIR means the tile was consumed and vanishes.
fn react(x : i32, y : i32, t : u32) -> u32 {
  let consumed = reactConsuming(x, y, t);
  if (consumed != t) {
    return consumed;
  }
  let rules = u.types[t].reactions;
  let start = rules & 0xFFFFu;
  let count = rules >> 16u;
  for (var k = 0u; k < count; k++) {
    let rule = u.reactions[start + k];
    if (typeWithin(x, y, rule.other, rule.radius)) {
      if (rule.consumes == 0u && rand(u32(x), u32(y), stepU.step ^ (0x632BE5ABu + k)) < rule.chance) {
        return rule.result;
      }
      mark(x, y);
    }
  }
  return t;
}

// Aging: the (type, age) a tile of type t has after this step. It gains the whole
// part of its ageRate plus the fraction by chance; past 255 it becomes agedInto
// (AIR = it vanishes) with a fresh age. A type with an ageRate has a random change
// pending every step, so it keeps its chunk awake.
fn ageTile(x : i32, y : i32, t : u32, age : u32) -> vec2u {
  let rate = u.types[t].ageRate;
  if (rate <= 0.0) {
    return vec2u(t, age);
  }
  mark(x, y);
  let whole = floor(rate);
  let gain = u32(whole) + select(0u, 1u, rand(u32(x), u32(y), stepU.step ^ 0xA136AAADu) < rate - whole);
  if (age + gain > 255u) {
    return vec2u(u.types[t].agedInto, 0u);
  }
  return vec2u(t, age + gain);
}

const MAX_FALL_ATTEMPTS = 8;

// Falling element: spends the tile's whole fall budget this step. Each attempt
// strides straight down through enterable cells (air, lighter fluids; up to the
// budget left) or, when blocked,
// takes a slope-aware friction-gated diagonal slide that costs one cell. A
// tile with both diagonals open always rolls, with exactly one open it rolls
// with the type's slideChance, with none it rests (slideChance 1 = no friction).
//
// Every cell on the path was enterable in the pre-step state, so only the final cell
// is claimed. If that claim is lost the tile falls back to shallower cells of
// its last stride, the other diagonal of its last slide, then earlier path
// waypoints, and finally stays put. Being blocked sheds the leftover fall
// fraction; otherwise it carries over.
//
// Cohesive types (wet sand, mud) can also hold still before moving: one about to
// fall clings to an anchored cohesive neighbor (clings), and one about to roll
// stays with its cohesion chance while it touches another cohesive tile.
fn updateFall(x : i32, y : i32, t : u32, value : u32) -> Move {
  let acc = value + gravityOf(t);
  var left = i32(acc >> 8u);
  var remainder = acc & 0xFFu;
  if (left == 0) {
    return stay(remainder);
  }
  if (clings(x, y, t)) {
    // The cling is rolled every step and may let go later.
    mark(x, y);
    return stay(0u);
  }

  var path : array<vec2i, MAX_FALL_ATTEMPTS>;
  var count = 0;
  var px = x;
  var py = y;
  var lastDepth = 0;
  var hasAlt = false;
  var alt = vec2i(0, 0);

  for (var attempt = 0; attempt < MAX_FALL_ATTEMPTS && left > 0; attempt++) {
    var depth = 0;
    var below = 0;
    if (attempt == 0) {
      below = fallChain(px, py, t);
    }
    while (depth < left && enterable(t, px, py + below + depth + 1)) {
      depth++;
    }
    if (depth > 0) {
      py += depth;
      left -= depth;
      lastDepth = depth;
      hasAlt = false;
      path[count] = vec2i(px, py);
      count++;
      continue;
    }

    let leftOpen = enterable(t, px - 1, py + 1);
    let rightOpen = enterable(t, px + 1, py + 1);
    if (!leftOpen && !rightOpen) {
      remainder = 0u;
      break;
    }
    if (attempt == 0 && u.types[t].cohesion > 0.0 && cohesiveContact(px, py)
      && rand(u32(px), u32(py), stepU.step ^ 0x5BD1E995u) < u.types[t].cohesion) {
      mark(x, y);
      remainder = 0u;
      break;
    }
    if (leftOpen != rightOpen && rand(u32(px), u32(py), stepU.step ^ 0xA5A5A5A5u) >= slideChanceOf(t)) {
      // It may still roll on a later step, so its chunk must not fall asleep.
      mark(x, y);
      remainder = 0u;
      break;
    }

    var side = 1;
    if (rand(u32(px), u32(py), stepU.step) < 0.5) {
      side = -1;
    }
    if (!enterable(t, px + side, py + 1)) {
      side = -side;
    }
    hasAlt = leftOpen && rightOpen;
    alt = vec2i(px - side, py + 1);
    px += side;
    py += 1;
    left -= 1;
    lastDepth = 0;
    path[count] = vec2i(px, py);
    count++;
  }

  if (count == 0) {
    return stay(0u);
  }

  let last = path[count - 1];
  if (lastDepth > 0) {
    for (var d = lastDepth; d > 0; d--) {
      let cell = vec2i(last.x, last.y - (lastDepth - d));
      if (claim(cell.x, cell.y)) {
        return moveTo(cell.x, cell.y, remainder);
      }
    }
  } else {
    if (claim(last.x, last.y)) {
      return moveTo(last.x, last.y, remainder);
    }
    if (hasAlt && claim(alt.x, alt.y)) {
      return moveTo(alt.x, alt.y, remainder);
    }
  }
  for (var k = count - 2; k >= 0; k--) {
    if (claim(path[k].x, path[k].y)) {
      return moveTo(path[k].x, path[k].y, remainder);
    }
  }
  return stay(0u);
}

// One time slice of smooth value noise (0..1) at tile (x, y).
fn smokeNoiseSlice(x : i32, y : i32, slice : u32) -> f32 {
  let f = vec2f(f32(x), f32(y)) / SMOKE_TURB_SCALE;
  let c = vec2u(floor(f));
  let t = smoothstep(vec2f(0.0), vec2f(1.0), f - floor(f));
  let top = mix(rand(c.x, c.y, slice), rand(c.x + 1u, c.y, slice), t.x);
  let bottom = mix(rand(c.x, c.y + 1u, slice), rand(c.x + 1u, c.y + 1u, slice), t.x);
  return mix(top, bottom, t.y);
}

// Scalar potential in 0..1, shared by every tile and blended between two time slices.
fn smokePotential(x : i32, y : i32) -> f32 {
  let period = stepU.step / SMOKE_TURB_PERIOD;
  let f = f32(stepU.step % SMOKE_TURB_PERIOD) / f32(SMOKE_TURB_PERIOD);
  let a = smokeNoiseSlice(max(x, 0), max(y, 0), period);
  let b = smokeNoiseSlice(max(x, 0), max(y, 0), period + 1u);
  return mix(a, b, smoothstep(0.0, 1.0, f));
}

// Turbulent flow in about -1..1: the curl of the potential, which is
// divergence-free (swirls instead of compressing or thinning the smoke).
fn smokeCurl(x : i32, y : i32) -> vec2f {
  let e = SMOKE_CURL_EPS;
  let dx = smokePotential(x + e, y) - smokePotential(x - e, y);
  let dy = smokePotential(x, y + e) - smokePotential(x, y - e);
  return clamp(vec2f(dy, -dx) * 2.0, vec2f(-1.0), vec2f(1.0));
}

// Low-discrepancy sequence in 0..1: the same value for every tile in a step, so
// "move this step" fires on the same steps across a whole patch, and a tile with
// speed v moves on a fraction v of steps without holding any per-tile state.
fn stepPhase(multiplier : u32) -> f32 {
  return f32((stepU.step * multiplier) >> 8u) / 16777216.0;
}

// A tile that cannot keep any cell; the gas and liquid dispatches drop it (dest.x < 0).
fn tileGone() -> Move {
  return Move(true, vec2i(-1, -1), 0u);
}

fn typeAt(x : i32, y : i32, t : u32) -> u32 {
  if (x < 0 || y < 0 || x >= i32(u.width) || y >= i32(u.height)) {
    return 0u;
  }
  return select(0u, 1u, (readBuf[u32(y) * u.width + u32(x)] & 0xFFu) == t);
}

// Tiles of type t among the 8 neighbors of (x, y).
fn typeAround(x : i32, y : i32, t : u32) -> u32 {
  var count = 0u;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx != 0 || dy != 0) {
        count += typeAt(x + dx, y + dy, t);
      }
    }
  }
  return count;
}

// Whether any tile within Chebyshev distance r of (x, y) is of type t.
fn typeWithin(x : i32, y : i32, t : u32, r : i32) -> bool {
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      if ((dx != 0 || dy != 0) && typeAt(x + dx, y + dy, t) == 1u) {
        return true;
      }
    }
  }
  return false;
}

fn flammableAt(x : i32, y : i32) -> bool {
  if (!inBounds(x, y)) {
    return false;
  }
  return (u.types[readBuf[u32(y) * u.width + u32(x)] & 0xFFu].flags & FLAG_FLAMMABLE) != 0u;
}

fn flammableAround(x : i32, y : i32) -> bool {
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if ((dx != 0 || dy != 0) && flammableAt(x + dx, y + dy)) {
        return true;
      }
    }
  }
  return false;
}

// Pocket closing: the neighboring empty cell enclosed by the most tiles of
// type t (at least minCount), if moving there leaves this tile better enclosed
// than it is now. Returns the offset to it, or (0, 0) if there is none.
fn pocketMove(x : i32, y : i32, t : u32, minCount : u32) -> vec2i {
  let own = typeAround(x, y, t);
  var best = vec2i(0, 0);
  var bestCount = max(minCount, own + 2u) - 1u;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if ((dx != 0 || dy != 0) && passable(x + dx, y + dy)) {
        let n = typeAround(x + dx, y + dy, t);
        if (n > bestCount) {
          bestCount = n;
          best = vec2i(dx, dy);
        }
      }
    }
  }
  return best;
}

// Gas (smoke or steam; value rides along with the tile): advected by a flow shared by all tiles (wind plus divergence-free
// curl noise) and buoyancy, so neighbors move together instead of taking
// their own routes. Speeds are per-step move chances resolved with a shared
// step phase. Pockets are closed first; otherwise candidate moves are tried
// in order and the first free, won claim is taken, and when blocked above the
// tile slides along the flow direction. Smoke only ever writes a cell it
// claimed, so a falling tile that already claimed this tile's cell displaces
// it: the tile then flees to a free neighbor, or vanishes if there is none.
fn updateGas(x : i32, y : i32, t : u32, value : u32, rise : f32) -> Move {
  let pocket = pocketMove(x, y, t, SMOKE_POCKET);
  if ((pocket.x != 0 || pocket.y != 0) && claim(x + pocket.x, y + pocket.y)) {
    return moveTo(x + pocket.x, y + pocket.y, value);
  }

  let curl = smokeCurl(x, y);
  let vx = u.wind * SMOKE_WIND_SPEED + curl.x * SMOKE_TURB_SPEED;
  let vy = rise * (1.0 + SMOKE_RISE_VARIATION * curl.y);
  let dx = select(0, select(-1, 1, vx > 0.0), stepPhase(2654435769u) < abs(vx));
  let dy = select(0, -1, stepPhase(1779033703u) < vy);
  let flow = select(-1, 1, vx >= 0.0);

  var cand = array<vec2i, 7>(
    vec2i(dx, dy), vec2i(0, dy), vec2i(dx, 0),
    vec2i(flow, dy), vec2i(-flow, dy),
    vec2i(flow, 0), vec2i(-flow, 0),
  );
  let tries = select(3, 7, dy != 0);
  for (var k = 0; k < tries; k++) {
    let c = cand[k];
    if ((c.x != 0 || c.y != 0) && passable(x + c.x, y + c.y) && claim(x + c.x, y + c.y)) {
      return moveTo(x + c.x, y + c.y, value);
    }
  }
  if (claim(x, y)) {
    return stay(value);
  }
  return tileGone();
}

// Flame: rises with its type's riseSpeed and flickers sideways with FLICKER, both
// rolled per tile (unlike updateGas's shared phase) so neighbors move independently.
// Wind biases the sideways direction and makes flickers more likely. A flame under
// a flammable tile holds still there instead of sliding off, so it stays lit long
// enough to catch it. It tries (dx, dy), (0, dy), (dx, 0) like updateGas's first
// candidates, then keeps its cell, and vanishes if a falling tile took that.
fn updateFlame(x : i32, y : i32, t : u32) -> Move {
  let rise = rand(u32(x), u32(y), stepU.step ^ 0x68E31DA4u) < u.types[t].rise;
  let flicker = rand(u32(x), u32(y), stepU.step ^ 0xB5297A4Du) < FLAME_FLICKER + FLAME_WIND_FLICKER * abs(u.wind);
  let right = rand(u32(x), u32(y), stepU.step ^ 0x1B56C4E9u) < 0.5 + 0.5 * u.wind;
  let held = flammableAt(x, y - 1);
  let dx = select(0, select(-1, 1, right), flicker && !held);
  let dy = select(0, -1, rise && !held);
  var cand = array<vec2i, 3>(vec2i(dx, dy), vec2i(0, dy), vec2i(dx, 0));
  for (var k = 0; k < 3; k++) {
    let c = cand[k];
    if ((c.x != 0 || c.y != 0) && passable(x + c.x, y + c.y) && claim(x + c.x, y + c.y)) {
      return moveTo(x + c.x, y + c.y, 0u);
    }
  }
  if (claim(x, y)) {
    return stay(0u);
  }
  return tileGone();
}

// A spark's step: its move, and whether it landed (was blocked, so it turns into a flame).
struct SparkResult {
  step : Move,
  landed : bool,
}

// Spark: a ballistic tile. Its velocity (cells per step) lives in the value byte,
// vx in bits 0-3 and vy in bits 4-7, each stored +8 so 0 means "not launched yet":
// a fresh spark picks a random upward-cone velocity. Each step gravity pulls vy
// down and drag decays vx; it then traces the cells toward (x + vx, y + vy) through
// enterable cells (it passes through lighter gas) and claims the furthest one it
// can, falling back to earlier path cells. If the path was blocked it lands, which
// turns it into a flame in the cell it reached, unless the blocker is flammable: then
// it sticks (value SPARK_STUCK, a vx no launch can produce) and stays put, so it keeps
// trying to light the tile until it fades or the flammable tile around it is gone.
fn updateSpark(x : i32, y : i32, t : u32, stored : u32) -> SparkResult {
  var value = stored;
  if ((value & 15u) == 15u) {
    if (flammableAround(x, y)) {
      if (claim(x, y)) {
        return SparkResult(stay(SPARK_STUCK), false);
      }
      return SparkResult(tileGone(), false);
    }
    value = 0x88u;
  }
  var vx = i32(value & 15u) - 8;
  var vy = i32((value >> 4u) & 15u) - 8;
  if (value == 0u) {
    vx = min(i32(rand(u32(x), u32(y), stepU.step ^ 0x2F6A5D13u) * 7.0), 6) - 3;
    vy = min(i32(rand(u32(x), u32(y), stepU.step ^ 0x7ED55D16u) * 4.0), 3) - 5;
  } else {
    if (rand(u32(x), u32(y), stepU.step ^ 0xC761C23Cu) < SPARK_GRAVITY) {
      vy = min(vy + 1, 7);
    }
    if (rand(u32(x), u32(y), stepU.step ^ 0x165667B1u) < SPARK_DRAG) {
      vx -= sign(vx);
    }
  }
  let packed = u32(vx + 8) | (u32(vy + 8) << 4u);

  let n = max(abs(vx), abs(vy));
  var path : array<vec2i, 7>;
  var reach = 0;
  var blocked = false;
  var sticks = false;
  for (var k = 1; k <= n; k++) {
    let f = f32(k) / f32(n);
    let c = vec2i(x + i32(round(f32(vx) * f)), y + i32(round(f32(vy) * f)));
    if (!enterable(t, c.x, c.y)) {
      blocked = true;
      sticks = flammableAt(c.x, c.y);
      break;
    }
    path[k - 1] = c;
    reach = k;
  }
  for (var k = reach; k > 0; k--) {
    if (claim(path[k - 1].x, path[k - 1].y)) {
      let end = blocked && k == reach;
      return SparkResult(moveTo(path[k - 1].x, path[k - 1].y, select(packed, SPARK_STUCK, end && sticks)), end && !sticks);
    }
  }
  if (claim(x, y)) {
    let end = blocked && reach == 0;
    return SparkResult(stay(select(packed, SPARK_STUCK, end && sticks)), end && !sticks);
  }
  return SparkResult(tileGone(), false);
}

// Sideways spread direction, shared by a patch of WATER_FLOW_SCALE tiles per row
// band and re-rolled every WATER_FLOW_PERIOD steps.
fn waterFlow(x : i32, y : i32) -> i32 {
  let period = stepU.step / WATER_FLOW_PERIOD;
  return select(-1, 1, rand(u32(x) / WATER_FLOW_SCALE, u32(y) / 3u, period ^ 0x2545F491u) < 0.5);
}

// Open cells below (x, y), counted up to WATER_DEPTH_LIMIT: how far the water
// surface in this column sits below row y.
fn waterColumnDepth(t : u32, x : i32, y : i32) -> i32 {
  var depth = 0;
  while (depth < WATER_DEPTH_LIMIT && enterable(t, x, y + depth + 1)) {
    depth++;
  }
  return depth;
}

// Sideways slide for a resting tile, as a signed offset (0 = none): along its
// row, through up to WATER_RANGE open cells each way, to the column whose
// surface is lowest (nearest on ties), so a mound flows straight downhill.
// When both sides are equally good it takes the one with more open room, so a
// tile at the edge of a void keeps heading into it instead of flipping back
// with the random flow direction. With no lower surface in reach it
// occasionally hops the full reach along the shared flow direction, which
// carries levelling across wide pools; but when the open stretch ends within
// reach on both sides, the whole stretch is on the same level, so the surface is
// level and the tile rests (otherwise an incomplete top row shuffles forever).
// A tile that may still hop later keeps its chunk awake.
fn waterSlide(t : u32, x : i32, y : i32, dir : i32) -> i32 {
  var reach = array<i32, 2>(0, 0);
  var bestDepth = array<i32, 2>(0, 0);
  var bestOffset = array<i32, 2>(0, 0);
  for (var k = 0; k < 2; k++) {
    let s = select(dir, -dir, k == 1);
    for (var d = 1; d <= WATER_RANGE; d++) {
      if (!enterable(t, x + s * d, y)) {
        break;
      }
      reach[k] = d;
      let depth = waterColumnDepth(t, x + s * d, y);
      if (depth > bestDepth[k]) {
        bestDepth[k] = depth;
        bestOffset[k] = s * d;
      }
    }
  }
  let second = bestDepth[1] > bestDepth[0] || (bestDepth[1] == bestDepth[0] && reach[1] > reach[0]);
  let best = select(bestOffset[0], bestOffset[1], second);
  let level = reach[0] < WATER_RANGE && reach[1] < WATER_RANGE;
  if (best != 0 || level) {
    return best;
  }
  if (stepPhase(2246822519u) >= WATER_WANDER) {
    mark(x, y);
    return 0;
  }
  return select(-dir * reach[1], dir * reach[0], reach[0] > 0);
}

// Top of the water in column x above row y: the first free cell going up, if it sits
// directly on water (the pool surface). -1 when the column instead tops out in some
// other tile (a pile that sticks out of the water) or in a solid.
fn waterSurfaceAbove(t : u32, x : i32, y : i32) -> i32 {
  for (var cy = y - 1; cy >= 0; cy--) {
    if (solidBuf[u32(cy) * u.width + u32(x)] != 0u) {
      return -1;
    }
    if (enterable(t, x, cy)) {
      return select(-1, cy, typeAt(x, cy + 1, t) == 1u);
    }
  }
  return -1;
}

// Displaced water with no free neighbor and no stack cell to flee to reappears on the
// pool surface in a random nearby column that has one (biased close) (the surface the displacing tile
// pushed up), so sinking sand raises the water level instead of deleting the water,
// and water never lands on top of a pile. If no column in reach has a surface it falls
// back to the first free cell above it through its own body of water; when anything
// else is in the way (e.g. the sand stream that displaced it) the tile is dropped
// rather than carried up into the air.
fn surfaceReturn(t : u32, x : i32, y : i32) -> Move {
  for (var k = 0u; k < WATER_RETURN_TRIES; k++) {
    let r = rand(u32(x), u32(y), stepU.step * 31u + k);
    let side = select(-1.0, 1.0, (k & 1u) == 1u);
    let sx = x + i32(side * r * r * f32(WATER_RETURN_REACH));
    if (sx < 0 || sx >= i32(u.width)) {
      continue;
    }
    let top = waterSurfaceAbove(t, sx, y);
    for (var j = 0; top >= 0 && j < 4; j++) {
      if (!enterable(t, sx, top - j)) {
        break;
      }
      if (claim(sx, top - j)) {
        return moveTo(sx, top - j, 0u);
      }
    }
  }
  for (var cy = y - 1; cy >= 0; cy--) {
    if (enterable(t, x, cy)) {
      if (claim(x, cy)) {
        return moveTo(x, cy, 0u);
      }
    } else if (typeAt(x, cy, t) == 0u) {
      break;
    }
  }
  return tileGone();
}

// Liquid (every liquid shares Water's tuning): falls straight down (up to WATER_FALL cells, claiming only the final cell and
// falling back to shallower ones). The falling stack below it (up to FALL_CHAIN tiles)
// is looked through to the open air under it, so a whole stack shifts down together;
// the tiles it moves into are vacated by the stack tiles moving the same way, and any
// that fail are resolved by the claim like any displaced tile, else slides diagonally down, closes enclosed
// pockets, then slides sideways (waterSlide: toward the lowest surface in reach, else an occasional hop along the shared flow direction). Speeds are
// move chances resolved with a shared step phase, so a body of water moves
// together. Like smoke it only writes cells it claimed: when a sinking tile
// has already claimed this cell, the water flees up or sideways, and is lost
// only if it is fully enclosed.
fn updateLiquid(x : i32, y : i32, t : u32) -> Move {
  let dir = waterFlow(x, y);

  let chain = fallChain(x, y, t);
  var depth = 0;
  while (depth < WATER_FALL && enterable(t, x, y + chain + depth + 1)) {
    depth++;
  }
  for (var d = depth; d > 0; d--) {
    if (claim(x, y + d)) {
      return moveTo(x, y + d, 0u);
    }
  }
  let pocket = pocketMove(x, y, t, WATER_POCKET);
  if ((pocket.x != 0 || pocket.y != 0) && claim(x + pocket.x, y + pocket.y)) {
    return moveTo(x + pocket.x, y + pocket.y, 0u);
  }

  // A tile too high up a falling stack to see its bottom is not resting: it waits
  // for the stack instead of sliding off sideways in mid-air.
  let openSide = enterable(t, x - 1, y) || enterable(t, x + 1, y);
  let openDiagonal = depth == 0 && (enterable(t, x - 1, y + 1) || enterable(t, x + 1, y + 1));
  let suspended = (openSide || openDiagonal) && depth == 0 && chain == FALL_CHAIN && onFallingStack(t, x, y);
  if (suspended) {
    mark(x, y);
  }

  // Only a tile with an open cell beside it can slide (waterSlide needs one).
  if (!suspended && openSide) {
    let slide = waterSlide(t, x, y, dir);
    if (rand(u32(x), u32(y), stepU.step ^ 0x51ED270Bu) < WATER_SPREAD) {
      for (var d = abs(slide); d > 0; d--) {
        let nx = x + sign(slide) * d;
        if (claim(nx, y)) {
          return moveTo(nx, y, 0u);
        }
      }
    } else if (slide != 0) {
      // Skipped its spread roll with somewhere to slide: it will try again.
      mark(x, y);
    }
  }

  for (var k = 0; k < 2; k++) {
    let sx = select(dir, -dir, k == 1);
    if (openDiagonal && !suspended && enterable(t, x + sx, y + 1) && claim(x + sx, y + 1)) {
      return moveTo(x + sx, y + 1, 0u);
    }
  }

  if (claim(x, y)) {
    return stay(0u);
  }
  let up = fleeUp(x, y, 0u);
  if (!(up.moved && up.dest.x < 0)) {
    return up;
  }
  var flee = array<vec2i, 5>(vec2i(0, -1), vec2i(dir, -1), vec2i(-dir, -1), vec2i(dir, 0), vec2i(-dir, 0));
  for (var k = 0; k < 5; k++) {
    if (enterable(t, x + flee[k].x, y + flee[k].y) && claim(x + flee[k].x, y + flee[k].y)) {
      return moveTo(x + flee[k].x, y + flee[k].y, 0u);
    }
  }
  return surfaceReturn(t, x, y);
}

// new-element:behaviors

// Write a solid tile (type t, now packed) that stays in place. A resting falling tile
// claims its cell too, so a stack follower that moves into it (because this tile
// failed to fall with its stack) cannot write the same cell; if the follower won the
// cell, this tile moves up into the stack cell it vacated (fleeUp).
fn settle(i : u32, x : i32, y : i32, t : u32, packed : u32, before : u32) {
  if (gravityOf(t) == 0u) {
    commit(i, i, packed, before);
    return;
  }
  var kept = stay(0u);
  if (!claim(x, y)) {
    kept = fleeUp(x, y, 0u);
  }
  if (kept.moved && kept.dest.x < 0) {
    markCell(i);
    return;
  }
  commit(i, select(i, u32(kept.dest.y) * u.width + u32(kept.dest.x), kept.moved), packed, before);
}

// First dispatch of every step: empties the awake chunks' write and claim cells
// (sleeping chunks keep theirs, see the chunk sleeping notes above).
@compute @workgroup_size(16, 16)
fn clearChunk(@builtin(workgroup_id) wid : vec3u, @builtin(local_invocation_id) lid : vec3u) {
  let g = cellOf(wid, lid);
  if (g.x >= u.width || g.y >= u.height) {
    return;
  }
  let i = g.y * u.width + g.x;
  writeBuf[i] = 0u;
  atomicStore(&claimBuf[i], 0u);
}

// Solids: powders fall (updateFall), static solids and custom behaviors run here.
@compute @workgroup_size(16, 16)
fn main(@builtin(workgroup_id) wid : vec3u, @builtin(local_invocation_id) lid : vec3u) {
  let g = cellOf(wid, lid);
  if (g.x >= u.width || g.y >= u.height) {
    return;
  }
  let i = g.y * u.width + g.x;
  let p = readBuf[i];
  let t = p & 0xFFu;
  if (t == AIR || u.types[t].phase != PHASE_SOLID) {
    return;
  }
  let value = (p >> 8u) & 0xFFu;
  let variant = (p >> 16u) & 0xFFu;
  let x = i32(g.x);
  let y = i32(g.y);

  // A tile that reacts turns into the result in place this step.
  let reacted = react(x, y, t);
  if (reacted == AIR) {
    markCell(i);
    return;
  }
  if (reacted != t) {
    settle(i, x, y, t, pack(reacted, 0u, variant, 0u), p);
    return;
  }

  // A tile that ages out turns into agedInto in place, like a reaction result.
  let aged = ageTile(x, y, t, p >> 24u);
  if (aged.x == AIR) {
    markCell(i);
    return;
  }
  if (aged.x != t) {
    settle(i, x, y, t, pack(aged.x, 0u, variant, 0u), p);
    return;
  }

  var result = stay(value);
  switch (t) {
    // new-element:cases
    default: {
      if (gravityOf(t) > 0u) {
        result = updateFall(x, y, t, value);
      }
    }
  }

  if (result.moved) {
    // The destination was claimed by this thread (claim() in the behavior).
    commit(i, u32(result.dest.y) * u.width + u32(result.dest.x), pack(t, result.newValue, variant, aged.y), p);
  } else {
    settle(i, x, y, t, pack(t, result.newValue, variant, aged.y), p);
  }
}

// Third dispatch of every step: gases. It runs after main and mainLiquid so falling
// tiles and liquids have already claimed the cells they displace. A gas tile always
// keeps its chunk awake (it drifts and dissipates by chance every step).
// Steam keeps a condensation timer in its value byte: it counts up while the tile is
// packed among other steam, drains otherwise, and a full timer turns the tile into water.
@compute @workgroup_size(16, 16)
fn mainGas(@builtin(workgroup_id) wid : vec3u, @builtin(local_invocation_id) lid : vec3u) {
  let g = cellOf(wid, lid);
  if (g.x >= u.width || g.y >= u.height) {
    return;
  }
  let i = g.y * u.width + g.x;
  let p = readBuf[i];
  let t = p & 0xFFu;
  if (u.types[t].phase != PHASE_GAS) {
    return;
  }
  markCell(i);
  let x = i32(g.x);
  let y = i32(g.y);
  let variant = (p >> 16u) & 0xFFu;
  if (rand(g.x, g.y, stepU.step ^ 0xE6546B64u) < u.types[t].dissipation) {
    return;
  }
  let reacted = react(x, y, t);
  if (reacted == AIR) {
    markCell(i);
    return;
  }
  if (reacted != t && claim(x, y)) {
    commit(i, i, pack(reacted, 0u, variant, 0u), p);
    return;
  }

  let aged = ageTile(x, y, t, p >> 24u);
  if (aged.x != t) {
    if (aged.x != AIR && claim(x, y)) {
      commit(i, i, pack(aged.x, 0u, variant, 0u), p);
    }
    return;
  }

  var value = 0u;
  if (t == SPARK) {
    value = (p >> 8u) & 0xFFu;
  } else if (t == STEAM) {
    value = (p >> 8u) & 0xFFu;
    if (typeAround(x, y, STEAM) >= STEAM_COMPACT) {
      value = min(value + 1u, 255u);
    } else {
      value = select(value - STEAM_COOL, 0u, value < STEAM_COOL);
    }
    if (value >= STEAM_CONDENSE_STEPS && rand(g.x, g.y, stepU.step ^ 0x7F4A7C15u) < STEAM_CONDENSE_CHANCE && claim(x, y)) {
      commit(i, i, pack(WATER, 0u, 0u, 0u), p);
      return;
    }
  }

  var result : Move;
  var landed = false;
  if (t == FLAME) {
    result = updateFlame(x, y, t);
  } else if (t == SPARK) {
    let spark = updateSpark(x, y, t, value);
    result = spark.step;
    landed = spark.landed;
  } else {
    result = updateGas(x, y, t, value, u.types[t].rise);
  }
  if (result.moved && result.dest.x < 0) {
    return;
  }
  var dest = i;
  if (result.moved) {
    dest = u32(result.dest.y) * u.width + u32(result.dest.x);
  }
  if (landed) {
    commit(i, dest, pack(FLAME, 0u, variant, 0u), p);
  } else {
    commit(i, dest, pack(t, result.newValue, variant, aged.y), p);
  }
}

// Second dispatch of every step: liquids. It runs after main so sinking
// tiles have already claimed the cells they displace.
@compute @workgroup_size(16, 16)
fn mainLiquid(@builtin(workgroup_id) wid : vec3u, @builtin(local_invocation_id) lid : vec3u) {
  let g = cellOf(wid, lid);
  if (g.x >= u.width || g.y >= u.height) {
    return;
  }
  let i = g.y * u.width + g.x;
  let p = readBuf[i];
  let t = p & 0xFFu;
  if (u.types[t].phase != PHASE_LIQUID) {
    return;
  }
  let x = i32(g.x);
  let y = i32(g.y);
  let variant = (p >> 16u) & 0xFFu;
  let reacted = react(x, y, t);
  if (reacted == AIR) {
    markCell(i);
    return;
  }
  if (reacted != t && claim(x, y)) {
    commit(i, i, pack(reacted, 0u, variant, 0u), p);
    return;
  }

  let result = updateLiquid(x, y, t);
  if (result.moved && result.dest.x < 0) {
    markCell(i);
    return;
  }
  var dest = i;
  if (result.moved) {
    dest = u32(result.dest.y) * u.width + u32(result.dest.x);
  }
  commit(i, dest, pack(t, result.newValue, variant, p >> 24u), p);
}
`;

/** Byte size of one brush stamp in the paint shader's stamp buffer (must match PAINT_WGSL). */
export const STAMP_BYTES = 40;

/**
 * Brush painting, rasterized on the GPU. Each stamp is the brush swept along a
 * segment (a to b): a cell is covered when its Euclidean (circle brush) or
 * Chebyshev (square brush) distance to the segment is at most the radius. One
 * dispatch covers the bounding box of all the frame's stamps; each covering
 * stamp paints the cell with its density chance, and the last one that does
 * wins, as if the stamps were applied in order. Overwrite is unconditional,
 * solid (collider) cells are skipped, and painted chunks are marked awake.
 */
export const PAINT_WGSL = /* wgsl */ `
${UNIFORMS_WGSL}

const AIR : u32 = ${SETTINGS.AIR_TYPE}u;
const CHUNK : u32 = ${CHUNK_SIZE}u;

struct PaintParams {
  x0 : u32,
  y0 : u32,
  w : u32,
  h : u32,
  count : u32,
}

struct Stamp {
  ax : f32,
  ay : f32,
  bx : f32,
  by : f32,
  radius : f32,
  density : f32,
  tileType : u32,
  square : u32,
  seed : u32,
  _pad : u32,
}

@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<uniform> params : PaintParams;
@group(0) @binding(2) var<storage, read> stamps : array<Stamp>;
@group(0) @binding(3) var<storage, read_write> grid : array<u32>;
@group(0) @binding(4) var<storage, read> solidBuf : array<u32>;
@group(0) @binding(5) var<storage, read_write> marks : array<atomic<u32>>;

fn hash(x : u32, y : u32, seed : u32) -> f32 {
  var h = (x * 0x27d4eb2du) ^ (y * 0x165667b1u) ^ (seed * 0x9e3779b9u);
  h = (h ^ (h >> 15u)) * 0x2c1b3c6du;
  h = (h ^ (h >> 12u)) * 0x297a2d39u;
  h = h ^ (h >> 15u);
  return f32(h >> 8u) / 16777216.0;
}

fn chebyshevAt(d : vec2f, s : vec2f, t : f32) -> f32 {
  let e = abs(d - t * s);
  return max(e.x, e.y);
}

// Chebyshev distance from d to the segment from the origin to s. It is convex and
// piecewise linear in t, so its minimum is at an endpoint or a kink: where either
// axis offset is zero or the two offsets are equal in size.
fn chebyshevToSegment(d : vec2f, s : vec2f) -> f32 {
  var best = min(chebyshevAt(d, s, 0.0), chebyshevAt(d, s, 1.0));
  let nums = array<f32, 4>(d.x, d.y, d.x - d.y, d.x + d.y);
  let dens = array<f32, 4>(s.x, s.y, s.x - s.y, s.x + s.y);
  for (var k = 0; k < 4; k++) {
    if (dens[k] != 0.0) {
      let t = nums[k] / dens[k];
      if (t > 0.0 && t < 1.0) {
        best = min(best, chebyshevAt(d, s, t));
      }
    }
  }
  return best;
}

fn euclideanToSegment(d : vec2f, s : vec2f) -> f32 {
  let lenSq = dot(s, s);
  let t = select(0.0, clamp(dot(d, s) / lenSq, 0.0, 1.0), lenSq > 0.0);
  return length(d - t * s);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (gid.x >= params.w || gid.y >= params.h) {
    return;
  }
  let x = params.x0 + gid.x;
  let y = params.y0 + gid.y;
  let i = y * u.width + x;
  if (solidBuf[i] != 0u) {
    return;
  }
  var painted = false;
  var packed = 0u;
  for (var k = 0u; k < params.count; k++) {
    let st = stamps[k];
    let d = vec2f(f32(x) - st.ax, f32(y) - st.ay);
    let s = vec2f(st.bx - st.ax, st.by - st.ay);
    let dist = select(euclideanToSegment(d, s), chebyshevToSegment(d, s), st.square != 0u);
    // The tolerance keeps cells exactly on the segment covered despite rounding (radius 0).
    if (dist <= st.radius + 1e-3 && hash(x, y, st.seed) < st.density) {
      painted = true;
      let variant = u32(hash(x, y, st.seed ^ 0x5bd1e995u) * 256.0);
      packed = select(st.tileType | (variant << 16u), 0u, st.tileType == AIR);
    }
  }
  if (painted) {
    grid[i] = packed;
    atomicStore(&marks[(y / CHUNK) * ((u.width + CHUNK - 1u) / CHUNK) + x / CHUNK], 1u);
  }
}
`;

/**
 * Chunk bookkeeping, run after every step (and after painting): a chunk whose
 * 3x3 neighborhood was marked this step is awake for CHUNK_KEEPALIVE_STEPS
 * more steps, otherwise its countdown drops by one. Awake chunks are appended
 * to the active list, whose length is the x of the indirect dispatch args
 * (cleared to 0 before this pass) used by the next step's dispatches.
 */
export const CHUNKS_WGSL = /* wgsl */ `
${UNIFORMS_WGSL}

const CHUNK : u32 = ${CHUNK_SIZE}u;
const KEEPALIVE : u32 = ${SETTINGS.CHUNK_KEEPALIVE_STEPS}u;

@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read> marks : array<u32>;
@group(0) @binding(2) var<storage, read_write> awake : array<u32>;
@group(0) @binding(3) var<storage, read_write> activeChunks : array<u32>;
@group(0) @binding(4) var<storage, read_write> args : array<atomic<u32>, 3>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let cw = (u.width + CHUNK - 1u) / CHUNK;
  let ch = (u.height + CHUNK - 1u) / CHUNK;
  if (gid.x == 0u) {
    atomicStore(&args[1], 1u);
    atomicStore(&args[2], 1u);
  }
  if (gid.x >= cw * ch) {
    return;
  }
  let cx = i32(gid.x % cw);
  let cy = i32(gid.x / cw);
  var touched = false;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let nx = cx + dx;
      let ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < i32(cw) && ny < i32(ch) && marks[u32(ny) * cw + u32(nx)] != 0u) {
        touched = true;
      }
    }
  }
  let left = awake[gid.x];
  let next = select(select(0u, left - 1u, left > 0u), KEEPALIVE, touched);
  awake[gid.x] = next;
  if (next > 0u) {
    activeChunks[atomicAdd(&args[0], 1u)] = gid.x;
  }
}
`;

/**
 * Counts tiles for the performance HUD: non-air tiles in the new state and
 * tiles that moved this step. Every mover lands in a cell whose previous
 * content differs (air, or a tile it displaced or that shifted on with its
 * stack), so movers = occupied cells whose type or variant changed. The value
 * byte is ignored (fall remainders and steam timers change in place). Equal
 * variants of the same type can hide a move, a 1-in-256 undercount. Counts are
 * reduced per workgroup first to avoid one global atomic per tile.
 */
export const STATS_WGSL = /* wgsl */ `
${UNIFORMS_WGSL}

@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read> prevGrid : array<u32>;
@group(0) @binding(2) var<storage, read> currGrid : array<u32>;
@group(0) @binding(3) var<storage, read_write> totals : array<atomic<u32>, 2>;

var<workgroup> local : array<atomic<u32>, 2>;

@compute @workgroup_size(16, 16)
fn main(
  @builtin(global_invocation_id) gid : vec3u,
  @builtin(local_invocation_index) li : u32,
) {
  if (li == 0u) {
    atomicStore(&local[0], 0u);
    atomicStore(&local[1], 0u);
  }
  workgroupBarrier();

  if (gid.x < u.width && gid.y < u.height) {
    let i = gid.y * u.width + gid.x;
    let curr = currGrid[i];
    if ((curr & 0xFFu) != 0u) {
      atomicAdd(&local[0], 1u);
      if ((curr & 0xFF00FFu) != (prevGrid[i] & 0xFF00FFu)) {
        atomicAdd(&local[1], 1u);
      }
    }
  }
  workgroupBarrier();

  if (li == 0u) {
    atomicAdd(&totals[0], atomicLoad(&local[0]));
    atomicAdd(&totals[1], atomicLoad(&local[1]));
  }
}
`;
