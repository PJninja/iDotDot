# WebGPU Compute Port

Status: All 7 phases done. **The CPU engine and the `World` abstraction have been removed** (see §CPU engine removal); the GPU backend is the only backend and WebGPU is required.
Scope: new `src/engine/gpu/` (shader + sim), `src/main.ts` (direct GPU bootstrap), `src/engine/collider.ts` (`forEachRect`), `AGENTS.md`. The original CPU engine was removed after Phase 4 (§CPU engine removal).

## Problem

The CPU path cannot run ~1M tiles all awake inside the 16.67 ms step budget. Bottleneck breakdown for the all-awake worst case (1920×1032 ≈ 2M cells, ~1M non-air):

1. **Wake halo (`Grid.wakeArea`)** — dominant. `Sand.WAKE_RADIUS=4` → 9×9=81-cell box; each successful `moveTo` fires two halos (dest + origin) ≈ 162 cell touches (a `wakeStamp` read + conditional write each). With ~1M movers/step that is ~100–160M array touches/step. It scales with *mover count*, and it is exactly the feature that makes the settled-world case fast — it backfires when everything is awake.
2. **Single-threaded JS dispatch** — 1M × virtual `update()` → `spendFallBudget` → `strideDown` (≤3 `ctx.get`) → `moveTo` (`isValid`+`isSolid`+`writeTypeAt`+2×`setTile`+`setValue`). ~50–150 ns/tile of call overhead → 50–150 ms/step.
3. `beginStep` memcpy (4×1 MB) — ~0.3–0.5 ms. Minor.
4. Renderer full redraw (1M tile iters + ~2M pixel writes) — ~2–6 ms. Minor.

The floor (scanning 1M tiles for `sleep`/`types`) alone is ~2–5 ms. CPU cannot fit 1M full updates in the budget.

## Goal

Port the simulation to a **WebGPU compute shader** that runs every tile in parallel each step, and render straight from the GPU grid texture. This eliminates bottlenecks #1 and #2 at once (no sleep/halo system, no per-tile JS) and reaches 1M–100M+ tiles at 60 fps. The CPU engine was kept as a fallback through Phase 4, then removed: every element would otherwise need its behavior written twice (TypeScript per-tile `update()` and WGSL).

WebGPU is a browser API (no npm dependency) — the zero-runtime-deps rule is preserved.

## Phased plan

The port is split into **7 phases**. Each phase is independently buildable and verifiable, builds on the previous one, and ends with a **done-when** gate. Phases 1–3 introduce no visible behavior change (Phase 2 renders a static all-air world; Phase 3 runs an identity compute pass); real behavior arrives in 4–5, interaction in 6, and robustness + docs in 7.

| # | Phase | Adds | Verifiable by |
|---|---|---|---|
| 1 | Backend abstraction *(superseded)* | `World` interface, `createCpuWorld`, backend selection — removed with the CPU engine | — |
| 2 | GPU bootstrap + static render | Async device init, all GPU resources, color/solid/uniform builders, render pass | Canvas renders (background) on a GPU world; unsupported browsers see a message |
| 3 | Compute pipeline + step loop | WGSL compute module (identity), fixed-timestep rAF loop, ping-pong | Dispatch runs each frame; ping-pong/step correct |
| 4 | Sand | `updateSand` (stride fall + claim + PRNG slide), `passable`/`claim`/`rand`/`pack` | Sand falls and piles correctly; conservation holds |
| 5 | Dirt | `updateDirt` (slope-aware friction) | Dirt piles/flows; conservation holds |
| 6 | Painting | batched `paint` via `writeBuffer` into the current grid buffer | Brush paints/erases on GPU world, incl. borders |
| 7 | Resize, colliders, docs | Resize rebuild, solid-mask rebuild, `AGENTS.md`, full validation | All edge cases pass; docs updated |

---

### Phase 1 — Backend abstraction (CPU-only) — superseded

