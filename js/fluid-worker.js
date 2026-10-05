// Runs the background liquid sim off the main thread (see js/fluid.js).
import { FluidEngine } from './fluid-sim.js';

const requestFrame = self.requestAnimationFrame
  ? cb => self.requestAnimationFrame(cb)
  : cb => setTimeout(() => cb(performance.now()), 1000 / 60);

let engine = null;

self.onmessage = ({ data }) => {
  switch (data.type) {
    case 'init': {
      const ctx = data.canvas.getContext('2d');
      if (!ctx) {
        self.postMessage({ type: 'fail' });
        return;
      }
      engine = new FluidEngine(data.canvas, ctx, requestFrame,
        stats => self.postMessage({ type: 'stats', stats }));
      engine.setColors(data.colors);
      engine.configure(data.cfg);
      self.postMessage({ type: 'ready' });
      break;
    }
    case 'config':
      engine?.configure(data.cfg);
      break;
    case 'colors':
      engine?.setColors(data.colors);
      break;
    case 'visible':
      engine?.setVisible(data.visible);
      break;
    case 'remove':
      engine?.removeAt(data.x, data.y);
      break;
    case 'pointer':
      engine?.pointer(data.x, data.y, data.vx, data.vy);
      break;
  }
};
