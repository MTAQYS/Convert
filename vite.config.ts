import { defineConfig } from 'vitest/config';

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const base = env?.VITE_BASE_PATH || '/Convert/';

export default defineConfig(({ command }) => ({
  base,
  plugins: [
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
