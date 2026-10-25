import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const policy =
  "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests";

describe('content security policy', () => {
  it('matches in the page and the Cloudflare headers file', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
    expect(html).toContain(policy);
    expect(headers).toContain(`Content-Security-Policy: ${policy}`);
    expect(html).not.toContain('unsafe-inline');
    expect(html).not.toContain('unsafe-eval');
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('Referrer-Policy: no-referrer');
  });
});
