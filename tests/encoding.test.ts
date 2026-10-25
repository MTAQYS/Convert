import { describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  bytesToBase64,
  decodeBase64Text,
  decodeHtml,
  decodeUrl,
  encodeBase64Text,
  encodeHtml,
  encodeUrl,
} from '../src/lib/encoding';

describe('base64', () => {
  it('round-trips ascii, french and emoji text', () => {
    expect(encodeBase64Text('hello')).toEqual({ ok: true, value: 'aGVsbG8=' });
    expect(decodeBase64Text('aGVsbG8=')).toEqual({ ok: true, value: 'hello' });
    expect(encodeBase64Text('')).toEqual({ ok: true, value: '' });
    expect(decodeBase64Text('   ')).toEqual({ ok: true, value: '' });
    for (const sample of ['café', '東京', '😀', 'héllo 😀', 'ligne\ndeux']) {
      const encoded = encodeBase64Text(sample);
      expect(encoded.ok).toBe(true);
      if (encoded.ok) expect(decodeBase64Text(encoded.value)).toEqual({ ok: true, value: sample });
    }
  });

  it('accepts missing padding, whitespace and url-safe alphabets', () => {
    expect(decodeBase64Text('YQ')).toEqual({ ok: true, value: 'a' });
    expect(decodeBase64Text('Y Q\n==')).toEqual({ ok: true, value: 'a' });
    const bytes = new TextEncoder().encode('~~~');
    const url = bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_');
    expect(base64ToBytes(url).ok).toBe(true);
  });

  it('explains invalid base64 and binary that is not utf-8', () => {
    expect(decodeBase64Text('!!!!')).toMatchObject({ ok: false, error: { code: 'base64_invalid' } });
    expect(decodeBase64Text('a')).toMatchObject({ ok: false, error: { code: 'base64_invalid' } });
    expect(decodeBase64Text('YQ===')).toMatchObject({ ok: false, error: { code: 'base64_invalid' } });
    const binary = bytesToBase64(new Uint8Array([0xff, 0xfe, 0xfd]));
    expect(decodeBase64Text(binary)).toMatchObject({ ok: false, error: { code: 'base64_not_utf8' } });
  });
});

describe('url encoding', () => {
  it('round-trips unicode and leaves a plus sign as a plus sign', () => {
    expect(encodeUrl('')).toEqual({ ok: true, value: '' });
    expect(decodeUrl('')).toEqual({ ok: true, value: '' });
    expect(encodeUrl('a b')).toEqual({ ok: true, value: 'a%20b' });
    expect(decodeUrl('a%20b')).toEqual({ ok: true, value: 'a b' });
    expect(decodeUrl('a+b')).toEqual({ ok: true, value: 'a+b' });
    const encoded = encodeUrl('café/東京');
    expect(encoded.ok).toBe(true);
    if (encoded.ok) expect(decodeUrl(encoded.value)).toEqual({ ok: true, value: 'café/東京' });
  });

  it('rejects a broken percent escape', () => {
    expect(decodeUrl('%')).toMatchObject({ ok: false, error: { code: 'url_invalid' } });
    expect(decodeUrl('%ZZ')).toMatchObject({ ok: false, error: { code: 'url_invalid' } });
    expect(decodeUrl('100%')).toMatchObject({ ok: false, error: { code: 'url_invalid' } });
  });
});

describe('html entities', () => {
  it('round-trips the five markup characters and keeps unicode', () => {
    const raw = 'café <tag> & "quotes" \'ok\'';
    const encoded = encodeHtml(raw);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.value).toContain('&amp;');
    expect(encoded.value).toContain('&lt;');
    expect(encoded.value).toContain('&gt;');
    expect(encoded.value).toContain('&quot;');
    expect(encoded.value).toContain('&#39;');
    expect(encoded.value).toContain('café');
    expect(decodeHtml(encoded.value)).toEqual({ ok: true, value: raw });
    expect(encodeHtml('')).toEqual({ ok: true, value: '' });
    expect(decodeHtml('')).toEqual({ ok: true, value: '' });
  });

  it('decodes named and numeric entities, including emoji', () => {
    expect(decodeHtml('&eacute;')).toEqual({ ok: true, value: 'é' });
    expect(decodeHtml('&nbsp;')).toEqual({ ok: true, value: '\u00a0' });
    expect(decodeHtml('&#233;')).toEqual({ ok: true, value: 'é' });
    expect(decodeHtml('&#xE9;')).toEqual({ ok: true, value: 'é' });
    expect(decodeHtml('&#x1F600;')).toEqual({ ok: true, value: '😀' });
    expect(decodeHtml('&amp;lt;')).toEqual({ ok: true, value: '&lt;' });
  });

  it('points at the failing character for a bad ampersand, unknown entity or code point', () => {
    expect(decodeHtml('Tom & Jerry')).toMatchObject({
      ok: false,
      error: { code: 'html_bad_ampersand', line: 1, column: 5 },
    });
    expect(decodeHtml('a\n&foo;')).toMatchObject({
      ok: false,
      error: { code: 'html_unknown_entity', line: 2, column: 1, detail: 'foo' },
    });
    expect(decodeHtml('&#x110000;')).toMatchObject({
      ok: false,
      error: { code: 'html_bad_codepoint', line: 1, column: 1 },
    });
    expect(decodeHtml('&#0;')).toMatchObject({ ok: false, error: { code: 'html_bad_codepoint' } });
  });
});
