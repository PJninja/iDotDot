import { createServer, type Plugin } from 'vite';

const MARKER = '<!--plain-view-->';

/**
 * Writes a text-only copy of the plain page into index.html at build time, so crawlers and
 * visitors without JavaScript get the project content. The markup comes from the same
 * project modules and renderer the app uses (loaded through a throwaway Vite server, which
 * resolves `import.meta.glob` and asset imports), never from a second copy of the content.
 */
export function plainViewPlugin(): Plugin {
  return {
    name: 'idotdot-plain-view',
    apply: 'build',
    async transformIndexHtml(html) {
      if (!html.includes(MARKER)) return html;
      const server = await createServer({
        configFile: false,
        appType: 'custom',
        logLevel: 'silent',
        server: { middlewareMode: true, hmr: false, watch: null },
        optimizeDeps: { noDiscovery: true },
      });
      try {
        const projects = await server.ssrLoadModule('/src/projects/index.ts');
        const site = await server.ssrLoadModule('/src/site.ts');
        const renderer = await server.ssrLoadModule('/src/ui/plain-html.ts');
        const markup = renderer.renderPlainHtml(projects.loadProjects(), site.SITE, { media: false });
        return html.replace(MARKER, markup);
      } finally {
        await server.close();
      }
    },
  };
}
