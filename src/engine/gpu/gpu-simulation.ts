import { SETTINGS } from '../../settings';
import type { ColliderManager } from '../collider';
import { MAX_OUTCOMES, MAX_REACTIONS, type ElementRegistry } from '../element';
import { fitWorld, type WorldSnapshot } from '../world-file';
import {
  CHUNK_SIZE,
  CHUNKS_WGSL,
  COMPUTE_WGSL,
  HAZE_NONE,
  HAZE_WGSL,
  PAINT_WGSL,
  PHASE_CODES,
  REACTION_BYTES,
  RENDER_WGSL,
  STAMP_BYTES,
  STATS_WGSL,
  TYPE_INFO_BYTES,
  BLAST_RESIST_SHIFT,
  FLAG_CONSUMED,
  FLAG_FLAMMABLE,
  FLAG_HOLDS_ON_FLAMMABLE,
  FLAG_FUEL_FED,
  FLAG_EMITS_BELOW,
  OUTCOME_BYTES,
} from './shaders';

const UNIFORM_HEADER_BYTES = 48;
/** Header slot for the wind strength (-1..1). */
const WIND_OFFSET_BYTES = 12;
/**
 * Header slots read by the render and haze shaders: elapsed wall-clock seconds
 * (drives the smoke wisps) and the number of sim steps this frame (the haze
 * blends once per step, so smoothing is the same at any refresh rate).
 */
const TIME_OFFSET_BYTES = 24;
const TYPES_OFFSET_BYTES = UNIFORM_HEADER_BYTES;
const REACTIONS_OFFSET_BYTES = TYPES_OFFSET_BYTES + 256 * TYPE_INFO_BYTES;
const OUTCOMES_OFFSET_BYTES = REACTIONS_OFFSET_BYTES + MAX_REACTIONS * REACTION_BYTES;
const UNIFORM_BYTES = OUTCOMES_OFFSET_BYTES + MAX_OUTCOMES * OUTCOME_BYTES;
const COLOR_TEX_SIZE = 256;
/** How often the HUD counters are sampled from the GPU, in ms. */
const STATS_INTERVAL_MS = 500;
const WORKGROUP_SIZE = 16;
const CHUNK_WORKGROUP_SIZE = 64;
const MAX_STEPS_PER_FRAME = 5;
/** Most brush stamps per frame (one per sim step is typical); extra ones are dropped. */
const MAX_STAMPS = 32;
/** Dynamic-offset uniforms must be aligned to minUniformBufferOffsetAlignment (<= 256). */
const STEP_SLOT_BYTES = 256;
/** Cap on a single frame gap (hidden tab) so we don't spiral on return, in ms. */
const MAX_FRAME_GAP_MS = 250;
/** Steps the haze keeps blending after the sim goes quiet, before frames stop entirely. */
const SETTLE_STEPS = 60;

/** Parse '#rrggbb' into 0-1 RGBA (opaque). */
function parseHexColor(hex: string): [number, number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255, 1];
}

/** Brush settings for GpuSimulation.paintStroke. */
export interface Brush {
  shape: 'circle' | 'square';
  /** Radius in grid cells. */
  radius: number;
  /** Chance (0..1) that each covered cell is painted. */
  density: number;
  /** Element type to paint; Air erases. */
  type: number;
}

/** Live performance numbers for the HUD; GPU-derived fields only update while stats are enabled. */
export interface PerfStats {
  fps: number;
  frameMs: number;
  stepsPerSecond: number;
  /** Sim steps skipped because frames took too long (the sim ran slower than real time). */
  droppedStepsPerSecond: number;
  /** Non-air tiles on screen. */
  tiles: number;
  /** Tiles that moved in the most recent sampled step. */
  moving: number;
  /** Submit-to-complete time of the sampled frame (steps + render), in ms. */
  gpuMs: number;
  cells: number;
  /** Chunks simulated in the latest step, of `chunks`. */
  activeChunks: number;
  chunks: number;
  /** Nothing is moving: frames are no longer submitted until something wakes the sim. */
  idle: boolean;
}

/**
 * GPU simulation backend: owns the device and every grid resource, runs
 * the fixed-timestep compute steps and renders the grid straight from the
 * GPU buffer. Each step is four indirect dispatches over the awake chunks
 * (clear, solids, liquids, gases; earlier passes claim the cells they
 * displace first) followed by the chunk bookkeeping pass.
 *
 * Idle: when no chunk is awake the sim stops stepping; once the haze has
 * settled it stops submitting frames entirely (the canvas keeps its last
 * frame) until painting, wind, collider or size changes wake it.
 *
 * A packed tile is a u32: type bits 0-7, value 8-15, variant 16-23, age 24-31
 * (see Element.ageRate; painted tiles and reaction results start at age 0).
 *
 * The grid lives in storage buffers rather than `r32uint` textures:
 * WebGPU has no `fillTexture`/`fillBuffer` (only `clearBuffer`), and
 * buffers also make painting a plain compute scatter.
 */
