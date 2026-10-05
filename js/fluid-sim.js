// FLIP liquid simulation and pixel renderer for the homepage background.
// Runs inside js/fluid-worker.js, or on the main thread when OffscreenCanvas
// isn't available. Positions are CSS px in "sim space": the grid is padded
// with one solid cell on every side and offset (ox, oy) so its right wall
// sits on the viewport's right edge and its floor on the footer's top edge.

const FLUID = 0;
const AIR = 1;
const SOLID = 2;

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 2;
const MAX_SUBSTEPS = 2;
const GRAVITY = 1800;
const MAX_SPEED = 2400;
const FLIP_RATIO = 0.9;
const OVER_RELAX = 1.9;
const PPC = 2;                    // particles per sim cell at rest
const REST_DENSITY = 0.9 * PPC;   // grid density above this gets pushed apart
const SETTLED_DENSITY = 0.85 * PPC; // measured interior density of a resting pool
const DRIFT_K = 0.3;              // push-apart strength, in cells per step per unit of excess

// The grid coarsens as the pool fills so the particle count stays flat.
// Sizes are for a 1080p screen and scale up with area on larger ones.
const CELL_SIZES = [10, 14, 20];
const BASE_AREA = 1920 * 1080;
const LEVEL_FILLS = [0.25, 0.55];

const SPOUT_RISE = 0.8;           // spout height above the floor, share of floor depth
const FILL_SECONDS = 75;
const TAPER_SECONDS = 1;
const SETTLE_DAMPING = 0.015;     // per-step velocity loss once the pour stops
const SETTLE_RAMP_STEPS = 120;

// Pointer interaction, in CSS px. The radius is at least a couple of cells.
const REMOVE_RADIUS = 140;
const STIR_RADIUS = 56;
const STIR_STRENGTH = 0.35;       // share of pointer velocity blended in per step
const POINTER_STEPS = 6;          // steps a pointer move keeps stirring

// Quality tiers dropped one at a time while a step runs over budget.
const QUALITY = [
  { pressure: 40, separate: 2 },
  { pressure: 30, separate: 2 },
  { pressure: 24, separate: 1 },
  { pressure: 16, separate: 1 },
];
const STEP_BUDGET_MS = 4;

const SURFACE = 0.3;              // splatted density counted as liquid
const SPLAT = 2.2;                // splat radius, in particle radii
const FAST_LO = 250;              // speeds (px/s) blended toward the highlight
const FAST_HI = 700;
const SHADES = 8;

function levelFor(fill) {
  let level = 0;
  while (level < LEVEL_FILLS.length && fill >= LEVEL_FILLS[level]) level++;
  return level;
}

