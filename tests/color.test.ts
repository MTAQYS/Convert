import { describe, expect, it } from 'vitest';
import {
  BLACK,
  WHITE,
  contrast,
  formatHex,
  formatHsl,
  formatOklch,
  formatRatio,
  formatRgb,
  parseHex,
  parseHsl,
  parseOklch,
  parseRgb,
} from '../src/lib/color';

function expectRgb(result: ReturnType<typeof parseHex>, r: number, g: number, b: number) {
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.r).toBe(r);
    expect(result.value.g).toBe(g);
    expect(result.value.b).toBe(b);
  }
}

describe('color parsing', () => {
  it('parses hex, rgb, hsl and oklch forms', () => {
    expectRgb(parseHex('#c4512c'), 196, 81, 44);
    expectRgb(parseHex('#C4512C'), 196, 81, 44);
    expectRgb(parseHex('c4512c'), 196, 81, 44);
    expectRgb(parseHex('#fff'), 255, 255, 255);
    expectRgb(parseRgb('rgb(196, 81, 44)'), 196, 81, 44);
    expectRgb(parseRgb('196 81 44'), 196, 81, 44);
    expectRgb(parseRgb('rgb(50%, 0%, 0%)'), 128, 0, 0);
    expectRgb(parseHsl('hsl(0, 100%, 50%)'), 255, 0, 0);
    expectRgb(parseHsl('120 100% 50%'), 0, 255, 0);
    expectRgb(parseHsl('hsl(360, 100%, 50%)'), 255, 0, 0);
    const oklch = parseOklch('oklch(1 0 0)');
    expectRgb(oklch, 255, 255, 255);
    expectRgb(parseOklch('oklch(0 0 0)'), 0, 0, 0);
  });

  it('round-trips an in-gamut color through every format', () => {
    const parsed = parseHex('#c4512c');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    for (const formatted of [formatHex(parsed.value), formatRgb(parsed.value), formatHsl(parsed.value)]) {
      const again = formatted.startsWith('rgb')
        ? parseRgb(formatted)
        : formatted.startsWith('hsl')
          ? parseHsl(formatted)
          : parseHex(formatted);
      expect(again.ok).toBe(true);
      if (again.ok) {
        expect(Math.abs(again.value.r - parsed.value.r)).toBeLessThanOrEqual(1);
        expect(Math.abs(again.value.g - parsed.value.g)).toBeLessThanOrEqual(1);
        expect(Math.abs(again.value.b - parsed.value.b)).toBeLessThanOrEqual(1);
      }
    }
    const oklch = formatOklch(parsed.value);
    const back = parseOklch(oklch);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.value.outOfGamut).toBe(false);
      expect(Math.abs(back.value.r - 196)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.value.g - 81)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.value.b - 44)).toBeLessThanOrEqual(1);
    }
  });

  it('rejects empty, invalid, out-of-range and alpha colors', () => {
    expect(parseHex('')).toMatchObject({ ok: false, error: { code: 'hex_invalid' } });
    expect(parseHex('#gg0000')).toMatchObject({ ok: false, error: { code: 'hex_invalid' } });
    expect(parseHex('#c4512cff')).toMatchObject({ ok: false, error: { code: 'color_alpha_unsupported' } });
    expect(parseHex('not a color')).toMatchObject({ ok: false, error: { code: 'hex_invalid' } });
    expect(parseRgb('')).toMatchObject({ ok: false, error: { code: 'rgb_invalid' } });
    expect(parseRgb('rgb(300, 0, 0)')).toMatchObject({ ok: false, error: { code: 'rgb_range' } });
    expect(parseRgb('rgb(1, 2, 3, 0.5)')).toMatchObject({ ok: false, error: { code: 'color_alpha_unsupported' } });
    expect(parseHsl('nope')).toMatchObject({ ok: false, error: { code: 'hsl_invalid' } });
    expect(parseHsl('hsl(10, 120%, 10%)')).toMatchObject({ ok: false, error: { code: 'hsl_range' } });
    expect(parseOklch('')).toMatchObject({ ok: false, error: { code: 'oklch_invalid' } });
    expect(parseOklch('oklch(2 0.1 10)')).toMatchObject({ ok: false, error: { code: 'oklch_range' } });
    expect(parseOklch('oklch(0.5 -0.1 10)')).toMatchObject({ ok: false, error: { code: 'oklch_range' } });
  });

  it('flags an OKLCH color outside the sRGB gamut and still returns a clipped preview', () => {
    const parsed = parseOklch('oklch(0.7 0.4 30)');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.outOfGamut).toBe(true);
    expect(parsed.value.r).toBeGreaterThanOrEqual(0);
    expect(parsed.value.r).toBeLessThanOrEqual(255);
  });
});

describe('contrast', () => {
  it('matches the WCAG black and white anchors', () => {
    expect(contrast(BLACK, WHITE).ratio).toBeCloseTo(21, 5);
    expect(contrast(BLACK, WHITE).score).toBe('aaa');
    expect(contrast(WHITE, WHITE).ratio).toBeCloseTo(1, 5);
    expect(contrast(WHITE, WHITE).score).toBe('fail');
    expect(contrast(BLACK, BLACK).score).toBe('fail');
    const gray = parseHex('#767676');
    expect(gray.ok).toBe(true);
    if (gray.ok) {
      expect(contrast(gray.value, WHITE).ratio).toBeCloseTo(4.54, 2);
      expect(contrast(gray.value, WHITE).score).toBe('aa');
    }
  });

  it('formats ratios without a trailing zero', () => {
    expect(formatRatio(21)).toBe('21:1');
    expect(formatRatio(4.54)).toBe('4.54:1');
  });

  it('keeps the interface palette readable', () => {
    const pairs: [string, string, number][] = [
      ['#1c1916', '#f3f1eb', 4.5],
      ['#5c564c', '#f3f1eb', 4.5],
      ['#5c564c', '#faf8f4', 4.5],
      ['#1c1916', '#faf8f4', 4.5],
      ['#fff8f4', '#7c2d12', 4.5],
      ['#7c2d12', '#f3f1eb', 4.5],
      ['#8d1d1d', '#f3f1eb', 4.5],
      ['#8d1d1d', '#f8ecea', 4.5],
      ['#f4f0e8', '#141311', 4.5],
      ['#c4bbae', '#1c1b19', 4.5],
      ['#c4bbae', '#141311', 4.5],
      ['#1b120e', '#e4a484', 4.5],
      ['#f0b4ac', '#141311', 4.5],
      ['#f0b4ac', '#2a1c1a', 4.5],
    ];
    for (const [fg, bg, min] of pairs) {
      const front = parseHex(fg);
      const back = parseHex(bg);
      expect(front.ok && back.ok).toBe(true);
      if (front.ok && back.ok) expect(contrast(front.value, back.value).ratio).toBeGreaterThanOrEqual(min);
    }
  });
});
