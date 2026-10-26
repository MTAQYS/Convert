import { defineConfig, type Plugin } from 'vitest/config';
import { applySiteUrls } from './src/site';

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const base = env?.VITE_BASE_PATH || '/Convert/';

/** Bake absolute social URLs from `SITE_ORIGIN` in src/site.ts plus Vite's base. */
function injectSiteUrl(): Plugin {
  let resolvedBase = base;
  return {
    name: 'inject-site-url',
    configResolved(config) {
      resolvedBase = config.base;
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return applySiteUrls(html, resolvedBase);
      },
    },
  };
}

export default defineConfig(({ command }) => ({
  base,
  plugins: [
    injectSiteUrl(),
    {
      name: 'strip-csp-in-dev',
      transformIndexHtml(html) {
        if (command !== 'serve') return html;
        return html.replace(/\s*<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>\s*/i, '\n');
      },
    },
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
