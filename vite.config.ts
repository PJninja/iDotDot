import { defineConfig } from 'vite';
import { plainViewPlugin } from './tools/vite-plain-view.ts';

export default defineConfig({
  plugins: [plainViewPlugin()],
});
