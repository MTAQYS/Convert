import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import {
  MAX_FILE_BYTES,
  avifEncodeBlocked,
  checkFileSize,
  detectFormat,
  normalizeQuality,
  outputName,
  parsePixel,
  resolveDimensions,
  uniqueFilenames,
} from '../src/lib/image';
import { buildZip } from '../src/lib/zip';

describe('image files', () => {
  it('accepts 50 MB and refuses anything larger or empty', () => {
    expect(checkFileSize(MAX_FILE_BYTES)).toEqual({ ok: true, value: undefined });
    expect(checkFileSize(MAX_FILE_BYTES + 1)).toMatchObject({ ok: false, error: { code: 'file_too_large' } });
    expect(checkFileSize(0)).toMatchObject({ ok: false, error: { code: 'empty_input' } });
    expect(checkFileSize(-1)).toMatchObject({ ok: false, error: { code: 'file_too_large' } });
  });

  it('detects png, jpeg, webp and avif, and refuses other types', () => {
    expect(detectFormat('photo.PNG', 'image/png')).toEqual({ ok: true, value: 'png' });
    expect(detectFormat('photo.jpg', '')).toEqual({ ok: true, value: 'jpeg' });
    expect(detectFormat('photo.jpeg', 'image/jpeg')).toEqual({ ok: true, value: 'jpeg' });
    expect(detectFormat('photo.webp', 'image/webp')).toEqual({ ok: true, value: 'webp' });
    expect(detectFormat('photo.avif', 'image/avif')).toEqual({ ok: true, value: 'avif' });
    expect(detectFormat('photo.png', 'application/octet-stream')).toEqual({ ok: true, value: 'png' });
    expect(detectFormat('photo.txt', 'image/png')).toEqual({ ok: true, value: 'png' });
    expect(detectFormat('photo.gif', 'image/gif')).toMatchObject({ ok: false, error: { code: 'image_type_unsupported' } });
    expect(detectFormat('photo.heic', '')).toMatchObject({ ok: false, error: { code: 'image_type_unsupported' } });
    expect(detectFormat('photo', '')).toMatchObject({ ok: false, error: { code: 'image_type_unsupported' } });
  });

  it('builds safe output names, including unicode, and avoids zip collisions', () => {
    expect(outputName('photo.png', 'webp')).toBe('photo.webp');
    expect(outputName('my file.jpg', 'png')).toBe('my-file.png');
    expect(outputName('café.jpg', 'webp')).toBe('café.webp');
    expect(outputName('.jpg', 'png')).toBe('image.png');
    expect(outputName('archive.tar.gz', 'png')).toBe('archive.tar.png');
    expect(uniqueFilenames(['a.png', 'a.png', 'a.png'])).toEqual(['a.png', 'a-2.png', 'a-3.png']);
  });

  it('resolves resize dimensions and validates quality', () => {
    expect(resolveDimensions(100, 50, 200, null, true)).toEqual({ ok: true, value: { width: 200, height: 100 } });
    expect(resolveDimensions(100, 50, null, 25, true)).toEqual({ ok: true, value: { width: 50, height: 25 } });
    expect(resolveDimensions(100, 50, 200, 50, true)).toEqual({ ok: true, value: { width: 100, height: 50 } });
    expect(resolveDimensions(100, 50, 200, 50, false)).toEqual({ ok: true, value: { width: 200, height: 50 } });
    expect(resolveDimensions(100, 50, null, null, true)).toEqual({ ok: true, value: { width: 100, height: 50 } });
    expect(resolveDimensions(100, 50, 0, null, true)).toMatchObject({ ok: false, error: { code: 'dimension_invalid' } });
    expect(resolveDimensions(100, 50, 1.5, null, true)).toMatchObject({ ok: false, error: { code: 'dimension_invalid' } });
    expect(resolveDimensions(20_000, 10, null, null, true)).toMatchObject({
      ok: false,
      error: { code: 'image_too_many_pixels' },
    });
    expect(resolveDimensions(100, 50, 20_000, null, true)).toMatchObject({
      ok: false,
      error: { code: 'dimension_too_large' },
    });
    expect(parsePixel('')).toEqual({ ok: true, value: null });
    expect(parsePixel('12')).toEqual({ ok: true, value: 12 });
    expect(parsePixel('12.5')).toMatchObject({ ok: false, error: { code: 'dimension_invalid' } });
    expect(normalizeQuality('png', 50)).toEqual({ ok: true, value: 1 });
    expect(normalizeQuality('jpeg', 85)).toEqual({ ok: true, value: 0.85 });
    expect(normalizeQuality('webp', 1)).toEqual({ ok: true, value: 0.01 });
    expect(normalizeQuality('avif', 100)).toEqual({ ok: true, value: 1 });
    expect(normalizeQuality('jpeg', 0)).toMatchObject({ ok: false, error: { code: 'quality_invalid' } });
    expect(normalizeQuality('jpeg', Number.NaN)).toMatchObject({ ok: false, error: { code: 'quality_invalid' } });
    expect(avifEncodeBlocked(false, 'avif')).toBe(true);
    expect(avifEncodeBlocked(true, 'avif')).toBe(false);
    expect(avifEncodeBlocked(false, 'webp')).toBe(false);
  });
});

describe('zip', () => {
  it('packs files and renames duplicates', () => {
    const zip = buildZip([
      { name: 'a.txt', data: new TextEncoder().encode('one') },
      { name: 'a.txt', data: new TextEncoder().encode('two') },
    ]);
    expect(zip.ok).toBe(true);
    if (!zip.ok) return;
    const entries = unzipSync(zip.value);
    expect(new TextDecoder().decode(entries['a.txt'])).toBe('one');
    expect(new TextDecoder().decode(entries['a-2.txt'])).toBe('two');
    expect(buildZip([])).toMatchObject({ ok: false, error: { code: 'empty_input' } });
  });
});
