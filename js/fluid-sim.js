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

export const SPOUT_RISE = 0.8;    // spout height above the floor, share of floor depth
const FILL_SECONDS = 75;
const TAPER_SECONDS = 1;
const SETTLE_DAMPING = 0.015;     // per-step velocity loss once the pour stops
const SETTLE_RAMP_STEPS = 120;

// Pointer interaction, in CSS px. The radius is at least a couple of cells.
const REMOVE_RADIUS = 140;
const STIR_RADIUS = 56;
const STIR_STRENGTH = 0.35;       // share of pointer velocity blended in per step
const POINTER_STEPS = 6;          // steps a pointer move keeps stirring

// Stirring (pointer or splash) churns up foam and spray from the water it
// moves, more for faster strokes, and drags bubbles in under the pointer.
const STIR_FOAM = 0.35;           // foam chance per touched particle per step, at full pull and speed
const STIR_FOAM_SPEED = 900;      // px/s stroke speed for the full foam rate
const STIR_FOAM_PER_STEP = 40;
const STIR_SPRAY = 220;           // px/s random kick given to churned-up foam
const STIR_BUBBLES = 0.5;         // bubbles dragged in per step at full stroke speed

// A splash releases bubbles from a set of points, each after its own delay,
// wherever there's water: flip dots flipping underwater letting out air.
// The water isn't moved.
const SPLASH_BUBBLE_SHARE = 0.25; // share of points that release a bubble

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

// Foam is thrown off by fast water and floats up to the surface; bubbles
// rise from the floor and pop into foam at the surface. Both are drawn in
// display cells: foam on top of the water, bubbles on the froth layer.
const FOAM_MAX = 2500;
const FOAM_SPEED = 450;           // px/s above which water throws off foam
const FOAM_RATE = 2;              // spawn chance per second at twice FOAM_SPEED
const FOAM_PER_STEP = 30;
const FOAM_LIFE_MIN = 1.2;        // s
const FOAM_LIFE_MAX = 3.5;
const FOAM_FADE = 0.6;            // s of fade-out at the end of a foam's life
const FOAM_RISE = 70;             // px/s drift up through the water
const FOAM_WEIGHT = 0.55;         // foam shade added per particle
const SPRAY_MAX_FALL = 600;       // px/s
const BUBBLE_MAX = 300;
const BUBBLE_RATE = 2.5;          // per second per 1000px of wet floor
const BUBBLE_RISE_MIN = 60;       // px/s
const BUBBLE_RISE_MAX = 140;
const BUBBLE_WOBBLE = 4;          // px
const BUBBLE_DRIFT = 0.5;         // share of the current a bubble follows
const BUBBLE_WEIGHT = 0.6;
const IDLE_FX_MS = 1000 / 30;     // effects frame rate once the water sleeps

// The surface is froth: its top cell is always foam, the cell under it
// patchy. The pattern reshuffles a few times a second while the water moves.
// Froth and bubbles go on their own layer over the page content when there
// is one, with alpha rising with the foam shade.
const FROTH_TOP = 0.55;           // lowest foam shade on the top cell
const FROTH_UNDER = 0.45;         // share of second-row cells that froth
const FROTH_RATE = 3;             // reshuffles per second

// A soft glow wanders through the water (it used to sit behind the hero),
// mixed in up to GLOW_ALPHA at its center.
const GLOW_PERIOD = 18;           // s per loop
const GLOW_ALPHA = 0.13;
const GLOW_FADE = 0.7;            // glow is gone at this share of the radius
const GLOW_LEVELS = 8;

