import { describe, expect, it } from 'vitest';
import { parseHash } from '../src/lib/route';

describe('parseHash', () => {
  it('reads a known route and falls back to images', () => {
    expect(parseHash('')).toBe('images');
    expect(parseHash('#')).toBe('images');
    expect(parseHash('#/')).toBe('images');
    expect(parseHash('#/images')).toBe('images');
    expect(parseHash('#images')).toBe('images');
    expect(parseHash('#/data')).toBe('data');
    expect(parseHash('#/encoding')).toBe('encoding');
    expect(parseHash('#/colors')).toBe('colors');
    expect(parseHash('#/units')).toBe('units');
    expect(parseHash('#/nope')).toBe('images');
    expect(parseHash('#/units?x')).toBe('units');
  });
});
