# Convert

Convertit images, données, encodages, couleurs et unités **dans le navigateur**. Rien n'est envoyé : après le chargement de la page, aucun appel réseau, aucun cookie, aucune mesure d'audience.

A browser converter for images, data, encodings, colours and units. Everything stays on the device.

Live (after the GitHub Pages workflow runs on `main`): [https://mtaqys.github.io/Convert/](https://mtaqys.github.io/Convert/)

## Features

- **Images** — PNG, JPG, WebP and AVIF, in any direction. Quality slider, optional resize (keep the ratio or set both sides), batch conversion, ZIP download. AVIF encoding is detected; if the browser cannot encode it, the page says so. Work runs in a Web Worker.
- **Data** — JSON, CSV, YAML and XML, in any direction, with pretty-printing. Errors name the failing line.
- **Encoding** — Base64 (text and files), URL encoding, HTML entities.
- **Colours** — HEX, RGB, HSL and OKLCH, a live swatch, and WCAG contrast against black and white.
- **Units** — length, weight, temperature, data size (1000 and 1024 bases, bytes through terabytes), time and speed.

Shared behaviour:

- French by default, English from the language switch. Every user-facing string lives in `src/i18n/fr.json` and `src/i18n/en.json`.
- Light and dark themes.
- Drag and drop and a file picker. Copy and download on every output.
- Files over 50 MB are refused with an explanation.
- Keyboard access, labels on every field, visible focus, usable on a phone.
- Strict Content-Security-Policy in a `<meta>` tag and in `public/_headers` (for Cloudflare Pages later).

## Local setup

Node.js 22 or newer.

```bash
npm install
npm run dev
```

The dev server strips the CSP meta tag, because Vite injects styles during development. `npm run build` and `npm run preview` keep the policy.

```bash
npm test
npm run lint
npm run build
npm run preview
```

The base path defaults to `/Convert/` so the built site matches GitHub Pages. Override it when you need a different mount:

```bash
VITE_BASE_PATH=/ npm run dev
VITE_BASE_PATH=/ npm run build
```

Use a trailing slash (`/Convert/`).

## Deploy to GitHub Pages

`.github/workflows/pages.yml` builds with `VITE_BASE_PATH=/Convert/` and deploys the `dist` folder on every push to `main`.

The repository setting **Settings → Pages → Build and deployment → Source** must be **GitHub Actions**. The workflow cannot publish until that source is selected. After the first successful run, the site is at `https://mtaqys.github.io/Convert/`.

Open Graph and Twitter URLs are `SITE_ORIGIN` in [`src/site.ts`](src/site.ts) joined to that base path. It is `https://mtaqys.github.io` today. Change `SITE_ORIGIN` when the tool moves to dynamogic.com. The footer credit links to https://dynamogic.com/ beside the Grand-duc mark.

The page uses the Dynamogic identity: dark by default (`#0E0F11`), light when requested (`#F5F3EE`), Instrument Serif, Geist, Geist Mono, and one copper accent. The fonts are self-hosted, and the content security policy keeps `font-src 'self'`.

`.github/workflows/ci.yml` runs lint, tests and the production build on every push.

## Deploy to Cloudflare Pages

1. Create a Pages project from this repository.
2. Build command: `npm run build`. Publish directory: `dist`.
3. Environment variable: `VITE_BASE_PATH=/`.
4. `public/_headers` is copied into `dist` and applies the same CSP and the extra security headers (GitHub Pages ignores that file; the meta tag still applies there).

## Privacy

Conversion runs in the page and, for images and file Base64, in a Web Worker. Language and theme are stored in `localStorage` (`convert.lang`, `convert.theme`), not in cookies. There is no analytics.

## Licence

[MIT](LICENSE). Copyright 2026 Dynamogic.