**Superseded:** the `World` interface, `createCpuWorld`, `USE_WEBGPU` and backend selection were removed with the CPU engine. Original text: **Goal:** make `main.ts` backend-agnostic behind a minimal `World` interface, so a GPU world can be dropped in later without touching input/paint/resize wiring. No GPU code yet — pure refactor.

**Scope:**
- `src/settings.ts` — add `USE_WEBGPU: true` (auto-fallback when unavailable).
- `src/main.ts` — define a `World` type (`start`, `stop`, frame/render hook, `paint`, `resize`); extract the existing CPU wiring into `createCpuWorld(canvas, colliders, registry)`; add backend-selection logic that picks CPU for now (the GPU branch is a placeholder `throw` that Phase 2 fills). Selection becomes `async` in Phase 2, because adapter/device acquisition is async.

**Done when:**
- `npx tsc --noEmit` + `npm run build` clean.
- CPU path behaves identically to before (visual + `profile.bat` passes).
- `main.ts` input/paint/resize all go through the `World` interface.

**Notes:** Keep the existing `Simulation`/`Renderer` untouched; `createCpuWorld` just wraps them behind the interface.

---

### Phase 2 — GPU bootstrap + static render

**Goal:** create a `GpuSimulation` that initializes WebGPU, builds all resources, and renders the (static, all-air) grid to the canvas. **Status: done.** Proves the device + texture + render-pass pipeline end to end.

**Scope:**
- `src/engine/gpu/gpu-simulation.ts` (new) — async `GpuSimulation.create`: `requestAdapter` + `requestDevice` **before** `getContext('webgpu')` (a failure leaves the canvas untouched and throws so `main.ts` falls back); create `gridBufA/B` (storage buffers, `W*H` u32), `claimBuf`, `solidBuf` (rasterized from `ColliderManager.forEachRect`), `colorTex` (256×256 `rgba8unorm`, built from registry `getColor`), `uniformBuf`. Also `resize` (rebuilds all size-dependent resources) and a render-only rAF loop.
- `src/engine/gpu/shaders.ts` (new) — `RENDER_WGSL` only for now (full-screen triangle + fragment grid→color).
- `src/engine/collider.ts` — add `forEachRect` for solid-mask rasterization.
- `src/engine/gpu/webgpu.d.ts` — ambient declarations for the WebGPU parts missing from the bundled DOM lib (`GPUBufferUsage`/`GPUTextureUsage`/`GPUShaderStage`, `GPU.getPreferredCanvasFormat`, `GPUCanvasContext`).
- `src/main.ts` — GPU bootstrap (originally an async `createGpuWorld` selection branch).