class Flip {
  constructor(width, height, h, capacity) {
    const nx = Math.ceil(width / h) + 2;
    const ny = Math.ceil(height / h) + 2;
    this.nx = nx;
    this.ny = ny;
    this.h = h;
    this.invH = 1 / h;
    this.ox = (nx - 1) * h - width;
    this.oy = (ny - 1) * h - height;
    this.r = h / Math.sqrt(2 * Math.sqrt(3) * PPC);
    this.area = h * h / PPC;

    const cells = nx * ny;
    this.u = new Float32Array(cells);
    this.v = new Float32Array(cells);
    this.du = new Float32Array(cells);
    this.dv = new Float32Array(cells);
    this.prevU = new Float32Array(cells);
    this.prevV = new Float32Array(cells);
    this.density = new Float32Array(cells);
    this.type = new Uint8Array(cells);
    this.s = new Float32Array(cells);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const wall = i === 0 || i === nx - 1 || j === 0 || j === ny - 1;
        this.s[i * ny + j] = wall ? 0 : 1;
      }
    }

    this.capacity = capacity;
    this.count = 0;
    this.pos = new Float32Array(2 * capacity);
    this.vel = new Float32Array(2 * capacity);

    // Spatial hash for particle separation.
    this.pInv = 1 / (2.2 * this.r);
    this.pnx = Math.floor(nx * h * this.pInv) + 1;
    this.pny = Math.floor(ny * h * this.pInv) + 1;
    this.cellCount = new Int32Array(this.pnx * this.pny);
    this.cellStart = new Int32Array(this.pnx * this.pny + 1);
    this.cellIds = new Int32Array(capacity);

    this.meanSpeed = 0;
    this.maxSpeed = 0;
  }

  // Swaps the last particle into slot i.
  remove(i) {
    const last = --this.count;
    this.pos[2 * i] = this.pos[2 * last];
    this.pos[2 * i + 1] = this.pos[2 * last + 1];
    this.vel[2 * i] = this.vel[2 * last];
    this.vel[2 * i + 1] = this.vel[2 * last + 1];
  }

  add(x, y, vx, vy) {
    if (this.count >= this.capacity) return false;
    const k = 2 * this.count++;
    this.pos[k] = x;
    this.pos[k + 1] = y;
    this.vel[k] = vx;
    this.vel[k + 1] = vy;
    return true;
  }

  simulate(dt, pressureIters, separateIters) {
    this.integrate(dt);
    this.separate(separateIters);
    this.collide();
    this.transfer(true);
    this.updateDensity();
    this.solve(pressureIters, dt);
    this.transfer(false);
  }

  integrate(dt) {
    const { pos, vel, count } = this;
    const max2 = MAX_SPEED * MAX_SPEED;
    for (let i = 0; i < count; i++) {
      let vx = vel[2 * i];
      let vy = vel[2 * i + 1] + GRAVITY * dt;
      const sp2 = vx * vx + vy * vy;
      if (sp2 > max2) {
        const k = MAX_SPEED / Math.sqrt(sp2);
        vx *= k;
        vy *= k;
      }
      vel[2 * i] = vx;
      vel[2 * i + 1] = vy;
      pos[2 * i] += vx * dt;
      pos[2 * i + 1] += vy * dt;
    }
  }

  separate(iters) {
    const { pos, count, pInv, pnx, pny, cellCount, cellStart, cellIds } = this;

    cellCount.fill(0);
    for (let i = 0; i < count; i++) {
      const xi = Math.min(Math.max(Math.floor(pos[2 * i] * pInv), 0), pnx - 1);
      const yi = Math.min(Math.max(Math.floor(pos[2 * i + 1] * pInv), 0), pny - 1);
      cellCount[xi * pny + yi]++;
    }
    let first = 0;
    for (let c = 0; c < cellCount.length; c++) {
      first += cellCount[c];
      cellStart[c] = first;
    }
    cellStart[cellCount.length] = first;
    for (let i = 0; i < count; i++) {
      const xi = Math.min(Math.max(Math.floor(pos[2 * i] * pInv), 0), pnx - 1);
      const yi = Math.min(Math.max(Math.floor(pos[2 * i + 1] * pInv), 0), pny - 1);
      cellIds[--cellStart[xi * pny + yi]] = i;
    }

    const minDist = 2 * this.r;
    const minDist2 = minDist * minDist;
    for (let iter = 0; iter < iters; iter++) {
      for (let i = 0; i < count; i++) {
        let px = pos[2 * i];
        let py = pos[2 * i + 1];
        const pxi = Math.floor(px * pInv);
        const pyi = Math.floor(py * pInv);
        const x0 = Math.max(pxi - 1, 0);
        const y0 = Math.max(pyi - 1, 0);
        const x1 = Math.min(pxi + 1, pnx - 1);
        const y1 = Math.min(pyi + 1, pny - 1);
        for (let xi = x0; xi <= x1; xi++) {
          for (let yi = y0; yi <= y1; yi++) {
            const c = xi * pny + yi;
            for (let n = cellStart[c], end = cellStart[c + 1]; n < end; n++) {
              const id = cellIds[n];
              if (id === i) continue;
              let dx = pos[2 * id] - px;
              let dy = pos[2 * id + 1] - py;
              const d2 = dx * dx + dy * dy;
              if (d2 > minDist2 || d2 === 0) continue;
              const d = Math.sqrt(d2);
              const s = 0.5 * (minDist - d) / d;
              dx *= s;
              dy *= s;
              px -= dx;
              py -= dy;
              pos[2 * id] += dx;
              pos[2 * id + 1] += dy;
            }
          }
        }
        pos[2 * i] = px;
        pos[2 * i + 1] = py;
      }
    }
  }

  collide() {
    const { pos, vel, count, h, r, nx, ny } = this;
    const minX = h + r;
    const maxX = (nx - 1) * h - r;
    const minY = h + r;
    const maxY = (ny - 1) * h - r;
    for (let i = 0; i < count; i++) {
      const x = pos[2 * i];
      const y = pos[2 * i + 1];
      if (x < minX) { pos[2 * i] = minX; vel[2 * i] = 0; }
      if (x > maxX) { pos[2 * i] = maxX; vel[2 * i] = 0; }
      if (y < minY) { pos[2 * i + 1] = minY; vel[2 * i + 1] = 0; }
      if (y > maxY) { pos[2 * i + 1] = maxY; vel[2 * i + 1] = 0; }
    }
  }

  updateDensity() {
    const { pos, count, h, invH, nx, ny, density } = this;
    const h2 = 0.5 * h;
    density.fill(0);
    for (let i = 0; i < count; i++) {
      const x = Math.min(Math.max(pos[2 * i], h), (nx - 1) * h);
      const y = Math.min(Math.max(pos[2 * i + 1], h), (ny - 1) * h);
      const x0 = Math.floor((x - h2) * invH);
      const tx = (x - h2 - x0 * h) * invH;
      const x1 = Math.min(x0 + 1, nx - 2);
      const y0 = Math.floor((y - h2) * invH);
      const ty = (y - h2 - y0 * h) * invH;
      const y1 = Math.min(y0 + 1, ny - 2);
      const sx = 1 - tx;
      const sy = 1 - ty;
      density[x0 * ny + y0] += sx * sy;
      density[x1 * ny + y0] += tx * sy;
      density[x1 * ny + y1] += tx * ty;
      density[x0 * ny + y1] += sx * ty;
    }
  }

  // Particle -> grid when toGrid, otherwise grid -> particle (PIC/FLIP blend).
  transfer(toGrid) {
    const { pos, vel, count, h, invH, nx, ny, type, s } = this;
    const h2 = 0.5 * h;

    if (toGrid) {
      this.prevU.set(this.u);
      this.prevV.set(this.v);
      this.du.fill(0);
      this.dv.fill(0);
      this.u.fill(0);
      this.v.fill(0);
      for (let c = 0; c < type.length; c++) type[c] = s[c] === 0 ? SOLID : AIR;
      for (let i = 0; i < count; i++) {
        const xi = Math.min(Math.max(Math.floor(pos[2 * i] * invH), 0), nx - 1);
        const yi = Math.min(Math.max(Math.floor(pos[2 * i + 1] * invH), 0), ny - 1);
        const c = xi * ny + yi;
        if (type[c] === AIR) type[c] = FLUID;
      }
    }

    for (let comp = 0; comp < 2; comp++) {
      const dx = comp === 0 ? 0 : h2;
      const dy = comp === 0 ? h2 : 0;
      const f = comp === 0 ? this.u : this.v;
      const prev = comp === 0 ? this.prevU : this.prevV;
      const d = comp === 0 ? this.du : this.dv;
      const offset = comp === 0 ? ny : 1;

      for (let i = 0; i < count; i++) {
        const x = Math.min(Math.max(pos[2 * i], h), (nx - 1) * h);
        const y = Math.min(Math.max(pos[2 * i + 1], h), (ny - 1) * h);
        const x0 = Math.min(Math.floor((x - dx) * invH), nx - 2);
        const tx = (x - dx - x0 * h) * invH;
        const x1 = Math.min(x0 + 1, nx - 2);
        const y0 = Math.min(Math.floor((y - dy) * invH), ny - 2);
        const ty = (y - dy - y0 * h) * invH;
        const y1 = Math.min(y0 + 1, ny - 2);
        const sx = 1 - tx;
        const sy = 1 - ty;
        const d0 = sx * sy;
        const d1 = tx * sy;
        const d2 = tx * ty;
        const d3 = sx * ty;
        const n0 = x0 * ny + y0;
        const n1 = x1 * ny + y0;
        const n2 = x1 * ny + y1;
        const n3 = x0 * ny + y1;

        if (toGrid) {
          const pv = vel[2 * i + comp];
          f[n0] += pv * d0; d[n0] += d0;
          f[n1] += pv * d1; d[n1] += d1;
          f[n2] += pv * d2; d[n2] += d2;
          f[n3] += pv * d3; d[n3] += d3;
        } else {
          const v0 = type[n0] !== AIR || type[n0 - offset] !== AIR ? d0 : 0;
          const v1 = type[n1] !== AIR || type[n1 - offset] !== AIR ? d1 : 0;
          const v2 = type[n2] !== AIR || type[n2 - offset] !== AIR ? d2 : 0;
          const v3 = type[n3] !== AIR || type[n3 - offset] !== AIR ? d3 : 0;
          const sum = v0 + v1 + v2 + v3;
          if (sum > 0) {
            const pic = (v0 * f[n0] + v1 * f[n1] + v2 * f[n2] + v3 * f[n3]) / sum;
            const corr = (v0 * (f[n0] - prev[n0]) + v1 * (f[n1] - prev[n1])
              + v2 * (f[n2] - prev[n2]) + v3 * (f[n3] - prev[n3])) / sum;
            const flip = vel[2 * i + comp] + corr;
            vel[2 * i + comp] = (1 - FLIP_RATIO) * pic + FLIP_RATIO * flip;
          }
        }
      }

      if (toGrid) {
        for (let c = 0; c < f.length; c++) if (d[c] > 0) f[c] /= d[c];
      }
    }

    if (toGrid) {
      const { u, v, prevU, prevV } = this;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          const c = i * ny + j;
          const solid = type[c] === SOLID;
          if (solid || (i > 0 && type[c - ny] === SOLID)) u[c] = prevU[c];
          if (solid || (j > 0 && type[c - 1] === SOLID)) v[c] = prevV[c];
        }
      }
    }
  }

  // Gauss-Seidel pressure projection with drift compensation.
  solve(iters, dt) {
    const { u, v, s, type, density, nx, ny } = this;
    const drift = DRIFT_K * this.h / dt;
    this.prevU.set(u);
    this.prevV.set(v);
    for (let iter = 0; iter < iters; iter++) {
      for (let i = 1; i < nx - 1; i++) {
        for (let j = 1; j < ny - 1; j++) {
          const c = i * ny + j;
          if (type[c] !== FLUID) continue;
          const left = c - ny;
          const right = c + ny;
          const top = c - 1;
          const bottom = c + 1;
          const sum = s[left] + s[right] + s[top] + s[bottom];
          if (sum === 0) continue;
          let div = u[right] - u[c] + v[bottom] - v[c];
          const compression = density[c] - REST_DENSITY;
          if (compression > 0) div -= drift * compression;
          const p = -div / sum * OVER_RELAX;
          u[c] -= s[left] * p;
          u[right] += s[right] * p;
          v[c] -= s[top] * p;
          v[bottom] += s[bottom] * p;
        }
      }
    }
  }

  damp(factor) {
    const { vel } = this;
    for (let k = 0, n = 2 * this.count; k < n; k++) vel[k] *= factor;
  }

  measure() {
    const { vel, count } = this;
    let sum = 0;
    let max2 = 0;
    for (let i = 0; i < count; i++) {
      const sp2 = vel[2 * i] * vel[2 * i] + vel[2 * i + 1] * vel[2 * i + 1];
      sum += Math.sqrt(sp2);
      if (sp2 > max2) max2 = sp2;
    }
    this.meanSpeed = count ? sum / count : 0;
    // Liquid volume in cells, each weighted by how full it is against the
    // pool's own interior density, so sparse splash cells barely count.
    let dsum = 0;
    let dn = 0;
    const { density, type, ny } = this;
    for (let c = ny; c < type.length - ny; c++) {
      if (type[c] !== FLUID || type[c - 1] !== FLUID || type[c + 1] !== FLUID) continue;
      dsum += density[c];
      dn++;
    }
    this.meanDensity = dn ? dsum / dn : 0;
    const full = 1 / Math.max(this.meanDensity, 0.5 * REST_DENSITY);
    let volume = 0;
    for (let c = ny; c < type.length - ny; c++) {
      if (type[c] === FLUID) volume += Math.min(1, density[c] * full);
    }
    this.volumeCells = volume;
    this.maxSpeed = Math.sqrt(max2);
  }
}

