import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fr from '../src/i18n/fr.json' with { type: 'json' };
import { DYNAMOGIC_URL, OG_IMAGE_FILE, SITE_ORIGIN, applySiteUrls, joinSiteUrl } from '../src/site';

function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(bytes.subarray(0, 8).equals(signature)).toBe(true);
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('public site URL', () => {
  it('keeps the GitHub Pages origin in one place', () => {
    expect(SITE_ORIGIN).toBe('https://mtaqys.github.io');
    expect(DYNAMOGIC_URL).toBe('https://dynamogic.com/');
  });

  it('joins the origin to the configurable base path', () => {
    expect(joinSiteUrl('/Convert/')).toBe('https://mtaqys.github.io/Convert/');
    expect(joinSiteUrl('/Convert/', OG_IMAGE_FILE)).toBe('https://mtaqys.github.io/Convert/og.png');
    expect(joinSiteUrl('/')).toBe('https://mtaqys.github.io/');
    expect(joinSiteUrl('/', OG_IMAGE_FILE)).toBe('https://mtaqys.github.io/og.png');
    expect(joinSiteUrl('/Convert', `/${OG_IMAGE_FILE}`)).toBe('https://mtaqys.github.io/Convert/og.png');
  });

  it('points the footer at dynamogic.com and the Grand-duc mark', () => {
    const shell = readFileSync(new URL('../src/app/shell.ts', import.meta.url), 'utf8');
    expect(shell).toContain('href: DYNAMOGIC_URL');
    expect(shell).toContain('mark.svg');
    expect(shell).toContain('footerCredit');
    expect(shell).not.toContain('https://mtaqys.github.io/');
  });
});

describe('index metadata', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  it('ships French title, description, and language', () => {
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain(`<title>${fr['meta.title']}</title>`);
    expect(html).toContain(`content="${fr['meta.description']}"`);
    expect(html).not.toContain('content=""');
  });

  it('declares Open Graph and Twitter cards with a base-aware URL', () => {
    expect(html).toContain('property="og:title" content="Convert"');
    expect(html).toContain(`property="og:description"\n      content="${fr['meta.description']}"`);
    expect(html).toContain('property="og:locale" content="fr_FR"');
    expect(html).toContain('property="og:locale:alternate" content="en_US"');
    expect(html).toContain('property="og:url" content="__SITE_URL__"');
    expect(html).toContain(`property="og:image" content="__SITE_URL__${OG_IMAGE_FILE}"`);
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).toContain(`property="og:image:alt"\n      content="${fr['meta.imageAlt']}"`);
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="twitter:title" content="Convert"');
    expect(html).toContain(`name="twitter:description"\n      content="${fr['meta.description']}"`);
    expect(html).toContain('name="twitter:url" content="__SITE_URL__"');
    expect(html).toContain(`name="twitter:image" content="__SITE_URL__${OG_IMAGE_FILE}"`);

    const pages = applySiteUrls(html, '/Convert/');
    expect(pages).toContain('content="https://mtaqys.github.io/Convert/"');
    expect(pages).toContain('content="https://mtaqys.github.io/Convert/og.png"');
    expect(pages).not.toContain('__SITE_URL__');

    const root = applySiteUrls(html, '/');
    expect(root).toContain('content="https://mtaqys.github.io/"');
    expect(root).toContain('content="https://mtaqys.github.io/og.png"');
    expect(root).not.toContain('https://mtaqys.github.io/Convert/');
  });

  it('uses the Grand-duc icons, manifest, and dark default theme color', () => {
    const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    const themeInit = readFileSync(new URL('../public/theme-init.js', import.meta.url), 'utf8');
    const manifest = readFileSync(new URL('../public/site.webmanifest', import.meta.url), 'utf8');
    expect(css).toMatch(/--dg-bg:\s*#0e0f11/i);
    expect(css).toMatch(/--dg-bg:\s*#f5f3ee/i);
    expect(css).toMatch(/--dg-accent:\s*#d4925f/i);
    expect(css).toMatch(/--dg-accent:\s*#9c5428/i);
    expect(css).toContain('"Instrument Serif"');
    expect(css).toContain('"Geist"');
    expect(css).toContain('"Geist Mono"');
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(html).toContain('rel="icon" href="/favicon.ico" sizes="48x48"');
    expect(html).toContain('rel="icon" href="/favicon.svg" type="image/svg+xml"');
    expect(html).toContain('rel="icon" href="/favicon-16.svg" type="image/svg+xml" sizes="16x16"');
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon-180.png"');
    expect(html).toContain('rel="manifest" href="/site.webmanifest"');
    expect(html).toContain('name="theme-color" content="#0E0F11"');
    expect(html).toContain("font-src 'self'");
    expect(themeInit).toContain('#F5F3EE');
    expect(themeInit).toContain('#0E0F11');
    expect(themeInit).toContain('convert.theme');
    expect(themeInit).toContain('convert.lang');
    expect(manifest).toContain('app-icon-192.png');
    expect(manifest).toContain('app-icon-512.png');
    const ico = readFileSync(new URL('../public/favicon.ico', import.meta.url));
    expect(ico.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))).toBe(true);
    expect(pngSize(new URL('../public/apple-touch-icon-180.png', import.meta.url).pathname)).toEqual({
      width: 180,
      height: 180,
    });
    expect(pngSize(new URL('../public/app-icon-192.png', import.meta.url).pathname)).toEqual({
      width: 192,
      height: 192,
    });
    expect(pngSize(new URL('../public/app-icon-512.png', import.meta.url).pathname)).toEqual({
      width: 512,
      height: 512,
    });
    expect(pngSize(new URL('../public/og.png', import.meta.url).pathname)).toEqual({
      width: 1200,
      height: 630,
    });
    const mark = readFileSync(new URL('../public/mark.svg', import.meta.url), 'utf8');
    expect(mark).toContain('prefers-color-scheme:dark');
    expect(readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')).toContain(
      'M24 14.6L45 2.476',
    );
  });
});