export class GpuSimulation {
  /** Tile edge in CSS pixels (a whole number of device pixels, so it can be fractional). */
  tileSize = 1;
  /** CSS y of grid row 0 relative to the canvas top (<= 0: the grid is anchored to the canvas bottom). */
  originY = 0;
  width = 0;
  height = 0;
  /**
   * Called once per animation frame, before encoding, with the number of sim
   * steps this frame will run (0 on high-refresh frames between steps).
   */
  onFrame: ((steps: number) => void) | null = null;
  /** Called once if the GPU device is lost (driver reset, GPU removed); the sim cannot continue. */
  onDeviceLost: ((reason: string) => void) | null = null;
  readonly perf: PerfStats = {
    fps: 0,
    frameMs: 0,
    stepsPerSecond: 0,
    droppedStepsPerSecond: 0,
    tiles: 0,
    moving: 0,
    gpuMs: 0,
    cells: 0,
    activeChunks: 0,
    chunks: 0,
    idle: false,
  };

  /** Tile edge in CSS pixels before device-pixel snapping (SETTINGS.TILE_SIZE, or setTileSize). */
  private requestedTileSize: number = SETTINGS.TILE_SIZE;
  /** Tile edge in device pixels. */
  private tilePx = 1;
  private cssWidth = 0;
  private cssHeight = 0;
  private readonly context: GPUCanvasContext;
  private readonly renderPipeline: GPURenderPipeline;
  private readonly computeLayout: GPUBindGroupLayout;
  private readonly clearPipeline: GPUComputePipeline;
  private readonly computePipeline: GPUComputePipeline;
  private readonly liquidPipeline: GPUComputePipeline;
  private readonly gasPipeline: GPUComputePipeline;
  private readonly chunkPipeline: GPUComputePipeline;
  private readonly hazeLayout: GPUBindGroupLayout;
  private readonly hazeHPipeline: GPUComputePipeline;
  private readonly hazeVPipeline: GPUComputePipeline;
  private readonly paintPipeline: GPUComputePipeline;
  private readonly statsPipeline: GPUComputePipeline;
  private readonly statsBuf: GPUBuffer;
  private readonly statsReadBuf: GPUBuffer;
  private readonly activityReadBuf: GPUBuffer;
  private readonly paintParamsBuf: GPUBuffer;
  private readonly stampBuf: GPUBuffer;
  private readonly colorTex: GPUTexture;
  private readonly uniformBuf: GPUBuffer;
  private readonly stepBuf: GPUBuffer;
  private readonly background = parseHexColor(SETTINGS.CANVAS_BACKGROUND);

