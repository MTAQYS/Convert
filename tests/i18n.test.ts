import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../src/lib/errors';
import { formatError, socialMeta, t } from '../src/i18n';
import { CATEGORIES, unitsIn } from '../src/lib/units';
import { ROUTES } from '../src/lib/route';
import { IMAGE_FORMATS } from '../src/lib/image';
import { DATA_FORMATS } from '../src/lib/data/convert';

const fr = JSON.parse(readFileSync(new URL('../src/i18n/fr.json', import.meta.url), 'utf8')) as Record<string, string>;
const en = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url), 'utf8')) as Record<string, string>;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

function usedKeys(): string[] {
  const source = walk(join(process.cwd(), 'src'))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
  const keys = new Set<string>();
  for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) keys.add(match[1]);
  for (const match of source.matchAll(/\bt\(\s*"([^"]+)"/g)) keys.add(match[1]);
  for (const match of source.matchAll(/data-i18n="([^"]+)"/g)) keys.add(match[1]);
  for (const match of source.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const part of match[1].split(',')) {
      const index = part.indexOf(':');
      if (index !== -1) keys.add(part.slice(index + 1).trim());
    }
  }
  for (const match of source.matchAll(/labelKey: '([^']+)'/g)) keys.add(match[1]);
  for (const match of source.matchAll(/labelKey: `([^`$]+)`/g)) keys.add(match[1]);
  return [...keys];
}

describe('i18n catalogues', () => {
  it('uses the same non-empty keys in French and English', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of Object.entries(fr)) {
      expect(value.trim(), key).not.toBe('');
      expect(en[key].trim(), key).not.toBe('');
    }
    const different = Object.keys(fr).filter((key) => fr[key] !== en[key]);
    expect(different.length).toBeGreaterThan(40);
  });

  it('covers every static key used by the interface', () => {
    const missing = usedKeys().filter((key) => !(key in fr));
    expect(missing).toEqual([]);
  });

  it('translates every error code, route, format and unit', () => {
    for (const code of ERROR_CODES) expect(fr[`error.${code}`], code).toBeTruthy();
    for (const route of ROUTES) expect(fr[`tab.${route}`]).toBeTruthy();
    for (const format of [...IMAGE_FORMATS, ...DATA_FORMATS]) expect(fr[`format.${format}`]).toBeTruthy();
    for (const category of CATEGORIES) {
      expect(fr[`units.cat.${category}`]).toBeTruthy();
      for (const unit of unitsIn(category)) {
        expect(fr[`units.${unit}`], unit).toBeTruthy();
        expect(fr[`units.symbol.${unit}`], unit).toBeTruthy();
      }
    }
    for (const score of ['aaa', 'aa', 'aaLarge', 'fail']) expect(fr[`colors.score.${score}`]).toBeTruthy();
  });

  it('fills line and column placeholders', () => {
    const text = formatError({ code: 'json_invalid', line: 4, column: 2 });
    expect(text).toContain('4');
    expect(text).toContain('2');
    expect(t('footer.credit')).toBe('Un outil Dynamogic / A Dynamogic tool');
    expect(en['footer.credit']).toBe(fr['footer.credit']);
  });

  it('switches the title, description, and social locale', () => {
    expect(socialMeta('fr')).toEqual({
      title: 'Convert',
      description: fr['meta.description'],
      imageAlt: fr['meta.imageAlt'],
      locale: 'fr_FR',
      localeAlternate: 'en_US',
    });
    expect(socialMeta('en')).toEqual({
      title: 'Convert',
      description: en['meta.description'],
      imageAlt: en['meta.imageAlt'],
      locale: 'en_US',
      localeAlternate: 'fr_FR',
    });
  });
});
