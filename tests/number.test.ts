import { describe, expect, it } from 'vitest';
import { formatQuantity, parseNumber } from '../src/lib/number';

describe('parseNumber', () => {
  it('rejects empty input', () => {
    expect(parseNumber('')).toEqual({ ok: false, error: { code: 'empty_value' } });
    expect(parseNumber('   ').ok).toBe(false);
  });

  it('parses integers, signs, decimals and scientific notation', () => {
    expect(parseNumber('42')).toEqual({ ok: true, value: 42 });
    expect(parseNumber('-40')).toEqual({ ok: true, value: -40 });
    expect(parseNumber('+7')).toEqual({ ok: true, value: 7 });
    expect(parseNumber('1.5')).toEqual({ ok: true, value: 1.5 });
    expect(parseNumber('.5')).toEqual({ ok: true, value: 0.5 });
    expect(parseNumber('1e3')).toEqual({ ok: true, value: 1000 });
    expect(parseNumber('1.5e-2')).toEqual({ ok: true, value: 0.015 });
    expect(parseNumber('-1.5e-2')).toEqual({ ok: true, value: -0.015 });
  });

  it('accepts a French decimal comma and spaces as thousands separators', () => {
    expect(parseNumber('12,5')).toEqual({ ok: true, value: 12.5 });
    expect(parseNumber('1 500')).toEqual({ ok: true, value: 1500 });
    expect(parseNumber('1\u00a0500,25')).toEqual({ ok: true, value: 1500.25 });
    expect(parseNumber('1.500,5')).toEqual({ ok: true, value: 1500.5 });
    expect(parseNumber('1,500.5')).toEqual({ ok: true, value: 1500.5 });
  });

  it('rejects invalid formats, unicode digits and huge numbers', () => {
    expect(parseNumber('abc').ok).toBe(false);
    expect(parseNumber('12px')).toMatchObject({ ok: false, error: { code: 'invalid_number' } });
    expect(parseNumber('１').ok).toBe(false);
    expect(parseNumber('١').ok).toBe(false);
    expect(parseNumber('1,2,3').ok).toBe(false);
    expect(parseNumber('--1').ok).toBe(false);
    expect(parseNumber('1e').ok).toBe(false);
    expect(parseNumber('NaN').ok).toBe(false);
    expect(parseNumber('Infinity').ok).toBe(false);
    expect(parseNumber('1e309')).toMatchObject({ ok: false, error: { code: 'number_too_large' } });
    expect(parseNumber('9'.repeat(400))).toMatchObject({ ok: false, error: { code: 'number_too_large' } });
  });
});

describe('formatQuantity', () => {
  it('trims trailing zeros and switches to scientific notation at the extremes', () => {
    expect(formatQuantity(0)).toBe('0');
    expect(formatQuantity(-0)).toBe('0');
    expect(formatQuantity(1500)).toBe('1500');
    expect(formatQuantity(1.5)).toBe('1.5');
    expect(formatQuantity(0.000001)).toBe('0.000001');
    expect(formatQuantity(1e-7)).toBe('1e-7');
    expect(formatQuantity(1e15)).toBe('1e+15');
    expect(formatQuantity(-40)).toBe('-40');
  });
});
