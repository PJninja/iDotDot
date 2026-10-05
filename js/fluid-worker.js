// Runs the background liquid sim off the main thread (see js/fluid.js).
import { FluidEngine } from './fluid-sim.js';

const requestFrame = self.requestAnimationFrame
  ? cb => self.requestAnimationFrame(cb)
  : cb => setTimeout(() => cb(performance.now()), 1000 / 60);

let engine = null;

self.onmessage = ({ data }) => {
  switch (data.type) {
    case 'init': {
      const layers = data.canvases.map(canvas => ({ canvas, ctx: canvas.getContext('2d') }));
      if (layers.some(l => !l.ctx)) {
        self.postMessage({ type: 'fail' });
        return;
      }
      engine = new FluidEngine(layers, requestFrame, msg => self.postMessage(msg));
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
    case 'drain':
      engine?.setDraining(data.on);
      break;
    case 'splash':
      engine?.splash(data.points);
      break;
  }
};
