import { err, ok, type ConvertResult } from './errors';

export type RGB = { r: number; g: number; b: number };

export type ColorValue = RGB & { outOfGamut: boolean };

export type ContrastScore = 'aaa' | 'aa' | 'aaLarge' | 'fail';

export type Contrast = { ratio: number; score: ContrastScore };

export const BLACK: RGB = { r: 0, g: 0, b: 0 };
export const WHITE: RGB = { r: 255, g: 255, b: 255 };

export function parseHex(input: string): ConvertResult<ColorValue> {
  const raw = input.trim();
  if (raw === '') return err('hex_invalid');
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{4}$/.test(hex) || /^[0-9a-fA-F]{8}$/.test(hex)) return err('color_alpha_unsupported');
  if (!/^[0-9a-fA-F]{3}$/.test(hex) && !/^[0-9a-fA-F]{6}$/.test(hex)) return err('hex_invalid');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return ok({
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
    outOfGamut: false,
  });
}

export function parseRgb(input: string): ConvertResult<ColorValue> {
  const body = unwrapFunction(input, ['rgb', 'rgba']);
  if (body === null) return err('rgb_invalid');
  if (body.alpha) return err('color_alpha_unsupported');
  if (body.parts.length !== 3) return err('rgb_invalid');
  const channels: number[] = [];
  for (const part of body.parts) {
    const parsed = parseRgbChannel(part);
    if (!parsed.ok) return parsed;
    channels.push(parsed.value);
  }
  return ok({ r: channels[0], g: channels[1], b: channels[2], outOfGamut: false });
}

export function parseHsl(input: string): ConvertResult<ColorValue> {
  const body = unwrapFunction(input, ['hsl', 'hsla']);
  if (body === null) return err('hsl_invalid');
  if (body.alpha) return err('color_alpha_unsupported');
  if (body.parts.length !== 3) return err('hsl_invalid');
  const hue = parseAngle(body.parts[0]);
  const sat = parsePercent(body.parts[1], true);
  const light = parsePercent(body.parts[2], true);
  if (hue === null || sat === null || light === null) return err('hsl_invalid');
  if (sat < 0 || sat > 100 || light < 0 || light > 100) return err('hsl_range');
  const rgb = hslToRgb(hue, sat / 100, light / 100);
  return ok({ ...rgb, outOfGamut: false });
}

export function parseOklch(input: string): ConvertResult<ColorValue> {
  const body = unwrapFunction(input, ['oklch']);
  if (body === null) return err('oklch_invalid');
  if (body.alpha) return err('color_alpha_unsupported');
  if (body.parts.length !== 3) return err('oklch_invalid');
  const lightness = parseOklchLightness(body.parts[0]);
  const chroma = parseOklchChroma(body.parts[1]);
  const hue = parseAngle(body.parts[2]);
  if (lightness === null || chroma === null || hue === null) return err('oklch_invalid');
  if (lightness < 0 || lightness > 1 || chroma < 0) return err('oklch_range');
  return ok(oklchToRgb(lightness, chroma, hue));
}

export function formatHex(rgb: RGB): string {
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function formatRgb(rgb: RGB): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

export function formatHsl(rgb: RGB): string {
  const hsl = rgbToHsl(rgb);
  return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
}

export function formatOklch(rgb: RGB): string {
  const { L, C, H } = rgbToOklch(rgb);
  const chroma = C < 0.0005 ? 0 : C;
  const hue = chroma === 0 ? 0 : H;
  return `oklch(${L.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`;
}

export function contrast(a: RGB, b: RGB): Contrast {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  let score: ContrastScore = 'fail';
  if (ratio >= 7) score = 'aaa';
  else if (ratio >= 4.5) score = 'aa';
  else if (ratio >= 3) score = 'aaLarge';
  return { ratio, score };
}

export function formatRatio(ratio: number): string {
  const digits = ratio >= 10 ? 1 : 2;
  const text = ratio.toFixed(digits).replace(/\.0$/, '').replace(/(\.\d)0$/, '$1');
  return `${text}:1`;
}

function toHex(channel: number): string {
  return clamp8(channel).toString(16).padStart(2, '0');
}

function clamp8(channel: number): number {
  return Math.min(255, Math.max(0, Math.round(channel)));
}

function unwrapFunction(
  input: string,
  names: string[],
): { parts: string[]; alpha: boolean } | null {
  let text = input.trim();
  if (text === '') return null;
  const fn = new RegExp(`^(${names.join('|')})\\((.*)\\)$`, 'i');
  const match = fn.exec(text);
  if (match) text = match[2].trim();
  if (text.includes('/')) return { parts: [], alpha: true };
  const parts = text.includes(',')
    ? text.split(',').map((part) => part.trim()).filter((part) => part !== '')
    : text.split(/\s+/).filter((part) => part !== '');
  if (parts.length === 4) return { parts, alpha: true };
  return { parts, alpha: false };
}

function parseRgbChannel(part: string): ConvertResult<number> {
  if (part.endsWith('%')) {
    const value = Number(part.slice(0, -1).replace(',', '.'));
    if (!Number.isFinite(value)) return err('rgb_invalid');
    if (value < 0 || value > 100) return err('rgb_range');
    return ok(clamp8((value / 100) * 255));
  }
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(part)) return err('rgb_invalid');
  const value = Number(part);
  if (!Number.isFinite(value)) return err('rgb_invalid');
  if (value < 0 || value > 255) return err('rgb_range');
  return ok(clamp8(value));
}

function parsePercent(part: string, bareIsPercent: boolean): number | null {
  const percent = part.endsWith('%');
  const raw = (percent ? part.slice(0, -1) : part).replace(',', '.');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (percent || bareIsPercent) return value;
  return value <= 1 ? value * 100 : value;
}

function parseAngle(part: string): number | null {
  const raw = part.replace(/deg$/i, '').replace(',', '.');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return ((value % 360) + 360) % 360;
}

function parseOklchLightness(part: string): number | null {
  const percent = part.endsWith('%');
  const raw = (percent ? part.slice(0, -1) : part).replace(',', '.');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return percent ? value / 100 : value;
}

function parseOklchChroma(part: string): number | null {
  const percent = part.endsWith('%');
  const raw = (percent ? part.slice(0, -1) : part).replace(',', '.');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  // CSS Color 4: 100% chroma = 0.4
  return percent ? (value / 100) * 0.4 : value;
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return { r: clamp8((r + m) * 255), g: clamp8((g + m) * 255), b: clamp8((b + m) * 255) };
}

function rgbToHsl(rgb: RGB): { h: number; s: number; l: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgbFloat(channel: number): number {
  const c = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
  return c;
}

export function relativeLuminance(rgb: RGB): number {
  return 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b);
}

function rgbToOklch(rgb: RGB): { L: number; C: number; H: number } {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(a, bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

function oklchToRgb(L: number, C: number, H: number): ColorValue {
  const hue = (H * Math.PI) / 180;
  const a = C * Math.cos(hue);
  const b = C * Math.sin(hue);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const r = linearToSrgbFloat(lr);
  const g = linearToSrgbFloat(lg);
  const bl = linearToSrgbFloat(lb);
  const outOfGamut = r < -1e-4 || r > 1 + 1e-4 || g < -1e-4 || g > 1 + 1e-4 || bl < -1e-4 || bl > 1 + 1e-4;
  return { r: clamp8(r * 255), g: clamp8(g * 255), b: clamp8(bl * 255), outOfGamut };
}
