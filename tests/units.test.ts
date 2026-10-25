import { describe, expect, it } from 'vitest';
import { parseNumber } from '../src/lib/number';
import { CATEGORIES, convertAll, convertUnit, formatByteSize, unitsIn } from '../src/lib/units';

function convert(input: string, from: string, to: string) {
  const parsed = parseNumber(input);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error('number');
  return convertUnit(parsed.value, from, to);
}

describe('units', () => {
  it('converts length, weight, time and speed', () => {
    expect(convert('1', 'km', 'm')).toEqual({ ok: true, value: 1000 });
    expect(convert('1', 'in', 'cm').ok).toBe(true);
    const inch = convert('1', 'in', 'cm');
    if (inch.ok) expect(inch.value).toBeCloseTo(2.54, 8);
    expect(convert('1', 'kg', 'g')).toEqual({ ok: true, value: 1000 });
    expect(convert('1', 'lb', 'oz').ok).toBe(true);
    const pound = convert('1', 'lb', 'oz');
    if (pound.ok) expect(pound.value).toBeCloseTo(16, 6);
    expect(convert('1', 'day', 'h')).toEqual({ ok: true, value: 24 });
    expect(convert('1', 'week', 'day')).toEqual({ ok: true, value: 7 });
    expect(convert('1', 'kmh', 'mps').ok).toBe(true);
    const speed = convert('1', 'mps', 'kmh');
    if (speed.ok) expect(speed.value).toBeCloseTo(3.6, 8);
    expect(convert('1,5', 'km', 'm')).toEqual({ ok: true, value: 1500 });
  });

  it('converts temperature, including the point where the scales meet', () => {
    expect(convert('0', 'C', 'F')).toEqual({ ok: true, value: 32 });
    expect(convert('100', 'C', 'F')).toEqual({ ok: true, value: 212 });
    expect(convert('-40', 'C', 'F')).toEqual({ ok: true, value: -40 });
    const kelvin = convert('0', 'C', 'K');
    expect(kelvin.ok).toBe(true);
    if (kelvin.ok) expect(kelvin.value).toBeCloseTo(273.15, 8);
    expect(convert('0', 'K', 'C').ok).toBe(true);
    const zero = convert('0', 'K', 'C');
    if (zero.ok) expect(zero.value).toBeCloseTo(-273.15, 8);
  });

  it('converts data sizes on both the 1000 and 1024 bases', () => {
    expect(convert('1', 'kB', 'B')).toEqual({ ok: true, value: 1000 });
    expect(convert('1', 'KiB', 'B')).toEqual({ ok: true, value: 1024 });
    expect(convert('1', 'MiB', 'KiB')).toEqual({ ok: true, value: 1024 });
    expect(convert('1', 'TB', 'GB')).toEqual({ ok: true, value: 1000 });
    const tebi = convert('1', 'TB', 'TiB');
    expect(tebi.ok).toBe(true);
    if (tebi.ok) expect(tebi.value).toBeCloseTo(1e12 / 2 ** 40, 8);
    expect(formatByteSize(1536)).toEqual({ amount: '1.536', unit: 'kB' });
    expect(formatByteSize(500)).toEqual({ amount: '500', unit: 'B' });
  });

  it('rejects empty, negative, absolute-zero, unknown and huge values', () => {
    expect(parseNumber('').ok).toBe(false);
    expect(convertUnit(-1, 'm', 'cm')).toMatchObject({ ok: false, error: { code: 'number_negative' } });
    expect(convertUnit(-280, 'C', 'K')).toMatchObject({ ok: false, error: { code: 'below_absolute_zero' } });
    expect(convertUnit(-1, 'K', 'C')).toMatchObject({ ok: false, error: { code: 'below_absolute_zero' } });
    expect(convertUnit(1, 'furlong', 'm')).toMatchObject({ ok: false, error: { code: 'unknown_unit' } });
    expect(convertUnit(1, 'm', 'kg')).toMatchObject({ ok: false, error: { code: 'unit_mismatch' } });
    expect(convertUnit(1e308, 'km', 'mm')).toMatchObject({ ok: false, error: { code: 'number_too_large' } });
    expect(convertUnit(1e16, 'TB', 'B')).toMatchObject({ ok: false, error: { code: 'number_too_large' } });
    expect(convertUnit(Number.NaN, 'm', 'cm')).toMatchObject({ ok: false, error: { code: 'number_too_large' } });
  });

  it('lists every unit in the selected category', () => {
    expect(CATEGORIES).toHaveLength(6);
    const all = convertAll(1, 'm');
    expect(all.ok).toBe(true);
    if (all.ok) expect(all.value.map((row) => row.unit)).toEqual(unitsIn('length'));
    expect(unitsIn('data')).toEqual(['B', 'kB', 'MB', 'GB', 'TB', 'KiB', 'MiB', 'GiB', 'TiB']);
  });
});
