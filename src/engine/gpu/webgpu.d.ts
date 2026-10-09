/**
 * Ambient WebGPU declarations.
 *
 * TypeScript 7's bundled DOM lib ships a partial WebGPU surface: the core
 * interfaces (GPUDevice, GPUCommandEncoder, GPUTexture, ...) and their
 * descriptor types are present, but a handful of const objects, a couple of
 * methods, and the canvas context type are missing. This file fills exactly
 * those gaps so the GPU backend type-checks with zero runtime dependencies
 * (no @types/webgpu).
 *
 * The const objects and interface augmentations below merge with the DOM lib
 * declarations (interface declaration merging / global const objects that the
 * lib does not define). Members the lib already provides are NOT redeclared
 * here, to avoid duplicate-identifier conflicts.
 */

// --- Usage / stage const objects (absent from the lib) ---------------------

declare const GPUBufferUsage: {
  readonly MAP_READ: number;
  readonly MAP_WRITE: number;
  readonly COPY_SRC: number;
  readonly COPY_DST: number;
  readonly UNIFORM: number;
  readonly STORAGE: number;
  readonly INDIRECT: number;
};

declare const GPUTextureUsage: {
  readonly COPY_SRC: number;
  readonly COPY_DST: number;
  readonly TEXTURE_BINDING: number;
  readonly STORAGE_BINDING: number;
  readonly RENDER_ATTACHMENT: number;
};

declare const GPUMapMode: {
  readonly READ: number;
  readonly WRITE: number;
};

declare const GPUShaderStage: {
  readonly VERTEX: number;
  readonly FRAGMENT: number;
  readonly COMPUTE: number;
};

// --- GPU entry point: preferred canvas format (absent from the lib) ----------------

interface GPU {
  getPreferredCanvasFormat(): GPUTextureFormat;
}

// --- Canvas context type (the lib types getContext('webgpu') as
//     RenderingContext | null, which lacks the WebGPU surface) --------------

interface GPUCanvasContext {
  configure(configuration: GPUCanvasConfiguration): void;
  getCurrentTexture(): GPUTexture;
  commit(): void;
}
