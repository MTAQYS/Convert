import { err, ok, type ConvertResult } from './errors';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_DIMENSION = 16_384;
export const MAX_PIXELS = 40_000_000;

export const IMAGE_FORMATS = ['png', 'jpeg', 'webp', 'avif'] as const;

export type ImageFormat = (typeof IMAGE_FORMATS)[number];

const EXTENSIONS: Record<string, ImageFormat> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  webp: 'webp',
  avif: 'avif',
};

const MIMES: Record<string, ImageFormat> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export function checkFileSize(bytes: number): ConvertResult<void> {
  if (!Number.isFinite(bytes) || bytes < 0 || bytes > MAX_FILE_BYTES) return err('file_too_large');
  if (bytes === 0) return err('empty_input');
  return ok(undefined);
}

export function detectFormat(fileName: string, mime: string): ConvertResult<ImageFormat> {
  const ext = fileName.split(/[/\\]/).pop()?.split('.').pop()?.toLowerCase() ?? '';
  const fromExt = EXTENSIONS[ext];
  const fromMime = MIMES[mime.toLowerCase().split(';')[0].trim()];
  if (fromMime && fromExt && fromMime !== fromExt) return ok(fromMime);
  const found = fromMime ?? fromExt;
  if (!found) return err('image_type_unsupported');
  return ok(found);
}

export function mimeFor(format: ImageFormat): string {
  if (format === 'jpeg') return 'image/jpeg';
  return `image/${format}`;
}

export function extensionFor(format: ImageFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

export function outputName(inputName: string, format: ImageFormat): string {
  const base = inputName.split(/[/\\]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  const stem = (dot > 0 ? base.slice(0, dot) : dot === 0 ? '' : base).trim();
  const safe = stem.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${safe || 'image'}.${extensionFor(format)}`;
}

export function uniqueFilenames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count === 0) return name;
    const dot = name.lastIndexOf('.');
    if (dot <= 0) return `${name}-${count + 1}`;
    return `${name.slice(0, dot)}-${count + 1}${name.slice(dot)}`;
  });
}

export function normalizeQuality(format: ImageFormat, qualityPercent: number): ConvertResult<number> {
  if (format === 'png') return ok(1);
  if (!Number.isFinite(qualityPercent) || qualityPercent < 1 || qualityPercent > 100) return err('quality_invalid');
  return ok(qualityPercent / 100);
}

export function resolveDimensions(
  srcW: number,
  srcH: number,
  width: number | null,
  height: number | null,
  keepRatio: boolean,
): ConvertResult<{ width: number; height: number }> {
  if (!Number.isFinite(srcW) || !Number.isFinite(srcH) || srcW < 1 || srcH < 1) return err('image_decode_failed');
  if (srcW > MAX_DIMENSION || srcH > MAX_DIMENSION || srcW * srcH > MAX_PIXELS) return err('image_too_many_pixels');
  if (width !== null && (!Number.isInteger(width) || width < 1)) return err('dimension_invalid');
  if (height !== null && (!Number.isInteger(height) || height < 1)) return err('dimension_invalid');

  let w = srcW;
  let h = srcH;
  if (width === null && height === null) {
    // Keep the decoded size.
  } else if (keepRatio) {
    if (width !== null && height !== null) {
      const scale = Math.min(width / srcW, height / srcH);
      w = Math.max(1, Math.round(srcW * scale));
      h = Math.max(1, Math.round(srcH * scale));
    } else if (width !== null) {
      w = width;
      h = Math.max(1, Math.round((srcH * width) / srcW));
    } else if (height !== null) {
      h = height;
      w = Math.max(1, Math.round((srcW * height) / srcH));
    }
  } else {
    w = width ?? srcW;
    h = height ?? srcH;
  }

  if (w > MAX_DIMENSION || h > MAX_DIMENSION || w * h > MAX_PIXELS) return err('dimension_too_large');
  return ok({ width: w, height: h });
}

export function avifEncodeBlocked(supported: boolean, target: ImageFormat): boolean {
  return target === 'avif' && !supported;
}

export function parsePixel(input: string): ConvertResult<number | null> {
  const trimmed = input.trim();
  if (trimmed === '') return ok(null);
  if (!/^\d+$/.test(trimmed)) return err('dimension_invalid');
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1) return err('dimension_invalid');
  if (value > MAX_DIMENSION) return err('dimension_too_large');
  return ok(value);
}