  // Rebuilt on resize.
  private gridBufs: [GPUBuffer, GPUBuffer] | null = null;
  private claimBuf: GPUBuffer | null = null;
  private solidBuf: GPUBuffer | null = null;
  /** Haze (vec4f per cell, one channel per haze group): [0] = horizontal blur scratch, [1] = final blurred occupancy read by the render shader. */
  private hazeBufs: [GPUBuffer, GPUBuffer] | null = null;
  /** Per chunk: steps left awake (0 = asleep). */
  private awakeBuf: GPUBuffer | null = null;
  /** Per chunk: changed (or asked to wake) during the current step. */
  private marksBuf: GPUBuffer | null = null;
  /** Indices of the awake chunks; its length is argsBuf's x. */
  private activeListBuf: GPUBuffer | null = null;
  /** Indirect dispatch args (awake chunk count, 1, 1) for every sim dispatch. */
  private argsBuf: GPUBuffer | null = null;
  private chunkCount = 0;
  private hazeBindGroups: [GPUBindGroup, GPUBindGroup] | null = null;
  private renderBindGroups: [GPUBindGroup, GPUBindGroup] | null = null;
  private computeBindGroups: [GPUBindGroup, GPUBindGroup] | null = null;
  private paintBindGroups: [GPUBindGroup, GPUBindGroup] | null = null;
  private chunkBindGroup: GPUBindGroup | null = null;
  private readonly stepData = new Uint32Array((MAX_STEPS_PER_FRAME * STEP_SLOT_BYTES) / 4);
  /** Index of the grid buffer holding the current (read) state. */
  private current = 0;
  // Brush stamps queued for the next stepping frame, with their combined bounding box.
  private readonly stampData = new ArrayBuffer(MAX_STAMPS * STAMP_BYTES);
  private readonly stampF32 = new Float32Array(this.stampData);
  private readonly stampU32 = new Uint32Array(this.stampData);
  private stampCount = 0;
  private stampMinX = 0;
  private stampMaxX = 0;
  private stampMinY = 0;
  private stampMaxY = 0;
  private statsEnabled = false;
  private statsPending = false;
  private lastStatsTime = 0;
  private activityPending = false;
  private solidDirty = false;
  /** Mark every chunk awake before the next step (wind or collider change). */
  private wakeAllPending = false;
  /** No chunk is awake: sim steps are skipped while the haze settles. */
  private asleep = false;
  /** Settled: frames are not submitted at all until something wakes the sim. */
  private idle = false;
  private settleSteps = 0;
  /** Bumped on every wake, so an in-flight activity readback from before it is ignored. */
  private wakeGeneration = 0;
  private wind: number = SETTINGS.WIND;
  private stepsInWindow = 0;
  private droppedInWindow = 0;
  private windowStart = 0;
  private frameId = 0;
  private running = false;
  private lastTime = -1;
  private accumulator = 0;
  /** Wall-clock seconds the sim has been running (frame gaps capped), for render animation. */
  private elapsed = 0;
  /** prefers-reduced-motion: the decorative smoke wisps stop drifting. */
  private reducedMotion = false;
  private readonly stepMs = 1000 / SETTINGS.SIM_HZ;
  /** Number of sim steps executed since the last (re)build. */
  stepCount = 0;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    private readonly colliders: ColliderManager,
    private readonly registry: ElementRegistry,
  ) {
    this.context = context;
    this.context.configure({ device, format, alphaMode: 'opaque' });

    const module = device.createShaderModule({ code: RENDER_WGSL });
    this.renderPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });

    const storage = (type: GPUBufferBindingType, binding: number): GPUBindGroupLayoutEntry => ({
      binding,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type },
    });
    this.computeLayout = device.createBindGroupLayout({
      entries: [
        storage('uniform', 0),
        storage('read-only-storage', 1),
        storage('storage', 2),
        storage('storage', 3),
        storage('read-only-storage', 4),
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 4 },
        },
        storage('read-only-storage', 6),
        storage('storage', 7),
        storage('read-only-storage', 8),
      ],
    });
    const computeModule = device.createShaderModule({ code: COMPUTE_WGSL });
    const computePipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.computeLayout] });
    const computeEntry = (entryPoint: string): GPUComputePipeline =>
      device.createComputePipeline({
        layout: computePipelineLayout,
        compute: { module: computeModule, entryPoint },
      });
    this.clearPipeline = computeEntry('clearChunk');
    this.computePipeline = computeEntry('main');
    this.liquidPipeline = computeEntry('mainLiquid');
    this.gasPipeline = computeEntry('mainGas');
    this.chunkPipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: CHUNKS_WGSL }), entryPoint: 'main' },
    });

    this.hazeLayout = device.createBindGroupLayout({
      entries: [
        storage('uniform', 0),
        storage('read-only-storage', 1),
        storage('storage', 2),
        storage('storage', 3),
      ],
    });
    const hazeModule = device.createShaderModule({ code: HAZE_WGSL });
    const hazePipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.hazeLayout] });
    this.hazeHPipeline = device.createComputePipeline({
      layout: hazePipelineLayout,
      compute: { module: hazeModule, entryPoint: 'blurH' },
    });
    this.hazeVPipeline = device.createComputePipeline({
      layout: hazePipelineLayout,
      compute: { module: hazeModule, entryPoint: 'blurV' },
    });

    this.paintPipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: PAINT_WGSL }), entryPoint: 'main' },
    });
    this.statsPipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: STATS_WGSL }), entryPoint: 'main' },
    });
    this.statsBuf = device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    this.statsReadBuf = device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    this.activityReadBuf = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    this.paintParamsBuf = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.stampBuf = device.createBuffer({
      size: MAX_STAMPS * STAMP_BYTES,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.stepBuf = device.createBuffer({
      size: MAX_STEPS_PER_FRAME * STEP_SLOT_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.uniformBuf = device.createBuffer({
      size: UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.colorTex = this.buildColorTexture();
    colliders.onChange = () => {
      this.solidDirty = true;
      this.wakeAllPending = true;
      this.wake();
    };
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = motion.matches;
    motion.addEventListener('change', () => {
      this.reducedMotion = motion.matches;
    });
    void device.lost.then((info) => this.onDeviceLost?.(info.message || info.reason));
  }

  /**
   * Acquire adapter + device, then the canvas context. The device is
   * requested first so a failure leaves the canvas untouched (a canvas
   * locks to its first context type).
   */
  static async create(
    canvas: HTMLCanvasElement,
    colliders: ColliderManager,
    registry: ElementRegistry,
    cssWidth: number,
    cssHeight: number,
    tileSize: number = SETTINGS.TILE_SIZE,
  ): Promise<GpuSimulation> {
    const adapter = await navigator.gpu.requestAdapter();
    if (adapter === null) throw new Error('No WebGPU adapter');
    const device = await adapter.requestDevice();
    device.addEventListener('uncapturederror', (e) => console.error("[webgpu]", (e as GPUUncapturedErrorEvent).error.message));
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (context === null) throw new Error('WebGPU canvas context is unavailable');
    const sim = new GpuSimulation(
      canvas,
      device,
      context,
      navigator.gpu.getPreferredCanvasFormat(),
      colliders,
      registry,
    );
    sim.requestedTileSize = tileSize;
    sim.resize(cssWidth, cssHeight);
    return sim;
  }

  /** Change the requested tile edge in CSS pixels at runtime; rebuilds the world (grid state resets). */
  setTileSize(cssPx: number): void {
    this.requestedTileSize = cssPx;
    this.resize(this.cssWidth, this.cssHeight);
  }

  /** Rebuild all size-dependent resources (grid state resets). */
  resize(cssWidth: number, cssHeight: number): void {
    this.destroySizedResources();
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;

    const dpr = window.devicePixelRatio || 1;
    // At least one pixel and one cell: a hidden or collapsed window can report a zero or negative size.
    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    this.canvas.style.width = `${Math.max(0, cssWidth)}px`;
    this.canvas.style.height = `${Math.max(0, cssHeight)}px`;

    // Tiles are a whole number of device pixels so every tile renders the same size.
    this.tilePx = Math.max(
      1,
      Math.round(this.requestedTileSize * dpr),
      Math.ceil(Math.max(this.canvas.width, this.canvas.height) / SETTINGS.MAX_SIM_DIMENSION),
    );
    this.tileSize = this.tilePx / dpr;
    // The grid covers the whole canvas; it is anchored to the bottom so the floor
    // row sits on the canvas edge, and the top row may be partly hidden.
    this.width = Math.ceil(this.canvas.width / this.tilePx);
    this.height = Math.ceil(this.canvas.height / this.tilePx);
    this.originY = (this.canvas.height - this.height * this.tilePx) / dpr;

    const cells = this.width * this.height;
    const bytes = cells * 4;
    const storage = (size: number, extra = 0): GPUBuffer =>
      this.device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | extra });
    // Zero-initialized by WebGPU: every cell starts as air and every chunk asleep.
    const gridUsage = GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
    this.gridBufs = [storage(bytes, gridUsage), storage(bytes, gridUsage)];
    this.claimBuf = storage(bytes);
    this.solidBuf = storage(bytes, GPUBufferUsage.COPY_DST);
    this.hazeBufs = [storage(bytes * 4), storage(bytes * 4)];

    this.chunkCount =
      Math.ceil(this.width / CHUNK_SIZE) * Math.ceil(this.height / CHUNK_SIZE);
    this.awakeBuf = storage(this.chunkCount * 4);
    this.marksBuf = storage(this.chunkCount * 4, GPUBufferUsage.COPY_DST);
    this.activeListBuf = storage(this.chunkCount * 4);
    this.argsBuf = storage(
      12,
      GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    );
    this.device.queue.writeBuffer(this.argsBuf, 0, new Uint32Array([0, 1, 1]));
    this.rebuildSolidMask();

    this.writeUniforms();
    this.current = 0;
    this.stepCount = 0;
    this.accumulator = 0;
    this.stampCount = 0;
    this.solidDirty = false;
    this.wakeAllPending = false;
    this.perf.cells = cells;
    this.perf.chunks = this.chunkCount;
    this.perf.activeChunks = 0;
    this.renderBindGroups = [this.makeRenderBindGroup(0), this.makeRenderBindGroup(1)];
    this.computeBindGroups = [this.makeComputeBindGroup(0), this.makeComputeBindGroup(1)];
    this.hazeBindGroups = [this.makeHazeBindGroup(0), this.makeHazeBindGroup(1)];
    this.paintBindGroups = [this.makePaintBindGroup(0), this.makePaintBindGroup(1)];
    this.chunkBindGroup = this.makeChunkBindGroup();
    this.wake();
  }

  /** Re-rasterize collider rects into the solid mask (1 = blocked cell). */
  rebuildSolidMask(): void {
    if (this.solidBuf === null) return;
    this.device.queue.writeBuffer(this.solidBuf, 0, this.buildSolidMask());
  }

  private buildSolidMask(): Uint32Array {
    const mask = new Uint32Array(this.width * this.height);
    this.colliders.forEachRect((r) => {
      const x0 = Math.max(0, r.x);
      const x1 = Math.min(this.width, r.x + r.w);
      const y0 = Math.max(0, r.y);
      const y1 = Math.min(this.height, r.y + r.h);
      for (let y = y0; y < y1; y++) mask.fill(1, y * this.width + x0, y * this.width + x1);
    });
    return mask;
  }

  /** Copy the current grid out as a savable snapshot (see engine/world-file.ts). */
  async snapshotWorld(): Promise<WorldSnapshot> {
    return { width: this.width, height: this.height, tileCss: this.tileSize, cells: await this.readGrid() };
  }

  /**
   * Replace the grid with a saved world, resampled to the current tile size and anchored
   * bottom-center. Collider cells and unregistered types are cleared, and every chunk is
   * woken so the world settles on its own.
   */
  loadWorld(world: WorldSnapshot): void {
    if (this.gridBufs === null) return;
    const cells = fitWorld(world, this.width, this.height, this.tileSize);
    const solid = this.buildSolidMask();
    for (let i = 0; i < cells.length; i++) {
      if (solid[i] !== 0 || this.registry.get(cells[i] & 0xff) === null) cells[i] = 0;
    }
    for (const buf of this.gridBufs) this.device.queue.writeBuffer(buf, 0, cells);
    this.wakeAllPending = true;
    this.wake();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = -1;
    this.frameId = requestAnimationFrame((t) => this.frame(t));
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  /**
   * Fixed-timestep frame: accumulate elapsed time, run whole steps (max
   * MAX_STEPS_PER_FRAME, backlog dropped), then render, all in one submit.
   * While idle the loop keeps running (so painting can wake it) but submits nothing.
   */
  private frame(time: number): void {
    if (!this.running) return;
    if (this.lastTime < 0) this.lastTime = time;
    this.trackFrameTime(time - this.lastTime);
    const gap = Math.min(time - this.lastTime, MAX_FRAME_GAP_MS);
    this.accumulator += gap;
    if (!this.reducedMotion) this.elapsed += gap / 1000;
    this.lastTime = time;

    let steps = 0;
    while (this.accumulator >= this.stepMs && steps < MAX_STEPS_PER_FRAME) {
      this.accumulator -= this.stepMs;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) {
      // Steps dropped while simulating mean the sim runs slower than real time.
      if (!this.asleep) this.droppedInWindow += Math.floor(this.accumulator / this.stepMs);
      this.accumulator = 0;
    }

    // Hook runs before encoding so brush edits land in the pre-step state.
    this.onFrame?.(steps);
    this.perf.idle = this.idle;
    if (!this.idle) this.submitFrame(steps);
    this.frameId = requestAnimationFrame((t) => this.frame(t));
  }

  /** Smooth frame time (EMA) and derive fps and steps/s over ~500 ms windows. */
  private trackFrameTime(deltaMs: number): void {
    const perf = this.perf;
    if (deltaMs <= 0) return;
    perf.frameMs = perf.frameMs === 0 ? deltaMs : perf.frameMs * 0.9 + deltaMs * 0.1;
    perf.fps = 1000 / perf.frameMs;
    const now = performance.now();
    if (this.windowStart === 0) this.windowStart = now;
    if (now - this.windowStart >= STATS_INTERVAL_MS) {
      perf.stepsPerSecond = (this.stepsInWindow * 1000) / (now - this.windowStart);
      perf.droppedStepsPerSecond = (this.droppedInWindow * 1000) / (now - this.windowStart);
      this.stepsInWindow = 0;
      this.droppedInWindow = 0;
      this.windowStart = now;
    }
  }

  /** Grid cell under a point in CSS pixels relative to the canvas top-left (may be out of range). */
  cellAt(canvasX: number, canvasY: number): [number, number] {
    return [Math.floor(canvasX / this.tileSize), Math.floor((canvasY - this.originY) / this.tileSize)];
  }

  /** Set the wind on the X axis: -1 = full left, 0 = none, +1 = full right (clamped). */
  setWind(strength: number): void {
    this.wind = Math.max(-1, Math.min(1, strength));
    this.device.queue.writeBuffer(this.uniformBuf, WIND_OFFSET_BYTES, new Float32Array([this.wind]));
    this.wakeAllPending = true;
    this.wake();
  }

  /** Enable or disable the GPU-side tile counters (small extra pass twice a second). */
  setStatsEnabled(enabled: boolean): void {
    this.statsEnabled = enabled;
  }

  /**
   * Queue the brush swept from (ax, ay) to (bx, by), in grid cells, so a fast
   * drag paints a continuous stroke. Stamps are rasterized on the GPU in
   * order at the start of the next frame that steps the sim; overwrite is
   * unconditional and collider cells are skipped. At most MAX_STAMPS are
   * queued per frame (extra ones are dropped).
   */
  paintStroke(ax: number, ay: number, bx: number, by: number, brush: Brush): void {
    if (this.stampCount === MAX_STAMPS) return;
    const r = Math.max(0, brush.radius);
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r));
    const x1 = Math.min(this.width - 1, Math.ceil(Math.max(ax, bx) + r));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r));
    const y1 = Math.min(this.height - 1, Math.ceil(Math.max(ay, by) + r));
    if (x0 > x1 || y0 > y1) return;

    if (this.stampCount === 0) {
      [this.stampMinX, this.stampMaxX, this.stampMinY, this.stampMaxY] = [x0, x1, y0, y1];
    } else {
      this.stampMinX = Math.min(this.stampMinX, x0);
      this.stampMaxX = Math.max(this.stampMaxX, x1);
      this.stampMinY = Math.min(this.stampMinY, y0);
      this.stampMaxY = Math.max(this.stampMaxY, y1);
    }
    const o = (this.stampCount * STAMP_BYTES) / 4;
    this.stampF32.set([ax, ay, bx, by, r, brush.density], o);
    this.stampU32[o + 6] = brush.type;
    this.stampU32[o + 7] = brush.shape === 'square' ? 1 : 0;
    this.stampU32[o + 8] = (Math.random() * 0x100000000) >>> 0;
    this.stampCount++;
    this.wake();
  }

  /** Something may move again: resume stepping and submitting frames. */
  private wake(): void {
    this.wakeGeneration++;
    this.asleep = false;
    this.idle = false;
    this.perf.idle = false;
  }

  /** Encode up to `steps` sim steps plus the haze and render passes into one command buffer. */
  private submitFrame(steps: number): void {
    if (this.gridBufs === null || this.computeBindGroups === null || this.argsBuf === null) return;
    if (this.solidDirty) {
      this.solidDirty = false;
      this.rebuildSolidMask();
    }
    const simSteps = this.asleep ? 0 : steps;
    const encoder = this.device.createCommandEncoder();

    if (simSteps > 0) {
      let refresh = false;
      if (this.wakeAllPending) {
        this.wakeAllPending = false;
        this.device.queue.writeBuffer(this.marksBuf!, 0, new Uint32Array(this.chunkCount).fill(1));
        refresh = true;
      }
      if (this.stampCount > 0) {
        this.encodePaint(encoder);
        refresh = true;
      }
      // Painted or woken chunks must be awake for the first step (a sleeping
      // chunk's write buffer would still hold its pre-paint state).
      if (refresh) this.encodeChunkUpdate(encoder);

      for (let k = 0; k < simSteps; k++) {
        this.stepData[(k * STEP_SLOT_BYTES) / 4] = this.stepCount + k;
      }
      this.device.queue.writeBuffer(this.stepBuf, 0, this.stepData);

      for (let k = 0; k < simSteps; k++) {
        const pass = encoder.beginComputePass();
        pass.setBindGroup(0, this.computeBindGroups[this.current], [k * STEP_SLOT_BYTES]);
        // Liquid then gas run after the solids so falling tiles (and then liquids)
        // have already claimed the cells they displace.
        for (const pipeline of [
          this.clearPipeline,
          this.computePipeline,
          this.liquidPipeline,
          this.gasPipeline,
        ]) {
          pass.setPipeline(pipeline);
          pass.dispatchWorkgroupsIndirect(this.argsBuf, 0);
        }
        pass.end();
        this.encodeChunkUpdate(encoder);
        this.current = 1 - this.current;
      }
      this.stepCount += simSteps;
      this.stepsInWindow += simSteps;
    }
    this.device.queue.writeBuffer(
      this.uniformBuf,
      TIME_OFFSET_BYTES,
      new Float32Array([this.elapsed, steps]),
    );

    const groupsX = Math.ceil(this.width / WORKGROUP_SIZE);
    const groupsY = Math.ceil(this.height / WORKGROUP_SIZE);
    const sampleStats =
      this.statsEnabled &&
      simSteps > 0 &&
      !this.statsPending &&
      performance.now() - this.lastStatsTime >= STATS_INTERVAL_MS;
    if (sampleStats) this.encodeStats(encoder, groupsX, groupsY);
    const sampleActivity = simSteps > 0 && !this.activityPending;
    if (sampleActivity) encoder.copyBufferToBuffer(this.argsBuf, 0, this.activityReadBuf, 0, 4);

    // The grid only changes on steps, so the haze only needs updating then; it
    // keeps blending (per step) for a while after the sim falls asleep.
    if (steps > 0) this.encodeHaze(encoder, groupsX, groupsY);
    this.encodeRender(encoder);
    const submittedAt = performance.now();
    this.device.queue.submit([encoder.finish()]);
    if (sampleStats) this.readStats(submittedAt);
    if (sampleActivity) this.readActivity();

    if (this.asleep) {
      this.settleSteps += steps;
      if (this.settleSteps >= SETTLE_STEPS) this.idle = true;
    }
  }

  /** Rebuild the awake chunk list (and next step's dispatch args) from this step's marks. */
  private encodeChunkUpdate(encoder: GPUCommandEncoder): void {
    encoder.clearBuffer(this.argsBuf!);
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.chunkPipeline);
    pass.setBindGroup(0, this.chunkBindGroup!);
    pass.dispatchWorkgroups(Math.ceil(this.chunkCount / CHUNK_WORKGROUP_SIZE));
    pass.end();
    encoder.clearBuffer(this.marksBuf!);
  }

  /** Read back the awake chunk count; zero means nothing can move until something wakes the sim. */
  private readActivity(): void {
    this.activityPending = true;
    const generation = this.wakeGeneration;
    void this.activityReadBuf
      .mapAsync(GPUMapMode.READ)
      .then(() => {
        const count = new Uint32Array(this.activityReadBuf.getMappedRange())[0];
        this.activityReadBuf.unmap();
        this.perf.activeChunks = count;
        if (count === 0 && generation === this.wakeGeneration && !this.asleep) {
          this.asleep = true;
          this.settleSteps = 0;
          this.perf.moving = 0;
        }
      })
      .finally(() => {
        this.activityPending = false;
      });
  }

  /** Count non-air tiles and tiles that arrived in a new cell between the last step's read and write buffers. */
  private encodeStats(encoder: GPUCommandEncoder, groupsX: number, groupsY: number): void {
    encoder.clearBuffer(this.statsBuf);
    const bindGroup = this.device.createBindGroup({
      layout: this.statsPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.gridBufs![1 - this.current] } },
        { binding: 2, resource: { buffer: this.gridBufs![this.current] } },
        { binding: 3, resource: { buffer: this.statsBuf } },
      ],
    });
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.statsPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(groupsX, groupsY);
    pass.end();
    encoder.copyBufferToBuffer(this.statsBuf, 0, this.statsReadBuf, 0, 8);
  }

  private readStats(submittedAt: number): void {
    this.statsPending = true;
    this.lastStatsTime = submittedAt;
    void this.statsReadBuf
      .mapAsync(GPUMapMode.READ)
      .then(() => {
        const totals = new Uint32Array(this.statsReadBuf.getMappedRange().slice(0));
        this.statsReadBuf.unmap();
        this.perf.tiles = totals[0];
        this.perf.moving = totals[1];
        this.perf.gpuMs = performance.now() - submittedAt;
      })
      .finally(() => {
        this.statsPending = false;
      });
  }

  /** Upload the queued stamps and rasterize them into the current grid in one dispatch over their bounding box. */
  private encodePaint(encoder: GPUCommandEncoder): void {
    const w = this.stampMaxX - this.stampMinX + 1;
    const h = this.stampMaxY - this.stampMinY + 1;
    this.device.queue.writeBuffer(this.stampBuf, 0, this.stampData, 0, this.stampCount * STAMP_BYTES);
    this.device.queue.writeBuffer(
      this.paintParamsBuf,
      0,
      new Uint32Array([this.stampMinX, this.stampMinY, w, h, this.stampCount]),
    );
    this.stampCount = 0;
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.paintPipeline);
    pass.setBindGroup(0, this.paintBindGroups![this.current]);
    pass.dispatchWorkgroups(Math.ceil(w / WORKGROUP_SIZE), Math.ceil(h / WORKGROUP_SIZE));
    pass.end();
  }

  /** Debug: copy the current grid back to the CPU (conservation checks). */
  async readGrid(): Promise<Uint32Array> {
    const size = this.width * this.height * 4;
    const staging = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(this.gridBufs![this.current], 0, staging, 0, size);
    this.device.queue.submit([encoder.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const copy = new Uint32Array(staging.getMappedRange().slice(0));
    staging.unmap();
    staging.destroy();
    return copy;
  }

  /** Blur haze-drawn occupancy (smoke, water, steam channels) of the current grid into the buffer the render pass samples. */
  private encodeHaze(encoder: GPUCommandEncoder, groupsX: number, groupsY: number): void {
    if (this.hazeBindGroups === null) return;
    const pass = encoder.beginComputePass();
    pass.setBindGroup(0, this.hazeBindGroups[this.current]);
    pass.setPipeline(this.hazeHPipeline);
    pass.dispatchWorkgroups(groupsX, groupsY);
    pass.setPipeline(this.hazeVPipeline);
    pass.dispatchWorkgroups(groupsX, groupsY);
    pass.end();
  }

  /** Encode the render pass for the current grid buffer. */
  private encodeRender(encoder: GPUCommandEncoder): void {
    if (this.renderBindGroups === null) return;
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: {
            r: this.background[0],
            g: this.background[1],
            b: this.background[2],
            a: 1,
          },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(this.renderPipeline);
    pass.setBindGroup(0, this.renderBindGroups[this.current]);
    pass.draw(3);
    pass.end();
  }

  private makeRenderBindGroup(gridIndex: number): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.gridBufs![gridIndex] } },
        { binding: 2, resource: this.colorTex.createView() },
        { binding: 3, resource: { buffer: this.hazeBufs![1] } },
      ],
    });
  }

  private makeHazeBindGroup(gridIndex: number): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.hazeLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.gridBufs![gridIndex] } },
        { binding: 2, resource: { buffer: this.hazeBufs![0] } },
        { binding: 3, resource: { buffer: this.hazeBufs![1] } },
      ],
    });
  }

  /** Bind group stepping from grid buffer `readIndex` into the other one. */
  private makeComputeBindGroup(readIndex: number): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.computeLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.gridBufs![readIndex] } },
        { binding: 2, resource: { buffer: this.gridBufs![1 - readIndex] } },
        { binding: 3, resource: { buffer: this.claimBuf! } },
        { binding: 4, resource: { buffer: this.solidBuf! } },
        { binding: 5, resource: { buffer: this.stepBuf, size: 4 } },
        { binding: 6, resource: { buffer: this.awakeBuf! } },
        { binding: 7, resource: { buffer: this.marksBuf! } },
        { binding: 8, resource: { buffer: this.activeListBuf! } },
      ],
    });
  }

  /** Bind group painting into grid buffer `gridIndex`. */
  private makePaintBindGroup(gridIndex: number): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.paintPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.paintParamsBuf } },
        { binding: 2, resource: { buffer: this.stampBuf } },
        { binding: 3, resource: { buffer: this.gridBufs![gridIndex] } },
        { binding: 4, resource: { buffer: this.solidBuf! } },
        { binding: 5, resource: { buffer: this.marksBuf! } },
      ],
    });
  }

  private makeChunkBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.chunkPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.marksBuf! } },
        { binding: 2, resource: { buffer: this.awakeBuf! } },
        { binding: 3, resource: { buffer: this.activeListBuf! } },
        { binding: 4, resource: { buffer: this.argsBuf! } },
      ],
    });
  }

  private destroySizedResources(): void {
    const sized = [
      ...(this.gridBufs ?? []),
      ...(this.hazeBufs ?? []),
      this.claimBuf,
      this.solidBuf,
      this.awakeBuf,
      this.marksBuf,
      this.activeListBuf,
      this.argsBuf,
    ];
    for (const buffer of sized) buffer?.destroy();
    this.gridBufs = null;
    this.hazeBufs = null;
    this.claimBuf = null;
    this.solidBuf = null;
    this.awakeBuf = null;
    this.marksBuf = null;
    this.activeListBuf = null;
    this.argsBuf = null;
    this.hazeBindGroups = null;
    this.renderBindGroups = null;
    this.computeBindGroups = null;
    this.paintBindGroups = null;
    this.chunkBindGroup = null;
  }

  /**
   * Uniform buffer: header (size, canvas size, wind, background; the step
   * counter lives in stepBuf, time and frame steps are written per frame),
   * then the per-type table and reaction rules from the element registry.
   */
  private writeUniforms(): void {
    const data = new ArrayBuffer(UNIFORM_BYTES);
    const u32 = new Uint32Array(data);
    const f32 = new Float32Array(data);
    u32[0] = this.width;
    u32[1] = this.height;
    f32[2] = this.tilePx;
    f32[WIND_OFFSET_BYTES / 4] = this.wind;
    f32[4] = 0;
    f32[5] = this.canvas.height - this.height * this.tilePx;
    f32.set(this.background, 8);

    const typeWords = TYPE_INFO_BYTES / 4;
    for (let t = 0; t < 256; t++) u32[TYPES_OFFSET_BYTES / 4 + t * typeWords + 2] = HAZE_NONE;
    const consumedTypes = new Set(
      this.registry.list().flatMap((e) => e.reactions.filter((r) => r.consumes).map((r) => r.with)),
    );
    let rule = 0;
    let outcome = 0;
    for (const element of this.registry.list()) {
      const o = TYPES_OFFSET_BYTES / 4 + element.type * typeWords;
      u32[o] = element.gravityQuantum;
      u32[o + 1] = PHASE_CODES[element.phase];
      u32[o + 2] = element.hazeChannel ?? HAZE_NONE;
      u32[o + 3] = rule | (element.reactions.length << 16);
      f32[o + 4] = element.slideChance;
      f32[o + 5] = element.density;
      f32[o + 6] = element.riseSpeed;
      f32[o + 7] = element.dissipationChance;
      f32[o + 8] = element.cohesion;
      u32[o + 9] = (consumedTypes.has(element.type) ? FLAG_CONSUMED : 0) | (element.flammable ? FLAG_FLAMMABLE : 0)
        | (element.holdsOnFlammable ? FLAG_HOLDS_ON_FLAMMABLE : 0)
        | (element.fuelFed ? FLAG_FUEL_FED : 0)
        | (element.emitBelow ? FLAG_EMITS_BELOW : 0)
        | (Math.round(element.blastResistance * 255) << BLAST_RESIST_SHIFT);
      f32[o + 10] = element.ageRate;
      u32[o + 11] = outcome | (element.agedInto.length << 16);
      u32[o + 12] = element.emitType;
      f32[o + 13] = element.emitChance;
      for (const aged of element.agedInto) {
        const a = (OUTCOMES_OFFSET_BYTES + outcome * OUTCOME_BYTES) / 4;
        u32[a] = aged.type;
        f32[a + 1] = aged.chance;
        outcome++;
      }
      for (const reaction of element.reactions) {
        const r = (REACTIONS_OFFSET_BYTES + rule * REACTION_BYTES) / 4;
        u32[r] = reaction.with;
        u32[r + 1] = reaction.becomes;
        f32[r + 2] = reaction.chance;
        u32[r + 3] = reaction.consumes ? 1 : 0;
        u32[r + 4] = reaction.radius ?? 1;
        rule++;
      }
    }
    this.device.queue.writeBuffer(this.uniformBuf, 0, data);
  }

  /**
   * 256x256 rgba8unorm table indexed by (x = type, y = variant), built from
   * each element's getColor. Color on the GPU therefore depends on
   * (type, variant) only, never on the value byte; for aging types (ageRate > 0)
   * the row is the tile's age instead of its variant.
   */
  private buildColorTexture(): GPUTexture {
    const pixels = new Uint8Array(COLOR_TEX_SIZE * COLOR_TEX_SIZE * 4);
    for (const element of this.registry.list()) {
      if (element.type === SETTINGS.AIR_TYPE) continue;
      for (let variant = 0; variant < COLOR_TEX_SIZE; variant++) {
        const [r, g, b] = element.getColor(0, variant);
        const i = (variant * COLOR_TEX_SIZE + element.type) * 4;
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
        pixels[i + 3] = 255;
      }
    }
    const tex = this.device.createTexture({
      size: [COLOR_TEX_SIZE, COLOR_TEX_SIZE],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.device.queue.writeTexture(
      { texture: tex },
      pixels,
      { bytesPerRow: COLOR_TEX_SIZE * 4 },
      [COLOR_TEX_SIZE, COLOR_TEX_SIZE],
    );
    return tex;
  }
}
