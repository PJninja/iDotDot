/**
 * World snapshots and their file format (.idw): a 16-byte header followed by the
 * gzipped packed grid words exactly as the GPU stores them, so a saved world needs no
 * per-element knowledge. Pure (no GPU, no DOM beyond the Compression Streams API), so
 * the format and the resampling can be checked in Node.
 *
 * Header, little-endian: magic "IDW1", width u16, height u16, tile size in CSS px f32,
 * 4 reserved bytes. Type ids are stable constants (settings.ts); never renumber them.
 */
export interface WorldSnapshot {
  width: number;
  height: number;
  /** Tile edge in CSS px when the world was saved; drives resampling on load. */
  tileCss: number;
  /** Packed grid words, row-major (y * width + x). */
  cells: Uint32Array;
}

const MAGIC = 0x31574449; // "IDW1" read as a little-endian u32
const HEADER_BYTES = 16;
const MAX_DIMENSION = 0xffff;
/** Tile size ratios closer to 1 than this are copied without resampling. */
const SAME_SCALE_EPSILON = 0.01;
const TYPE_MASK = 0xff;
const AIR = 0;

async function transform(bytes: BlobPart, stream: CompressionStream | DecompressionStream): Promise<ArrayBuffer> {
  return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
}

/** Serialize a snapshot to the .idw file format. */
export async function encodeWorld(world: WorldSnapshot): Promise<Blob> {
  if (world.cells.length !== world.width * world.height) {
    throw new Error('World cell count does not match its size');
  }
  if (world.width < 1 || world.height < 1 || world.width > MAX_DIMENSION || world.height > MAX_DIMENSION) {
    throw new Error(`World size ${world.width}x${world.height} is out of range`);
  }
  const header = new DataView(new ArrayBuffer(HEADER_BYTES));
  header.setUint32(0, MAGIC, true);
  header.setUint16(4, world.width, true);
  header.setUint16(6, world.height, true);
  header.setFloat32(8, world.tileCss, true);
  const payload = await transform(world.cells as Uint32Array<ArrayBuffer>, new CompressionStream('gzip'));
  return new Blob([header.buffer, payload], { type: 'application/octet-stream' });
}

/** Parse and validate a .idw file; throws an Error naming what is wrong. */
export async function decodeWorld(buffer: ArrayBuffer): Promise<WorldSnapshot> {
  if (buffer.byteLength < HEADER_BYTES) throw new Error('Not a world file (too short)');
  const header = new DataView(buffer, 0, HEADER_BYTES);
  if (header.getUint32(0, true) !== MAGIC) throw new Error('Not a world file (bad magic)');
  const width = header.getUint16(4, true);
  const height = header.getUint16(6, true);
  const tileCss = header.getFloat32(8, true);
  if (width < 1 || height < 1) throw new Error('World file has an empty size');
  if (!(tileCss > 0) || !Number.isFinite(tileCss)) throw new Error('World file has an invalid tile size');
  let raw: ArrayBuffer;
  try {
    raw = await transform(new Uint8Array(buffer, HEADER_BYTES), new DecompressionStream('gzip'));
  } catch {
    throw new Error('World file data is corrupt');
  }
  if (raw.byteLength !== width * height * 4) throw new Error('World file data does not match its size');
  return { width, height, tileCss, cells: new Uint32Array(raw) };
}

/**
 * Scale a world by `scale` (saved tile size / target tile size) so it keeps its physical
 * size. Enlarging repeats cells. Shrinking merges each block of source cells into the
 * most common non-air type, or air when most of the block is air (a block that is half
 * air stays solid, so thin walls survive).
 */
export function resampleWorld(world: WorldSnapshot, scale: number): WorldSnapshot {
  const width = Math.max(1, Math.round(world.width * scale));
  const height = Math.max(1, Math.round(world.height * scale));
  const cells = new Uint32Array(width * height);
  const counts = new Uint32Array(256);
  const firstCell = new Uint32Array(256);
  for (let y = 0; y < height; y++) {
    const y0 = Math.min(world.height - 1, Math.floor(y / scale));
    const y1 = Math.min(world.height, Math.max(y0 + 1, Math.ceil((y + 1) / scale)));
    for (let x = 0; x < width; x++) {
      const x0 = Math.min(world.width - 1, Math.floor(x / scale));
      if (scale >= 1) {
        cells[y * width + x] = world.cells[y0 * world.width + x0];
        continue;
      }
      const x1 = Math.min(world.width, Math.max(x0 + 1, Math.ceil((x + 1) / scale)));
      counts.fill(0);
      let solid = 0;
      let air = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const cell = world.cells[sy * world.width + sx];
          const type = cell & TYPE_MASK;
          if (type === AIR) {
            air++;
            continue;
          }
          if (counts[type]++ === 0) firstCell[type] = cell;
          solid++;
        }
      }
      if (solid === 0 || solid < air) continue;
      let best = 0;
      for (let t = 1; t < 256; t++) if (counts[t] > counts[best]) best = t;
      cells[y * width + x] = firstCell[best];
    }
  }
  return { width, height, tileCss: world.tileCss / scale, cells };
}

/**
 * Fit a saved world onto a grid of the given size and tile size: resample to the target
 * tile size, then anchor it bottom-center, cropping what overflows and leaving air where
 * it falls short.
 */
export function fitWorld(world: WorldSnapshot, width: number, height: number, tileCss: number): Uint32Array {
  const scale = world.tileCss / tileCss;
  const source = Math.abs(scale - 1) < SAME_SCALE_EPSILON ? world : resampleWorld(world, scale);
  const fitted = new Uint32Array(width * height);
  const dx = Math.floor((width - source.width) / 2);
  const dy = height - source.height;
  for (let sy = Math.max(0, -dy); sy < source.height; sy++) {
    const y = sy + dy;
    if (y >= height) break;
    const sx0 = Math.max(0, -dx);
    const sx1 = Math.min(source.width, width - dx);
    if (sx1 <= sx0) break;
    fitted.set(source.cells.subarray(sy * source.width + sx0, sy * source.width + sx1), y * width + sx0 + dx);
  }
  return fitted;
}
