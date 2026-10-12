// Is software WebGPU usable here? Requests an adapter and device, runs a tiny compute shader and
// reads the result back. Needs no app code, so a failure means the environment, not the sim.
//   node tools/browser/smoke.mjs
import { ensureDevServer, reportLog, withPage } from './launch.mjs';

const ORIGIN = 'http://localhost:5173';
const stop = await ensureDevServer(ORIGIN);
let failed = true;
try {
  await withPage(`${ORIGIN}/?view=plain`, async (page, log) => {
    const result = await page.evaluate(async () => {
      if (!navigator.gpu) return { ok: false, why: 'navigator.gpu is missing (is the page on localhost?)' };
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return { ok: false, why: 'no adapter' };
      const device = await adapter.requestDevice();
      const buffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      const staging = device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      const module = device.createShaderModule({
        code: '@group(0) @binding(0) var<storage, read_write> out : array<u32>; @compute @workgroup_size(4) fn main(@builtin(global_invocation_id) id : vec3u) { out[id.x] = id.x * 7u + 1u; }',
      });
      const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
      const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer } }] });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind);
      pass.dispatchWorkgroups(1);
      pass.end();
      encoder.copyBufferToBuffer(buffer, 0, staging, 0, 16);
      device.queue.submit([encoder.finish()]);
      await staging.mapAsync(GPUMapMode.READ);
      const values = [...new Uint32Array(staging.getMappedRange())];
      return { ok: values.join() === '1,8,15,22', values, info: adapter.info?.description || adapter.info?.vendor || adapter.info?.architecture || 'software adapter' };
    });
    reportLog(log);
    console.log(result.ok ? `PASS compute readback ${result.values} (${result.info}) in ${log.elapsedMs()} ms` : `FAIL ${result.why ?? `unexpected readback ${result.values}`}`);
    failed = !result.ok;
  });
} finally {
  stop();
}
process.exit(failed ? 1 : 0);