**Done when:**
- `tsc`/build clean.
- In a WebGPU browser, the canvas renders the background color (all-air grid) via the `webgpu` context — no crash.
- With no `navigator.gpu` (or device failure), `main.ts` shows an "unsupported" message instead of the app.
- Color texture is correct (debug: temporarily seed a few typed cells and confirm colors match each element's `getColor`).

---

### Phase 3 — Compute pipeline + fixed-timestep loop

**Status: done.** **Goal:** run the compute dispatch each frame with an **identity** pass (tile copies to itself) inside the full fixed-timestep rAF loop + ping-pong. Proves dispatch + swap + step timing before any real behavior.

**Scope:**
- `src/engine/gpu/shaders.ts` — add `COMPUTE_WGSL` with the full thread structure but **identity** behavior (read `p`, write `pack(type, value, variant)` back to `P`). The compute bind group layout is explicit (an `auto` layout drops bindings the identity shader does not use). Include `passable`/`claim`/`rand`/`pack` helpers (stubs ok if unused).
- `src/engine/gpu/gpu-simulation.ts` — fixed-timestep rAF loop (16.67 ms step, max 5 steps/frame, drop backlog); per frame encode **one** command buffer: N×(`clearBuffer(claimBuf)` + `clearBuffer(writeBuf)` + a compute pass dispatching `ceil(W/16) × ceil(H/16)` workgroups) + render pass; submit once; ping-pong swap read/write; `step` counter in a separate dynamic-offset uniform (`stepBuf`, one 256-byte slot per step in the frame): all steps of a frame share one command buffer, so a plain uniform write would only expose its final value to every step.
- `start`/`stop` on `GpuSimulation`.

**Done when:**
- `tsc`/build clean.
- In-browser: the loop runs, dispatch executes each frame, ping-pong swaps correctly (verify by reading back a seeded pattern after N steps — identity should preserve it exactly), `step` increments.
- No GPU errors in console.

---

### Phase 4 — Sand

**Status: done.** **Goal:** implement sand falling in the shader. First real behavior.

**Scope:**
- `src/engine/gpu/shaders.ts` — implement `updateSand` (gravity stride fall via the `spendFallBudget`-equivalent, `passable`, `claim`, PRNG diagonal slide), wire into the `switch` on type.
- `src/engine/element.ts` — `Element.gravityQuantum` (default 0); `Sand`/`Dirt` expose their already-computed quantum (previously private), so the GPU tables come from the element classes.
- `src/engine/gpu/gpu-simulation.ts` — populate the uniform `gravity` table per type from `element.gravityQuantum`.
- **Whole fall budget per step:** `updateFall` loops (max 8 attempts) over stride-down / friction-gated diagonal-slide moves until the tile's fall budget is spent, like the removed CPU `spendFallBudget` loop. Every path cell was air in the pre-step state, so only the final cell is claimed; a lost claim falls back to shallower cells of the last stride, the other diagonal of the last slide, then earlier path waypoints, then stays. A tile that lands and still has budget now slides in the same step (a grain falling onto a 1-wide pillar reaches the diagonal one step earlier). Measured on a 400×300 grid: 40×40 sand block settles in 178 steps (was 385), pile 81 wide × 37 tall; dirt unchanged in shape (still jitters past 590 steps); step cost on ~660k cells with ~50% sand rose from 0.22 to 0.47 ms (budget 16.7 ms).

**Done when:**
- Sand falls and piles (3 cells/step free fall, ~45° piles, variant colors).
- **Conservation check:** tile count stable over time (debug readback of the non-air sum, or a harness). No tiles created/destroyed.
- `GRAVITY: 0` → no motion.

---

### Phase 5 — Dirt

**Status: done.** **Goal:** implement dirt with slope-aware friction. Implemented as one parameter-driven `updateFall` (replacing the sand-specific function): any element with a non-zero `gravityQuantum` falls, friction comes from the per-type `slideChance` table (sand 1 = no friction, dirt 0.25), so new falling elements need no shader work.

**Scope:**
- `src/engine/gpu/shaders.ts` — implement `updateDirt` replicating `tryFallStrideFriction`'s slope-aware gate (both diagonals open → roll; exactly one → roll with `slideChance[type]`; none → rest).
- `src/engine/element.ts` — `Element.slideChance` (default 1); `Dirt` sets it from `SLIDE_CHANCE`. `gpu-simulation.ts` uploads it into the uniform `slideChance` table.

**Done when:**
- Dirt piles/flows (clumpy, sticky: slope-aware friction with `SLIDE_CHANCE`).
- Conservation holds.

---

### Phase 6 — Painting

**Status: done.** **Goal:** make the brush work on the GPU world. Implemented as a staged bounding-box upload instead of per-cell `writeBuffer` calls (brush radius goes up to 500, ~hundreds of thousands of cells): `paint()` queues cells; each frame, before the sim steps, the queue is written into one dense staging buffer (sentinel `0xFFFFFFFF` = untouched, since air packs to 0) and a small compute pass scatters it into the current grid buffer. One upload + one dispatch per frame regardless of stroke size. Shape/radius/density logic stays in `main.ts`.

**Scope:**
- `src/engine/gpu/gpu-simulation.ts` — `paint(x, y, type, variant)` (called per cell by the brush): queue cells during the frame hook, then flush once per frame as `queue.writeBuffer` calls (one packed u32 per cell, or coalesced row spans) into the **current** grid buffer. Unconditional overwrite; Air erases. No staging buffer or row-alignment handling is needed.
- `src/main.ts` — brush already calls `sim.paint`.

**Done when:**
- Brush paints/erases on the GPU world, including at grid borders.
- Density gating (per-cell skip) works.
- Painting between frames (outside a step) causes no corruption.

---

### Phase 7 — Resize, colliders, docs, final validation

**Status: done.** **Goal:** make the GPU world robust to resize/collider changes, document it, and run the full validation. Collider changes now flow automatically: `ColliderManager.onChange` marks the solid mask dirty and `GpuSimulation` rebuilds it at the start of the next frame (coalescing bursts of adds). Window resizes are coalesced to one rebuild per animation frame. Added a performance HUD (third header button, `ui/perf-hud.ts`): fps/frame ms, tiles on screen, moving vs resting, GPU submit-to-complete ms and steps/s, grid size. The GPU has no sleep system, so "moving" (tiles that changed position in the last step, counted by `STATS_WGSL` as cells occupied before and air after) and "resting" stand in for awake/asleep; the counter pass runs only while the HUD is visible, twice a second.

**Scope:**
- `src/engine/gpu/gpu-simulation.ts` — `resize` (implemented in Phase 2) rebuilds `gridBufA/B`, `claimBuf`, `solidBuf`, `uniformBuf`, resets ping-pong + `step`; collider add/remove calls `rebuildSolidMask()` (implemented in Phase 2, hooked up here — the overlay registers colliders after the world exists, so the mask must be rebuilt after registration).
- `src/main.ts` — resize already calls `sim.resize`; add the `rebuildSolidMask()` call after collider registration.
- `AGENTS.md` — new "WebGPU backend" section (packed-tile format, ping-pong storage buffers, claim-buffer semantics + nondeterministic tie-break, clear-based write model, (type,variant)-only color constraint, collider→solid-mask, async device init + unsupported-browser message); update the file map. (Largely done in the CPU-removal pass; extend with the dirt/painting notes.)

**Done when:**
- Resize while running works (state resets).
- Collider add/remove updates the solid mask.
- Full validation from the §Validation section passes.
- `AGENTS.md` updated.

---

## Confirmed design decisions

| Question | Decision |
|---|---|
| Backend | WebGPU compute only; no CPU fallback. Creation is async (device acquired before the canvas context); if `navigator.gpu` is absent or device creation fails, `main.ts` shows a popup with a Try Again (reload) button; the same popup appears if the device is lost mid-session |
| Tile storage | One packed `uint32` per tile: `type`(0–7) \| `value`(8–15) \| `variant`(16–23) \| unused(24–31). Ping-pong two storage buffers (`array<u32>`, flat index `y*W+x`). Buffers rather than `r32uint` textures because WebGPU provides `clearBuffer` but no texture clear/fill, and buffers make painting a plain `writeBuffer` |
| Sleep / wake halo | **Dropped on GPU** — every tile updates every step in parallel; no sleep buffer, no halo, no epoch |
| Claim conflicts | Separate `atomic<u32>` claim buffer, `clearBuffer`-zeroed each step; `atomicCompareExchange(dest, 0, 1)` = "first claim wins". Tie-break is **nondeterministic** (acceptable for a visual sandbox); tile **conservation** is preserved |
| Write model | `clearBuffer(writeBuf)` (all air) at step start; stayer threads store themselves, mover threads store their destination, air threads store nothing. No grid copy, conflict-free (see §Compute model) |
| Colliders | Static solid-mask storage buffer (u32 per cell), rebuilt on resize / collider change; passable = `air && !solid` |
| Color | Precomputed `rgba8unorm` `256×256` texture indexed by `(type, variant)` → each element's `getColor(0, variant)`. **Constraint: GPU color depends on (type, variant) only, not `value`** (all current elements satisfy this) |
| Painting | `queue.writeBuffer` into the current grid buffer, batched per frame; **unconditional overwrite** (see §Painting) |

## Data model

Packed tile (`uint32`), little-endian bit layout:

```
bits  0–7   type      (0 = air)
bits  8–15  value     (fixed-point fall accumulator, 256 quanta = 1 cell)
bits 16–23  variant
bits 24–31  unused (0)
```

Packing/unpacking in WGSL: `type = p & 0xFFu`, `value = (p >> 8) & 0xFFu`, `variant = (p >> 16) & 0xFFu`; `pack(t,v,va) = t | (v << 8) | (va << 16)`.

GPU resources (all sized to the grid `W×H` unless noted):

- `gridBufA`, `gridBufB` — `GPUBuffer`, `W*H*4` bytes, `STORAGE | COPY_DST | COPY_SRC`; zero-initialized (all air). Ping-pong; one is "current" (read), the other "write".
- `claimBuf` — `GPUBuffer`, `W*H*4` bytes, `STORAGE | COPY_DST`. Zeroed each step via `clearBuffer`.
- `solidBuf` — `GPUBuffer`, `W*H*4` bytes, `STORAGE | COPY_DST`. 1 = collider cell, 0 = free. Rebuilt on resize / collider change.
- `colorTex` — `rgba8unorm`, `256×256`, `TEXTURE_BINDING`. `colorTex[type][variant]`.
- `uniformBuf` — `GPUBuffer`, `UNIFORM`. Struct below.

Uniform buffer (built on CPU from the registry + settings; 2096 bytes). The header is shared by render and compute; the render module declares only the header (a valid prefix of the buffer). WGSL uniform arrays need a 16-byte element stride, so the per-type tables are packed as `vec4`s and indexed `table[t >> 2][t & 3]`:

```
struct Uniforms {                    // header, 48 bytes
  width : u32, height : u32, tileSize : f32, _pad0 : u32,
  canvasSize : vec2f, _pad : vec2f,  // canvasSize = device pixels
  background : vec4f,                // SETTINGS.CANVAS_BACKGROUND
}
// followed in the buffer by:
//   gravity     : array<vec4u, 64>   // per-type fall quanta (computeGravityQuantum)
//   slideChance : array<vec4f, 64>   // per-type (sand 1.0, dirt 0.25, else 0)
```

`gravity[t]` (filled in Phase 4) = `computeGravityQuantum(SETTINGS.GRAVITY, scale_t, offset_t)` (sand 768, dirt 1024, wood/air 0). `slideChance[t]` (filled in Phase 5) from each element's static. Both tables are allocated zeroed in Phase 2. Unregistered types: 0/0.

## Compute model

**Push model, one thread per grid cell**, workgroup `16×16`. Each thread owns position `P` and reads the tile currently at `P` in the *read* buffer (pre-step state). Because the write buffer is cleared to air and only movers/stayers write, the pass is conflict-free:

- A mover's **destination** `D` is always air in the read state (passable), so no stayer occupies `D` and no other mover can win `D` (claim is atomic-exclusive) → `writeBuf[D]` is written by exactly one thread.
- A mover's **origin** `P` is higher than any destination (tiles only move down), so no other thread targets `P` → `P` stays air from the fill.
- A **stayer** writes only its own `P`.

Per-thread algorithm:

```
P = gid
p = readBuf[P.y * W + P.x]
type = p & 0xFFu
if type == AIR: return                      // air: fill already set it

value = (p >> 8) & 0xFFu
variant = (p >> 16) & 0xFFu

switch type:
  SAND:  result = updateSand(P, value, variant)
  DIRT:  result = updateDirt(P, value, variant)
  WOOD:  result = Stay                       // static
  default: result = Stay

// result = (moved: bool, dest: vec2i, newValue: u32)
if result.moved:
  if atomicCompareExchange(claim, result.dest, 0u, 1u) == 0u:   // won
    writeBuf[result.dest] = pack(type, result.newValue, variant)
  else:
    writeBuf[P] = pack(type, 0u, variant)   // lost claim -> stay
else:
  writeBuf[P] = pack(type, result.newValue, variant)   // stay
```

`updateSand` / `updateDirt` (mirror `engine/gravity.ts` + `engine/movement.ts`):

```
acc = value + gravity[type]
budget = acc >> 8
remainder = acc & 0xFFu
// stride straight down: deepest contiguous passable cell up to `budget`
depth = 0
while depth < budget and passable(P + (0, depth+1)): depth++
if depth > 0:
  for d in depth..1:                          // fall back to shallower on lost claim
    if claim(P + (0, d)): return Moved(dest=P+(0,d), newValue=remainder)
  return Stay(newValue=0)                     // all landing cells claimed -> rest
// blocked straight down -> diagonal slide
side = (rand(P, step) < 0.5) ? -1 : 1
[for DIRT: apply slope-aware friction gate with slideChance[type] (see note)]
for s in (side, -side):
  D = P + (s, 1)
  if passable(D) and claim(D): return Moved(dest=D, newValue=remainder)
return Stay(newValue=0)
```

Notes:
- `passable(gid)` = `in-bounds && (readBuf type == AIR) && (solidBuf == 0)`. Bounds-checked (edges return false).
- `claim(gid)` = `atomicCompareExchange(claimBuf, gid, 0u, 1u) == 0u`. A failed CAS does **not** modify the buffer, so the stride fall-back loop is safe.
- On a blocked/stayed tile the value resets to 0 (matches `spendFallBudget`'s "shed remaining budget" on block); on a move it carries `remainder` (fractional-rate accumulator, zero drift).
- **Dirt friction**: replicate `tryFallStrideFriction`'s slope-aware gate — read the two diagonal-down cells from the *read* buffer; both open → always roll; exactly one open → roll with `slideChance[type]`; none open → rest. (Read each cell, extract the boolean before the next read — trivial in WGSL since each read is a local.)
- **PRNG**: `rand(x, y, step)` = a 32-bit integer hash of `(x, y, step)` normalized to `[0,1)`. Deterministic per `(tile, step)`, statistically fine for slide side + slide chance; no shared RNG state.

`step` comes from the dynamic-offset `stepBuf` uniform (slot `k` holds `stepCount + k`) and feeds the PRNG. The claim uses WGSL `atomicCompareExchangeWeak(...).exchanged` (WGSL has no strong variant); a spurious failure only makes a mover stay for one step, so conservation still holds.

## Step loop / fixed timestep

`GpuSimulation` runs a fixed-timestep rAF accumulator (16.67 ms step, max 5 steps/frame, backlog dropped; ported from the removed CPU `Simulation`). Per animation frame, encode **one** command buffer containing, in order: for each of the N steps → `clearBuffer(claimBuf)` + `clearBuffer(writeBuf)` + a compute pass dispatching `ceil(W/16) × ceil(H/16)` workgroups (clears are encoded outside compute passes, so each step is clear, clear, pass); then the render pass. Submit once. Ping-pong: `current` starts as `A`; each step swaps read/write; after N steps the render pass binds the final `current` (two prebuilt render bind groups, and likewise two compute bind groups, selected by parity).

`clearBuffer(writeBuf)` zeroes the whole write buffer to air (the "untouched cells stay air / vacated origins stay air" base). It is a fast GPU memset, cheaper than a grid copy.

## Render pass

Full-screen triangle (3-vertex `@vertex`, no vertex buffer). The render pass binds the uniform buffer, the current grid buffer (read-only storage) and `colorTex`. Fragment shader maps the device pixel to a grid cell and looks up color:

```
gridX = min(floor(pos.x * gridW / canvasW), gridW - 1)
gridY = min(floor(pos.y * gridH / canvasH), gridH - 1)
p = grid[gridY * gridW + gridX]
type = p & 0xFFu
if type == AIR: return vec4(bg)              // bg = SETTINGS.CANVAS_BACKGROUND
variant = (p >> 16) & 0xFFu
return textureLoad(colorTex, vec2u(type, variant), 0)
```

The canvas uses the `webgpu` context (format = `navigator.gpu.getPreferredCanvasFormat()`, `alphaMode: 'opaque'`); the render target is `canvas.getContext('webgpu').getCurrentTexture().createView()`. The grid maps onto the full canvas (sub-pixel stretch < 1 px from `tileSize` rounding — imperceptible). Air renders the background color (opaque canvas), matching the current visual.

## Painting

The brush computes the region on the CPU in `main.ts` (shape/radius/density). To respect GPU ownership of the grid, upload cells with `queue.writeBuffer` into the **current** grid buffer (one u32 per cell, batched per frame). `writeBuffer` is ordered before the frame's submitted commands, so painting happens outside a step, outside the sim step.

- **Behavior change:** overwrite is unconditional (paint sand → those cells become sand; Air → erase). The old CPU "only paint into empty cells / only erase occupied" occupancy check is dropped, because the grid state lives on the GPU and a readback would add latency. Acceptable for a sandbox; noted as a future refinement (small-region async readback to restore occupancy checks).
- Density gating (per-cell `Math.random() > density` skip) and the collider check are computed on CPU in `main.ts` before `paint` is called, so the brush never writes into collider cells.

## Resize / colliders

Resize rebuilds the GPU world (grid state resets): destroy and recreate `gridBufA/B`, `claimBuf`, `solidBuf`, resize the canvas backing store, rewrite `uniformBuf` (W/H/tileSize/canvas size), rebuild the bind groups, reset `current=A`, `step=0`. Collider add/remove (overlay layout changes) calls `rebuildSolidMask()`, which re-rasterizes the rects via `ColliderManager.forEachRect` and rewrites `solidBuf` only.

## CPU engine removal

After Phase 4 the CPU engine was removed so each element has a single behavior implementation (WGSL) plus a metadata-only TypeScript class.

- **Deleted:** `engine/{grid,simulation,movement,renderer}.ts`, `profile/` + `profile.bat`, `harness2.ts`, the `World` interface / `createCpuWorld` / backend selection in `main.ts`, and the settings `USE_WEBGPU`, `LOG_GRID_STATS`, `DIRECTION_SWITCH_INTERVAL`.
- **Trimmed:** `element.ts` keeps only `Element` (metadata + `gravityQuantum`) and `ElementRegistry` (no `UpdateContext`/`SimContext`/`update()`/`wakeRadius`); `gravity.ts` keeps only `computeGravityQuantum`; elements lost their `update()`, movement closures and wake radii; `new-element.bat` templates generate metadata-only classes.
- **`main.ts`** calls `GpuSimulation.create` directly. If `navigator.gpu` is missing or device creation throws, it shows an "unsupported browser" message.
- **Consequences:** no CPU perf harness (GPU work can't run in Node; perf is checked live in-browser); new moving elements need WGSL; WebGPU is required.

## File-by-file changes

1. **`src/engine/gpu/shaders.ts`** (new) — WGSL source strings: the compute module (`@compute @workgroup_size(16,16)` `main`, `updateSand`, `updateDirt`, `passable`, `claim`, `rand`, `pack`) and the render module (`@vertex` full-screen triangle, `@fragment` grid→color). Exported as `COMPUTE_WGSL` / `RENDER_WGSL`, plus the shared `UNIFORM_HEADER_WGSL`.
2. **`src/engine/gpu/gpu-simulation.ts`** (new) — `GpuSimulation` class: async device/adapter init, buffer + texture creation, `uniformBuf`/`colorTex`/solid-mask builders (from registry + `ColliderManager`), the fixed-timestep rAF loop, per-frame command-buffer encoding (N×(clear+clear+compute pass) + render), ping-pong swap, batched `paint`, `resize`, `rebuildSolidMask`, `start`/`stop`.
3. **`src/main.ts`** — direct `GpuSimulation.create` bootstrap, brush painting, resize, unsupported-browser message.
4. **`src/settings.ts`** — CPU-only flags removed.
5. **`src/engine/collider.ts`** — `forEachRect(visit)`.
6. **`src/engine/gpu/webgpu.d.ts`** — ambient WebGPU declarations missing from the DOM lib.
7. **`AGENTS.md`** — new "WebGPU backend" section: packed-tile format, ping-pong storage buffers, claim-buffer semantics + nondeterministic tie-break, clear-based write model, (type,variant)-only color constraint, collider→solid-mask, async device init + unsupported-browser message. Update the file map.

Removed/trimmed: see §CPU engine removal.

## Performance analysis

- 1M tiles = 1M threads. Each thread does ~10–50 ALU ops + a few `textureLoad`s + ≤1 atomic. A modern GPU clears this in well under 1 ms; the only serialization is the per-destination-cell atomic, which is mostly uncontended (destinations are air, spread out). Headroom extends to 100M+ tiles.
- Per-step GPU work: `clearBuffer`(claim) + `clearBuffer`(write) + 1 dispatch — two fast memsets + one parallel pass. No per-frame GPU→CPU readback (render reads GPU textures directly).
- The sleep/halo system (the CPU's dominant cost at scale) is gone entirely.

## Validation

1. `npx tsc --noEmit` and `npm run build` clean.
2. In-browser (GPU work cannot run in Node, so perf is validated live): open the performance HUD; seed ~1M awake tiles (e.g. a large dense block) and confirm 60 fps with headroom.
3. Visual check: sand and dirt fall at the expected rates and pile at the expected slopes with correct variant colors.
4. **Conservation check**: tile count is stable over time (no creation/destruction) — a temporary debug readback of the current texture (sum of non-air) or a harness; the claim/clear model must never drop or duplicate a tile.
5. Unsupported browsers: with `navigator.gpu` missing (or device creation failing) the page shows the unsupported message.
6. Edge cases: painting at grid borders, resize while running, collider add/remove, `GRAVITY: 0` (no motion), single-tile and single-column falls.

## Non-goals

- Value-dependent coloring on GPU (color texture is (type, variant)-only).
- Deterministic tie-breaks (GPU claim order is nondeterministic by design).
- Occupancy-aware painting (async readback to restore "only paint into empty cells").
- Multi-adapter / advanced scheduling / bind-group caching beyond the two render groups.
- Porting the dirty-rect / partial-redraw system to GPU (full-screen render each frame is already cheap at GPU scale).

## Risks

- **WebGPU availability** — required; browsers without it see an unsupported message (no fallback).
- **Nondeterministic tie-breaks** — documented; visually indistinguishable for a falling-sands toy; conservation is preserved. If determinism is ever required it is a separate, harder problem.
- **(type, variant)-only color** — a future element whose color depends on `value` (e.g. heat) would need a shader-side color routine; none exist today.
- **Painting overwrite** — overwrites unconditionally (can paint over other elements; the brush skips collider cells). Acceptable; refinement path noted.
- **Atomic contention** — in a pathological fully-dense collapsing front many threads may target the same cells; the per-cell atomic still resolves it correctly (one winner), with a small throughput dip. Mitigated in practice by the stride fall-back spreading landings.
