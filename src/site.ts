/**
 * Public origin of this tool.
 *
 * The path comes from Vite's `base` (`VITE_BASE_PATH`, default `/Convert/`).
 * Change this constant when the site moves to https://dynamogic.com.
 */
export const SITE_ORIGIN = 'https://mtaqys.github.io';

/** Brand home linked from the footer in every language. */
export const DYNAMOGIC_URL = 'https://dynamogic.com/';

/** File in `public/` used as the Open Graph / Twitter image. */
export const OG_IMAGE_FILE = 'og.png';

/** Placeholder replaced at build and dev time with the absolute site URL. */
export const SITE_URL_TOKEN = '__SITE_URL__';

/**
 * Join the public origin to a Vite base path and an optional file.
 * `base` is a path such as `/Convert/` or `/`, not a full URL.
 */
export function joinSiteUrl(base: string, path = ''): string {
  const origin = SITE_ORIGIN.replace(/\/+$/, '');
  const trimmed = base.trim();
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const prefix = withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
  const suffix = path.replace(/^\/+/, '');
  return `${origin}${prefix}${suffix}`;
}

/** Replace `__SITE_URL__` in HTML with the absolute URL for this base path. */
export function applySiteUrls(html: string, base: string): string {
  const site = joinSiteUrl(base);
  const image = joinSiteUrl(base, OG_IMAGE_FILE);
  return html.replaceAll(`${SITE_URL_TOKEN}${OG_IMAGE_FILE}`, image).replaceAll(SITE_URL_TOKEN, site);
}