// Drain mode: the spout stops and a drain in the bottom-left corner pulls
// the pool out over about DRAIN_SECONDS.
const DRAIN_SECONDS = 35;
const DRAIN_WIDTH = 60;           // px, at least 3 cells
const DRAIN_PULL_RADIUS = 160;    // px, at least 8 cells
const DRAIN_PULL_SPEED = 220;     // px/s toward the drain
const DRAIN_PULL = 0.04;          // share blended in per step
const FILL_STEPS = 5;             // fill is reported in 20% steps

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

  // Bilinear grid velocity component at sim-space (x, y); (dx, dy) is the
  // component's offset from the cell corner.
  sample(f, x, y, dx, dy) {
    const { h, invH, nx, ny } = this;
    x = Math.min(Math.max(x, h), (nx - 1) * h);
    y = Math.min(Math.max(y, h), (ny - 1) * h);
    const x0 = Math.min(Math.floor((x - dx) * invH), nx - 2);
    const tx = (x - dx - x0 * h) * invH;
    const x1 = Math.min(x0 + 1, nx - 2);
    const y0 = Math.min(Math.floor((y - dy) * invH), ny - 2);
    const ty = (y - dy - y0 * h) * invH;
    const y1 = Math.min(y0 + 1, ny - 2);
    const sx = 1 - tx;
    const sy = 1 - ty;
    return sx * sy * f[x0 * ny + y0] + tx * sy * f[x1 * ny + y0]
      + tx * ty * f[x1 * ny + y1] + sx * ty * f[x0 * ny + y1];
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

// Cheap repeatable hash of a cell and a seed, in [0, 1).
function noise(k, seed) {
  let n = Math.imul(k ^ Math.imul(seed, 0x9e3779b1), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function pack([r, g, b], a = 255) {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export class FluidEngine {
  // layers: [{ role, canvas, ctx }] with role 'water' and, optionally,
  // 'tint' (the tint mask) and 'froth' (froth and bubbles over the content);
  // each canvas is an OffscreenCanvas or HTMLCanvasElement.
  // requestFrame: rAF or a timer stand-in. notify: receives
  // { type: 'stats', stats } (debug only) and { type: 'fill', level }.
  constructor(layers, requestFrame, notify) {
    this.layers = layers;
    this.layer = Object.fromEntries(layers.map(l => [l.role, l]));
    this.notify = notify;
    this.draining = false;
    this.tintColor = 0;
    this.requestFrame = requestFrame;
    this.sim = null;
    this.palette = new Uint32Array(SHADES);
    this.foamPalette = new Uint32Array(SHADES);
    this.frothPalette = new Uint32Array(SHADES);
    // Water then foam shades, each at every glow level.
    this.lit = new Uint32Array(2 * SHADES * GLOW_LEVELS);
    this.visible = true;
    this.running = false;
    this.gen = 0;
    this.bias = 0;
    this.tier = 0;
    this.pendingBubbles = [];
  }

  setColors({ fluid, hi, tint, foam, froth, glow }) {
    if (tint) this.tintColor = pack(tint);
    const shades = [];
    for (let k = 0; k < SHADES; k++) {
      const t = k / (SHADES - 1);
      shades[k] = fluid.map((c, n) => Math.round(c + (hi[n] - c) * t));
      // Foam shades run from just past the highlight up to the foam color.
      const f = (k + 1) / SHADES;
      shades[SHADES + k] = (foam || hi).map((c, n) => Math.round(hi[n] + (c - hi[n]) * f));
      this.palette[k] = pack(shades[k]);
      this.foamPalette[k] = pack(shades[SHADES + k]);
      this.frothPalette[k] = pack(froth || foam || hi, Math.round(255 * f));
    }
    shades.forEach((rgb, s) => {
      for (let g = 0; g < GLOW_LEVELS; g++) {
        const a = glow ? g / (GLOW_LEVELS - 1) * GLOW_ALPHA : 0;
        this.lit[s * GLOW_LEVELS + g] = pack(rgb.map((c, n) => Math.round(c + ((glow?.[n] ?? c) - c) * a)));
      }
    });
    if (this.sim) {
      this.renderWater();
      this.compose(true);
    }
  }

  setVisible(visible) {
    this.visible = visible;
    if (visible) this.start();
    else this.stop();
  }

  // cfg: { cols, rows, pitch, width, height, floor, reducedMotion, debug,
  //        draining, initialFill?, fillSeconds? }
  configure(cfg) {
    this.draining = !!cfg.draining;
    const fill = cfg.reducedMotion ? (this.draining ? 0 : 1)
      : this.sim ? this.fill() : Math.min(1, Math.max(0, cfg.initialFill || 0));
    this.stop();
    this.cfg = cfg;

    for (const layer of this.layers) {
      layer.canvas.width = cfg.cols;
      layer.canvas.height = cfg.rows;
      layer.image = layer.ctx.createImageData(cfg.cols, cfg.rows);
      layer.pixels = new Uint32Array(layer.image.data.buffer);
    }
    this.pixels = this.layer.water.pixels;
    this.tintPixels = this.layer.tint?.pixels;
    this.frothPixels = this.layer.froth?.pixels;
    this.dens = new Float32Array(cfg.cols * cfg.rows);
    this.fast = new Float32Array(cfg.cols * cfg.rows);
    // Per display cell. shade: 0 for no water, else 1 + a water shade.
    // froth: 0 for none, else 1 + a foam shade drawn over the water.
    this.shade = new Uint8Array(cfg.cols * cfg.rows);
    this.froth = new Uint8Array(cfg.cols * cfg.rows);
    this.bubbleBuf = new Float32Array(cfg.cols * cfg.rows);
    this.hadBubbles = false;
    this.glowX = new Float32Array(cfg.cols);
    this.glowY = new Float32Array(cfg.rows);
    this.foamBuf = new Float32Array(cfg.cols * cfg.rows);
    this.foam = new Float32Array(FOAM_MAX * 6);
    this.foamCount = 0;
    this.bubbles = new Float32Array(BUBBLE_MAX * 5);
    this.bubbleCount = 0;
    this.bubbleAcc = 0;
    this.pendingBubbles = [];
    this.fxTime = 0;

    this.spoutY = cfg.floor * (1 - SPOUT_RISE);
    this.depth = cfg.floor - this.spoutY;
    this.areaRate = cfg.width * this.depth / (cfg.fillSeconds || FILL_SECONDS);
    this.speed = this.baseSpeed = Math.min(Math.max(0.5 * cfg.width, 250), 900);
    this.opening = this.areaRate / this.baseSpeed;

    this.build(Math.max(levelFor(fill), this.bias));
    this.poured = 0;
    this.seed(fill * this.target);
    this.emitting = !this.draining && fill < 1;
    this.drainAcc = 0;
    this.savedLevel = Math.round(fill * FILL_STEPS) / FILL_STEPS;

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

    this.renderWater();
    this.compose(true);
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
    if (this.cfg.reducedMotion) return;
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
    this.emitting = !this.draining && this.fill() < 1;
    this.wake();
    this.renderWater();
    this.compose(true);
  }

  // Pointer moved to viewport point (x, y) at velocity (vx, vy) px/s.
  pointer(x, y, vx, vy) {
    if (!this.sim || this.cfg.reducedMotion) return;
    this.ptr = { x, y, vx, vy, age: 0 };
    if (this.sleeping && this.stir(true)) this.wake();
  }

  // Drain mode stops the spout and opens the drain; off restarts the spout.
  setDraining(on) {
    if (!this.sim) return;
    this.draining = on;
    this.emitting = !on && this.fill() < 1;
    this.wake();
  }

  // Schedules bubbles from points [{ x, y, t }]: viewport px, t = delay in ms.
  splash(points) {
    if (!this.sim || this.cfg.reducedMotion) return;
    const now = this.fxTime;
    for (const p of points) {
      if (Math.random() < SPLASH_BUBBLE_SHARE) {
        this.pendingBubbles.push({ x: p.x, y: p.y, at: now + p.t / 1000 });
      }
    }
    // Soonest last, so release() can pop them.
    this.pendingBubbles.sort((a, b) => b.at - a.at);
  }

  // Lets out the scheduled splash bubbles that are due, where there's water.
  // Runs with the effects, so it works while the water sleeps.
  releaseBubbles() {
    const q = this.pendingBubbles;
    while (q.length && q[q.length - 1].at <= this.fxTime) {
      const p = q.pop();
      if (this.wet(p.x, p.y)) this.addBubble(p.x, p.y);
    }
  }

  wake() {
    this.idle = 0;
    this.calm = 0;
    if (this.sleeping) {
      this.sleeping = false;
      this.acc = 0;
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
    const { pos, vel, count, ox, oy } = sim;
    const churn = STIR_FOAM * Math.min(1, Math.hypot(p.vx, p.vy) / STIR_FOAM_SPEED);
    let foamBudget = STIR_FOAM_PER_STEP;
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
      if (foamBudget > 0 && Math.random() < churn * Math.min(1, w / STIR_STRENGTH)) {
        foamBudget--;
        const life = FOAM_LIFE_MIN + Math.random() * (FOAM_LIFE_MAX - FOAM_LIFE_MIN);
        this.addFoam(pos[2 * i] - ox, pos[2 * i + 1] - oy,
          vel[2 * i] + (Math.random() - 0.5) * STIR_SPRAY,
          vel[2 * i + 1] - Math.random() * STIR_SPRAY, life);
      }
    }
    if (hit) {
      // Drag a bubble or two in under the stroke.
      this.bubbleChurn = (this.bubbleChurn || 0) + STIR_BUBBLES * churn / STIR_FOAM;
      while (this.bubbleChurn >= 1) {
        this.bubbleChurn--;
        const bx = p.x + (Math.random() - 0.5) * R;
        const by = p.y + Math.random() * 0.5 * R;
        if (this.wet(bx, by)) this.addBubble(bx, by);
      }
      // Stirring restarts the settle countdown and its damping ramp.
      this.idle = 0;
      this.calm = 0;
    }
    return hit;
  }

  stop() {
    this.running = false;
    this.gen++;
  }

  // Steps the physics while awake; foam and bubbles keep animating after
  // the water sleeps, at a lower frame rate and without physics.
  tick(now) {
    if (this.last == null) {
      this.last = this.lastFx = now;
      return;
    }
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    let stepped = false;
    if (!this.sleeping) {
      this.acc += dt;
      for (let n = 0; this.acc >= STEP && n < MAX_STEPS_PER_FRAME && this.running; n++) {
        this.step();
        this.acc -= STEP;
        stepped = true;
      }
      if (this.acc > STEP) this.acc = 0;
    }
    if (!stepped && this.sleeping && now - this.lastFx < IDLE_FX_MS) return;
    const fxDt = Math.min((now - this.lastFx) / 1000, 0.1);
    this.lastFx = now;
    if (stepped) this.renderWater();
    this.updateFx(fxDt);
    this.compose(stepped);
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
    if (this.draining) this.drain();
    this.spawnFoam();
    sim.measure();

    this.adapt(performance.now() - t0);
    this.coarsen();
    this.settle();
    if (++this.steps % 30 === 0) {
      this.report();
      this.saveFill();
    }
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
    if (this.emitting || (this.draining && this.fill() > 0.03)) return;
    this.idle++;
    this.calm = this.sim.meanSpeed < 8 ? this.calm + 1 : 0;
    if (this.calm > 120 || this.idle > 60 * 20) {
      this.sleeping = true;
      this.report();
      this.saveFill();
    }
  }

  addBubble(x, y) {
    if (this.bubbleCount >= BUBBLE_MAX) return;
    const b = this.bubbles;
    const k = 5 * this.bubbleCount++;
    b[k] = x;
    b[k + 1] = y;
    b[k + 2] = BUBBLE_RISE_MIN + Math.random() * (BUBBLE_RISE_MAX - BUBBLE_RISE_MIN);
    b[k + 3] = Math.random() * Math.PI * 2;
    b[k + 4] = Math.random() < 0.25 ? 2 : 1;
  }

  addFoam(x, y, vx, vy, life) {
    if (this.foamCount >= FOAM_MAX) return;
    const k = 6 * this.foamCount++;
    const f = this.foam;
    f[k] = x;
    f[k + 1] = y;
    f[k + 2] = vx;
    f[k + 3] = vy;
    f[k + 4] = life;
  }

  // Fast water throws off foam, more the faster it moves. Starts at a random
  // particle so no part of the pool is favored when the budget runs out.
  spawnFoam() {
    const sim = this.sim;
    const { pos, vel, count, ox, oy } = sim;
    if (!count) return;
    const min2 = FOAM_SPEED * FOAM_SPEED;
    const first = Math.floor(Math.random() * count);
    let budget = FOAM_PER_STEP;
    for (let n = 0; n < count && budget > 0; n++) {
      const i = (first + n) % count;
      const vx = vel[2 * i];
      const vy = vel[2 * i + 1];
      const s2 = vx * vx + vy * vy;
      if (s2 < min2) continue;
      if (Math.random() > FOAM_RATE * STEP * (Math.sqrt(s2) / FOAM_SPEED - 1)) continue;
      const life = FOAM_LIFE_MIN + Math.random() * (FOAM_LIFE_MAX - FOAM_LIFE_MIN);
      this.addFoam(pos[2 * i] - ox, pos[2 * i + 1] - oy, vx, vy, life);
      budget--;
    }
  }

  // Display cell index at viewport point (x, y), or -1 off the canvas.
  cellAt(x, y) {
    const { cols, rows, pitch } = this.cfg;
    const col = Math.floor(x / pitch);
    const row = Math.floor(y / pitch);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return -1;
    return row * cols + col;
  }

  wet(x, y) {
    const k = this.cellAt(x, y);
    return k >= 0 && this.dens[k] >= SURFACE;
  }

  updateFx(dt) {
    const sim = this.sim;
    const { width, floor, pitch } = this.cfg;
    const live = !this.sleeping;
    const h2 = 0.5 * sim.h;
    this.fxTime += dt;
    this.releaseBubbles();

    const f = this.foam;
    for (let i = this.foamCount - 1; i >= 0; i--) {
      const k = 6 * i;
      f[k + 4] -= dt;
      if (f[k + 4] <= 0) {
        const last = 6 * --this.foamCount;
        f.copyWithin(k, last, last + 6);
        continue;
      }
      const x = f[k];
      const y = f[k + 1];
      if (this.wet(x, y)) {
        // Carried by the current while drifting up to the surface.
        f[k + 2] = live ? sim.sample(sim.u, x + sim.ox, y + sim.oy, 0, h2) : 0;
        f[k + 3] = (live ? sim.sample(sim.v, x + sim.ox, y + sim.oy, h2, 0) : 0) - FOAM_RISE;
      } else {
        // Spray: falls back under gravity.
        f[k + 2] *= 0.99;
        f[k + 3] = Math.min(f[k + 3] + GRAVITY * dt, SPRAY_MAX_FALL);
      }
      f[k] = Math.min(Math.max(x + f[k + 2] * dt, 0), width);
      f[k + 1] = Math.min(y + f[k + 3] * dt, floor);
    }

    const b = this.bubbles;
    const floorY = floor - 0.5 * pitch;
    this.bubbleAcc += BUBBLE_RATE * width / 1000 * dt;
    while (this.bubbleAcc >= 1) {
      this.bubbleAcc--;
      const x = Math.random() * width;
      if (this.wet(x, floorY)) this.addBubble(x, floorY);
    }
    for (let i = this.bubbleCount - 1; i >= 0; i--) {
      const k = 5 * i;
      let y = b[k + 1] - b[k + 2] * dt;
      if (live) {
        b[k] += BUBBLE_DRIFT * sim.sample(sim.u, b[k] + sim.ox, y + sim.oy, 0, h2) * dt;
        y += BUBBLE_DRIFT * sim.sample(sim.v, b[k] + sim.ox, y + sim.oy, h2, 0) * dt;
      }
      b[k + 1] = y;
      const x = b[k] + Math.sin(b[k + 3] + this.fxTime * 3) * BUBBLE_WOBBLE;
      if (!this.wet(x, y - b[k + 4] * pitch * 0.5)) {
        // Popped at the surface.
        for (let n = 0; n < 2; n++) {
          this.addFoam(x + (Math.random() - 0.5) * pitch, y, 0, 0, 0.8 + Math.random() * 0.8);
        }
        const last = 5 * --this.bubbleCount;
        b.copyWithin(k, last, last + 5);
      }
    }
  }

  // Colors the water with the wandering glow, draws foam over it and froth
  // and bubbles on the froth layer (or over the water without one), and
  // pushes the layers. The tint layer only changes with the water.
  compose(waterChanged) {
    const { cols, rows, pitch, width, height } = this.cfg;
    const { pixels, shade, froth, lit, glowX, glowY, foamBuf, foamPalette, foam, bubbles } = this;
    const { frothPixels, frothPalette, bubbleBuf } = this;

    const phase = this.fxTime * 2 * Math.PI / GLOW_PERIOD;
    const cx = width * (0.5 + 0.22 * Math.sin(phase));
    const cy = height * (0.4 + 0.18 * Math.sin(1.7 * phase + 1));
    const rx = 0.35 * width * GLOW_FADE;
    const ry = 0.3 * height * GLOW_FADE;
    for (let col = 0; col < cols; col++) glowX[col] = (((col + 0.5) * pitch - cx) / rx) ** 2;
    for (let row = 0; row < rows; row++) glowY[row] = (((row + 0.5) * pitch - cy) / ry) ** 2;
    const levels = GLOW_LEVELS - 1;
    for (let row = 0, k = 0; row < rows; row++) {
      const gy = glowY[row];
      for (let col = 0; col < cols; col++, k++) {
        const s = shade[k];
        const f = froth[k];
        if (frothPixels) frothPixels[k] = f ? frothPalette[f - 1] : 0;
        if (s === 0) {
          pixels[k] = 0;
          continue;
        }
        const e2 = glowX[col] + gy;
        const g = e2 < 1 ? Math.round((1 - Math.sqrt(e2)) * levels) : 0;
        pixels[k] = lit[(f && !frothPixels ? SHADES + f - 1 : s - 1) * GLOW_LEVELS + g];
      }
    }

    // Accumulate, paint, then clear only the touched cells.
    const marks = [];
    const bubbleMarks = frothPixels ? [] : marks;
    const bubbleSum = frothPixels ? bubbleBuf : foamBuf;
    const mark = (buf, list, k, w) => {
      if (k < 0) return;
      if (buf[k] === 0) list.push(k);
      buf[k] += w;
    };
    for (let i = 0; i < this.foamCount; i++) {
      const life = foam[6 * i + 4];
      mark(foamBuf, marks, this.cellAt(foam[6 * i], foam[6 * i + 1]),
        FOAM_WEIGHT * Math.min(1, life / FOAM_FADE));
    }
    for (let i = 0; i < this.bubbleCount; i++) {
      const k = 5 * i;
      const x = bubbles[k] + Math.sin(bubbles[k + 3] + this.fxTime * 3) * BUBBLE_WOBBLE;
      const y = bubbles[k + 1];
      mark(bubbleSum, bubbleMarks, this.cellAt(x, y), BUBBLE_WEIGHT);
      if (bubbles[k + 4] > 1) {
        mark(bubbleSum, bubbleMarks, this.cellAt(x + pitch, y), BUBBLE_WEIGHT);
        mark(bubbleSum, bubbleMarks, this.cellAt(x, y - pitch), BUBBLE_WEIGHT);
        mark(bubbleSum, bubbleMarks, this.cellAt(x + pitch, y - pitch), BUBBLE_WEIGHT);
      }
    }
    const top = SHADES - 1;
    for (const k of marks) {
      pixels[k] = foamPalette[Math.min(top, Math.round(foamBuf[k] * top))];
      foamBuf[k] = 0;
    }
    if (frothPixels) {
      for (const k of bubbleMarks) {
        const level = Math.min(top, Math.round(bubbleBuf[k] * top));
        frothPixels[k] = frothPalette[Math.max(level, froth[k] - 1)];
        bubbleBuf[k] = 0;
      }
    }

    const { water, tint, froth: frothLayer } = this.layer;
    water.ctx.putImageData(water.image, 0, 0);
    if (waterChanged && tint) tint.ctx.putImageData(tint.image, 0, 0);
    // The froth layer only changes with the water or while bubbles move.
    if (frothLayer && (waterChanged || this.bubbleCount > 0 || this.hadBubbles)) {
      frothLayer.ctx.putImageData(frothLayer.image, 0, 0);
    }
    this.hadBubbles = this.bubbleCount > 0;
  }

  // Reports the fill, rounded to 20% steps, whenever that step changes.
  saveFill() {
    const level = Math.round(this.fill() * FILL_STEPS) / FILL_STEPS;
    if (level === this.savedLevel) return;
    this.savedLevel = level;
    this.notify?.({ type: 'fill', level });
  }

  // Pulls water toward the bottom-left corner and removes what reaches it,
  // no faster than DRAIN_SECONDS for a full pool.
  drain() {
    const sim = this.sim;
    const { floor } = this.cfg;
    const w = Math.max(DRAIN_WIDTH, 3 * sim.h);
    const reach = Math.max(DRAIN_PULL_RADIUS, 8 * sim.h);
    const reach2 = reach * reach;
    const cx = sim.ox;
    const cy = floor + sim.oy;
    const { pos, vel } = sim;

    const rate = this.target / DRAIN_SECONDS * STEP / sim.area;
    this.drainAcc += rate;
    for (let i = sim.count - 1; i >= 0; i--) {
      const dx = cx - pos[2 * i];
      const dy = cy - pos[2 * i + 1];
      const d2 = dx * dx + dy * dy;
      if (d2 > reach2) continue;
      if (-dx < w && dy < w && this.drainAcc >= 1) {
        sim.remove(i);
        this.drainAcc--;
        continue;
      }
      const d = Math.sqrt(d2) || 1;
      const f = 1 - d / reach;
      vel[2 * i] += (dx / d * DRAIN_PULL_SPEED - vel[2 * i]) * DRAIN_PULL * f;
      vel[2 * i + 1] += (dy / d * DRAIN_PULL_SPEED - vel[2 * i + 1]) * DRAIN_PULL * f;
    }
    // Don't bank removals while nothing is reaching the drain.
    this.drainAcc = Math.min(this.drainAcc, Math.max(4, 2 * rate));
  }

  report() {
    if (this.cfg.debug == null || !this.notify) return;
    this.notify({ type: 'stats', stats: {
      cell: this.sim.h,
      fill: this.fill(),
      ms: this.msEma,
      density: this.sim.meanDensity || 0,
      speed: this.sim.meanSpeed,
      particles: this.sim.count,
      sleeping: this.sleeping || !!this.cfg.reducedMotion,
      tier: this.tier,
    } });
  }

  // Splats the particles into display cells and picks each cell's shade
  // (this.shade) and tint; compose() colors them and puts them on screen.
  renderWater() {
    const { cols, rows, pitch } = this.cfg;
    const { dens, fast, shade, froth, tintPixels, tintColor } = this;
    const seed = Math.floor(this.time * FROTH_RATE);
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
        shade[k] = 0;
        froth[k] = 0;
        if (tintPixels) tintPixels[k] = 0;
        continue;
      }
      if (tintPixels) tintPixels[k] = tintColor;
      const speed = d > 0 ? fast[k] / d : 0;
      const t = Math.min(1, Math.max(0, (speed - FAST_LO) / (FAST_HI - FAST_LO)));
      shade[k] = 1 + Math.round(t * top);
      froth[k] = 0;
      if (k >= cols && dens[k - cols] < SURFACE) {
        const n = noise(k, seed);
        froth[k] = 1 + Math.round((FROTH_TOP + (1 - FROTH_TOP) * n) * top);
      } else if (k >= 2 * cols && dens[k - 2 * cols] < SURFACE) {
        const n = noise(k, seed);
        if (n < FROTH_UNDER) froth[k] = 1 + Math.round((0.15 + 0.4 * n / FROTH_UNDER) * top);
      }
    }
  }
}