function pack([r, g, b]) {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export class FluidEngine {
  // canvas/ctx: an OffscreenCanvas or HTMLCanvasElement and its 2D context.
  // requestFrame: rAF or a timer stand-in. onStats: debug readout callback.
  constructor(canvas, ctx, requestFrame, onStats) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.requestFrame = requestFrame;
    this.onStats = onStats;
    this.sim = null;
    this.palette = new Uint32Array(SHADES);
    this.visible = true;
    this.running = false;
    this.gen = 0;
    this.bias = 0;
    this.tier = 0;
  }

  setColors({ fluid, hi }) {
    for (let k = 0; k < SHADES; k++) {
      const t = k / (SHADES - 1);
      this.palette[k] = pack(fluid.map((c, n) => Math.round(c + (hi[n] - c) * t)));
    }
    if (this.sim && !this.running) this.render();
  }

  setVisible(visible) {
    this.visible = visible;
    if (visible) this.start();
    else this.stop();
  }

  // cfg: { cols, rows, pitch, width, height, floor, reducedMotion, debug, fillSeconds? }
  configure(cfg) {
    const fill = cfg.reducedMotion ? 1 : this.sim ? this.fill() : 0;
    this.stop();
    this.cfg = cfg;

    this.canvas.width = cfg.cols;
    this.canvas.height = cfg.rows;
    this.image = this.ctx.createImageData(cfg.cols, cfg.rows);
    this.pixels = new Uint32Array(this.image.data.buffer);
    this.dens = new Float32Array(cfg.cols * cfg.rows);
    this.fast = new Float32Array(cfg.cols * cfg.rows);

    this.spoutY = cfg.floor * (1 - SPOUT_RISE);
    this.depth = cfg.floor - this.spoutY;
    this.areaRate = cfg.width * this.depth / (cfg.fillSeconds || FILL_SECONDS);
    this.speed = this.baseSpeed = Math.min(Math.max(0.5 * cfg.width, 250), 900);
    this.opening = this.areaRate / this.baseSpeed;

    this.build(Math.max(levelFor(fill), this.bias));
    this.poured = 0;
    this.seed(fill * this.target);
    this.emitting = fill < 1;

    this.time = 0;
    this.acc = 0;
    this.emitAcc = 0;
    this.calm = 0;
    this.idle = 0;
    this.pending = 0;
    this.speedEma = 0;
    this.msEma = 0;
    this.slow = 0;
    this.quick = 0;
    this.steps = 0;
    this.sleeping = false;
    this.ptr = null;

    this.render();
    this.report();
    this.start();
  }

  // Share of the target filled, measured from the grid rather than poured
  // volume: a deep FLIP pool compresses, so poured volume overstates it.
  fill() {
    const sim = this.sim;
    const cells = sim.volumeCells ?? this.poured / (sim.h * sim.h);
    return Math.min(1, cells * sim.h * sim.h / this.target);
  }

  build(level) {
    const { width, floor } = this.cfg;
    const h = CELL_SIZES[level] * Math.max(1, Math.sqrt(width * floor / BASE_AREA));
    const target = Math.ceil(width / h) * h * this.depth;
    // Headroom for the pool compressing under its own weight.
    const capacity = Math.ceil(2 * target / (h * h / PPC)) + 1024;
    this.sim = new Flip(width, floor, h, capacity);
    this.level = level;
    this.target = (this.sim.nx - 2) * h * this.depth;
  }

  // Lays a resting hex-packed pool of the given area on the floor.
  seed(area) {
    const sim = this.sim;
    const { h, r, nx, ny } = sim;
    const dy = Math.sqrt(3) * r;
    const right = (nx - 1) * h - r;
    for (let row = 0; this.poured < area; row++) {
      const y = (ny - 1) * h - r - row * dy;
      if (y < h + r) break;
      for (let x = h + r + (row % 2) * r; x <= right && this.poured < area; x += 2 * r) {
        if (!sim.add(x, y, 0, 0)) return;
        // A still pool (reduced motion) keeps the lattice spacing; a running
        // one relaxes to SETTLED_DENSITY, a little looser.
        this.poured += this.cfg.reducedMotion ? sim.area : h * h / SETTLED_DENSITY;
      }
    }
  }

  start() {
    if (this.running || !this.visible || !this.sim) return;
    if (this.cfg.reducedMotion || this.sleeping) return;
    this.running = true;
    this.last = null;
    const gen = ++this.gen;
    const loop = now => {
      if (gen !== this.gen) return;
      this.requestFrame(loop);
      this.tick(now);
    };
    this.requestFrame(loop);
  }

  // Removes a disc of liquid around viewport point (x, y); the spout then
  // tops the pool back up.
  removeAt(x, y) {
    if (!this.sim || this.cfg.reducedMotion) return;
    const sim = this.sim;
    const R = Math.max(REMOVE_RADIUS, 6 * sim.h);
    const R2 = R * R;
    const cx = x + sim.ox;
    const cy = y + sim.oy;
    const { pos } = sim;
    let removed = 0;
    for (let i = sim.count - 1; i >= 0; i--) {
      const dx = pos[2 * i] - cx;
      const dy = pos[2 * i + 1] - cy;
      if (dx * dx + dy * dy > R2) continue;
      sim.remove(i);
      removed++;
    }
    if (!removed) return;
    // Refresh the fill measure now so the spout doesn't see a stale full pool.
    sim.transfer(true);
    sim.updateDensity();
    sim.measure();
    this.emitting = this.fill() < 1;
    this.wake();
    this.render();
  }

  // Pointer moved to viewport point (x, y) at velocity (vx, vy) px/s.
  pointer(x, y, vx, vy) {
    if (!this.sim || this.cfg.reducedMotion) return;
    this.ptr = { x, y, vx, vy, age: 0 };
    if (this.sleeping && this.stir(true)) this.wake();
  }

  wake() {
    this.idle = 0;
    this.calm = 0;
    if (this.sleeping) {
      this.sleeping = false;
      this.start();
    }
  }

  // Drags liquid near the pointer along with it. With probe set, only
  // reports whether any liquid is in reach.
  stir(probe = false) {
    const p = this.ptr;
    if (!p || p.age > POINTER_STEPS) return false;
    if (!probe) p.age++;
    const sim = this.sim;
    const R = Math.max(STIR_RADIUS, 2 * sim.h);
    const R2 = R * R;
    const cx = p.x + sim.ox;
    const cy = p.y + sim.oy;
    const { pos, vel, count } = sim;
    let hit = false;
    for (let i = 0; i < count; i++) {
      const dx = pos[2 * i] - cx;
      const dy = pos[2 * i + 1] - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > R2) continue;
      if (probe) return true;
      hit = true;
      const f = 1 - Math.sqrt(d2) / R;
      const w = f * f * STIR_STRENGTH;
      vel[2 * i] += (p.vx - vel[2 * i]) * w;
      vel[2 * i + 1] += (p.vy - vel[2 * i + 1]) * w;
    }
    // Stirring restarts the settle countdown and its damping ramp.
    if (hit) {
      this.idle = 0;
      this.calm = 0;
    }
    return hit;
  }

  stop() {
    this.running = false;
    this.gen++;
  }

  tick(now) {
    if (this.last == null) {
      this.last = now;
      return;
    }
    this.acc += Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    if (this.acc < STEP) return;
    for (let n = 0; this.acc >= STEP && n < MAX_STEPS_PER_FRAME && this.running; n++) {
      this.step();
      this.acc -= STEP;
    }
    if (this.acc > STEP) this.acc = 0;
    this.render();
  }

  step() {
    const t0 = performance.now();
    const q = QUALITY[this.tier];
    this.time += STEP;
    this.emit(STEP);

    const sim = this.sim;
    const sub = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(sim.maxSpeed * STEP / sim.h)));
    for (let k = 0; k < sub; k++) sim.simulate(STEP / sub, q.pressure, q.separate);
    this.stir();
    if (this.emitting) this.nozzle();
    else sim.damp(1 - SETTLE_DAMPING * Math.min(1, this.idle / SETTLE_RAMP_STEPS));
    sim.measure();

    this.adapt(performance.now() - t0);
    this.coarsen();
    this.settle();
    if (++this.steps % 30 === 0) this.report();
  }

  emit(dt) {
    if (!this.emitting) return;
    const sim = this.sim;
    const remain = (1 - this.fill()) * this.target;
    if (remain <= 0) {
      this.emitting = false;
      return;
    }
    const t = this.time;
    const wobble = 1 + 0.18 * Math.sin(t * 0.9) + 0.08 * Math.sin(t * 2.3 + 1);
    const taper = Math.max(0.2, Math.min(1, remain / (this.areaRate * TAPER_SECONDS)));
    this.speed = this.baseSpeed * (1 + 0.06 * Math.sin(t * 0.6)) * (0.6 + 0.4 * taper);
    this.emitAcc += this.areaRate * wobble * taper * dt;

    const xEdge = (sim.nx - 1) * sim.h - sim.r;
    const yMid = this.spoutY + sim.oy;
    while (this.emitAcc >= sim.area) {
      const x = xEdge - Math.random() * this.speed * dt;
      const y = yMid + (Math.random() - 0.5) * this.opening;
      if (!sim.add(x, y, -this.speed, 0)) break;
      this.emitAcc -= sim.area;
    }
  }

  // Holds particles in the spout mouth at the jet velocity, so the stream
  // leaves the edge as a clean arc instead of dribbling.
  nozzle() {
    const sim = this.sim;
    const { pos, vel, count } = sim;
    const x0 = (sim.nx - 1) * sim.h - 1.5 * sim.h;
    const half = 0.5 * this.opening + sim.r;
    const yMid = this.spoutY + sim.oy;
    for (let i = 0; i < count; i++) {
      if (pos[2 * i] < x0 || Math.abs(pos[2 * i + 1] - yMid) > half) continue;
      vel[2 * i] = -this.speed;
      vel[2 * i + 1] = 0;
    }
  }

  adapt(ms) {
    this.msEma = this.msEma ? this.msEma * 0.95 + ms * 0.05 : ms;
    if (this.msEma > STEP_BUDGET_MS) {
      if (++this.slow > 60) {
        this.slow = 0;
        if (this.tier < QUALITY.length - 1) this.tier++;
        else if (this.bias < CELL_SIZES.length - 1) this.bias++;
      }
    } else {
      this.slow = 0;
    }
    if (this.msEma < STEP_BUDGET_MS * 0.4 && this.tier > 0) {
      if (++this.quick > 300) {
        this.quick = 0;
        this.tier--;
      }
    } else {
      this.quick = 0;
    }
  }

  // Moves to a coarser grid once the pool passes a fill threshold, waiting
  // (briefly) for a moment when the liquid is calmer than usual.
  coarsen() {
    const sim = this.sim;
    this.speedEma = this.speedEma ? this.speedEma * 0.98 + sim.meanSpeed * 0.02 : sim.meanSpeed;
    const want = Math.min(CELL_SIZES.length - 1,
      Math.max(levelFor(this.fill()), this.bias));
    if (want <= this.level) return;
    if (sim.meanSpeed > this.speedEma && ++this.pending < 120) return;
    this.pending = 0;
    this.regrid(want);
  }

  // Rebuilds the grid at a coarser level, thinning particles per new cell
  // so the represented area holds and each cell keeps its momentum.
  regrid(level) {
    const old = this.sim;
    this.build(level);
    const sim = this.sim;
    const ratio = old.area / sim.area;
    const shiftX = sim.ox - old.ox;
    const shiftY = sim.oy - old.oy;
    const cells = sim.nx * sim.ny;
    const n = old.count;

    const cellOf = new Int32Array(n);
    const start = new Int32Array(cells + 1);
    for (let i = 0; i < n; i++) {
      const xi = Math.min(Math.max(Math.floor((old.pos[2 * i] + shiftX) * sim.invH), 0), sim.nx - 1);
      const yi = Math.min(Math.max(Math.floor((old.pos[2 * i + 1] + shiftY) * sim.invH), 0), sim.ny - 1);
      cellOf[i] = xi * sim.ny + yi;
      start[cellOf[i] + 1]++;
    }
    for (let c = 0; c < cells; c++) start[c + 1] += start[c];
    const fillAt = start.slice(0, cells);
    const ids = new Int32Array(n);
    for (let i = 0; i < n; i++) ids[fillAt[cellOf[i]]++] = i;

    let carry = 0;
    for (let c = 0; c < cells; c++) {
      const a = start[c];
      const k = start[c + 1] - a;
      if (k === 0) continue;
      let vx = 0;
      let vy = 0;
      for (let m = a; m < a + k; m++) {
        vx += old.vel[2 * ids[m]];
        vy += old.vel[2 * ids[m] + 1];
      }
      vx /= k;
      vy /= k;
      const want = k * ratio + carry;
      const keep = Math.floor(want);
      carry = want - keep;
      for (let m = 0; m < keep; m++) {
        const id = ids[a + Math.floor((m + 0.5) * k / keep)];
        sim.add(old.pos[2 * id] + shiftX, old.pos[2 * id + 1] + shiftY, vx, vy);
      }
    }
    sim.collide();
    sim.transfer(true);
    sim.updateDensity();
    sim.measure();
  }

  // Once the pour has stopped and the pool is still, stop stepping entirely.
  settle() {
    if (this.emitting) return;
    this.idle++;
    this.calm = this.sim.meanSpeed < 8 ? this.calm + 1 : 0;
    if (this.calm > 120 || this.idle > 60 * 20) {
      this.sleeping = true;
      this.stop();
      this.report();
    }
  }

  report() {
    if (this.cfg.debug == null || !this.onStats) return;
    this.onStats({
      cell: this.sim.h,
      fill: this.fill(),
      ms: this.msEma,
      density: this.sim.meanDensity || 0,
      speed: this.sim.meanSpeed,
      particles: this.sim.count,
      sleeping: this.sleeping || !!this.cfg.reducedMotion,
      tier: this.tier,
    });
  }

  render() {
    const { cols, rows, pitch } = this.cfg;
    const { dens, fast, pixels, palette } = this;
    const sim = this.sim;
    const { pos, vel, count, ox, oy } = sim;

    dens.fill(0);
    fast.fill(0);
    const R = Math.max(SPLAT * sim.r, pitch);
    const invR2 = 1 / (R * R);
    const norm = sim.area / (Math.PI * R * R / 3);
    const invP = 1 / pitch;

    // Particles near a side wall also splat a mirror image across it, so
    // the edge columns aren't left half-covered.
    const wallL = sim.h - ox;
    const wallR = (sim.nx - 1) * sim.h - ox;
    const splat = (x, y, speed) => {
      const c0 = Math.max(0, Math.ceil((x - R) * invP - 0.5));
      const c1 = Math.min(cols - 1, Math.floor((x + R) * invP - 0.5));
      const r0 = Math.max(0, Math.ceil((y - R) * invP - 0.5));
      const r1 = Math.min(rows - 1, Math.floor((y + R) * invP - 0.5));
      for (let row = r0; row <= r1; row++) {
        const dy = (row + 0.5) * pitch - y;
        const dy2 = dy * dy;
        const base = row * cols;
        for (let col = c0; col <= c1; col++) {
          const dx = (col + 0.5) * pitch - x;
          const q = 1 - (dx * dx + dy2) * invR2;
          if (q <= 0) continue;
          const w = q * q * norm;
          dens[base + col] += w;
          fast[base + col] += w * speed;
        }
      }
    };

    for (let i = 0; i < count; i++) {
      const x = pos[2 * i] - ox;
      const y = pos[2 * i + 1] - oy;
      const speed = Math.hypot(vel[2 * i], vel[2 * i + 1]);
      splat(x, y, speed);
      if (x - wallL < R) splat(2 * wallL - x, y, speed);
      if (wallR - x < R) splat(2 * wallR - x, y, speed);
    }

    const top = SHADES - 1;
    for (let k = 0; k < dens.length; k++) {
      const d = dens[k];
      // Fill single-cell gaps between liquid on both sides.
      const col = k % cols;
      const gap = d < SURFACE && !(
        (col > 0 && col < cols - 1 && dens[k - 1] >= SURFACE && dens[k + 1] >= SURFACE)
        || (k >= cols && k < dens.length - cols && dens[k - cols] >= SURFACE && dens[k + cols] >= SURFACE));
      if (gap) {
        pixels[k] = 0;
        continue;
      }
      const speed = d > 0 ? fast[k] / d : 0;
      let t = Math.min(1, Math.max(0, (speed - FAST_LO) / (FAST_HI - FAST_LO)));
      if (k >= cols && dens[k - cols] < SURFACE) t = Math.max(t, 0.7);
      pixels[k] = palette[Math.round(t * top)];
    }
    this.ctx.putImageData(this.image, 0, 0);
  }
}
