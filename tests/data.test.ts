import { describe, expect, it } from 'vitest';
import { convertData } from '../src/lib/data/convert';
import { parseCsv } from '../src/lib/data/csv';
import { parseJson } from '../src/lib/data/json';

function valueOf(input: string, from: 'json' | 'csv' | 'yaml' | 'xml', to: 'json' | 'csv' | 'yaml' | 'xml' = 'json') {
  const result = convertData(input, from, to, true);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  return to === 'json' ? (JSON.parse(result.value) as unknown) : result.value;
}

describe('json', () => {
  it('parses objects, arrays, unicode escapes and a leading BOM', () => {
    expect(parseJson('\uFEFF{"café":"東京"}')).toEqual({ ok: true, value: { café: '東京' } });
    expect(parseJson('"😀"')).toEqual({ ok: true, value: '😀' });
    expect(parseJson('"\\u00e9"')).toEqual({ ok: true, value: 'é' });
    expect(parseJson('"\\uD83D\\uDE00"')).toEqual({ ok: true, value: '😀' });
    const samples = ['null', 'true', 'false', '0', '[]', '{}', '{"a":[1,{"b":"c"}]}'];
    for (const sample of samples) {
      expect(parseJson(sample)).toEqual({ ok: true, value: JSON.parse(sample) });
    }
  });

  it('points at the failing line for trailing commas, broken values and trailing junk', () => {
    expect(parseJson('')).toMatchObject({ ok: false, error: { code: 'empty_input' } });
    expect(parseJson('   ')).toMatchObject({ ok: false, error: { code: 'empty_input' } });
    const comma = parseJson('{"a":1,}');
    expect(comma).toMatchObject({ ok: false, error: { code: 'json_invalid', line: 1, column: 8 } });
    const multiline = parseJson('{\n  "a": 1,\n}\n');
    expect(multiline).toMatchObject({ ok: false, error: { code: 'json_invalid', line: 3 } });
    const broken = parseJson('{\n  "a": 1,\n  "b": \n}\n');
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.error.line).toBe(4);
    expect(parseJson('{"a":1} extra')).toMatchObject({ ok: false, error: { code: 'json_invalid' } });
    expect(parseJson("'a'")).toMatchObject({ ok: false, error: { code: 'json_invalid', line: 1 } });
    expect(parseJson('01')).toMatchObject({ ok: false, error: { code: 'json_invalid' } });
  });

  it('rejects a number too large to represent and a very deep document', () => {
    expect(parseJson('1e309')).toMatchObject({ ok: false, error: { code: 'number_too_large' } });
    const deep = `${'['.repeat(101)}${']'.repeat(101)}`;
    expect(parseJson(deep)).toMatchObject({ ok: false, error: { code: 'json_invalid' } });
  });
});

describe('csv', () => {
  it('round-trips objects, quotes, unicode and nested values', () => {
    const rows = [
      { name: 'café', city: '東京', note: 'a "quote"', count: 2 },
      { name: '😀', city: 'Lyon', note: 'line\nbreak', count: 0 },
    ];
    const csv = convertData(JSON.stringify(rows), 'json', 'csv', true);
    expect(csv.ok).toBe(true);
    if (!csv.ok) return;
    expect(parseCsv(csv.value)).toEqual({ ok: true, value: rows });
  });

  it('detects a semicolon delimiter and a French decimal comma', () => {
    const parsed = parseCsv('nom;taille\nAda;1,75\n');
    expect(parsed).toEqual({ ok: true, value: [{ nom: 'Ada', taille: 1.75 }] });
  });

  it('keeps quoted numbers as text and a proto column as data', () => {
    const parsed = parseCsv('code,__proto__\n"001","kept"\n');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(JSON.stringify(parsed.value)).toBe('[{"code":"001","__proto__":"kept"}]');
  });

  it('reports an unclosed quote and a row with too many columns', () => {
    const quote = parseCsv('name\n"ada\n');
    expect(quote).toMatchObject({ ok: false, error: { code: 'csv_unclosed_quote', line: 2 } });
    const wide = parseCsv('name,city\nAda,Lyon,extra\n');
    expect(wide).toMatchObject({ ok: false, error: { code: 'csv_invalid', line: 2 } });
    expect(parseCsv('')).toMatchObject({ ok: false, error: { code: 'empty_input' } });
    expect(parseCsv('   \n')).toMatchObject({ ok: false, error: { code: 'empty_input' } });
  });
});

describe('yaml and xml', () => {
  it('round-trips yaml, including unicode', () => {
    const source = { name: 'café', list: ['東京', '😀'], n: 1, ok: true };
    const yaml = convertData(JSON.stringify(source), 'json', 'yaml', true);
    expect(yaml.ok).toBe(true);
    if (!yaml.ok) return;
    expect(yaml.value).toContain('café');
    expect(valueOf(yaml.value, 'yaml')).toEqual(source);
    const compact = convertData(JSON.stringify(source), 'json', 'yaml', false);
    expect(compact.ok).toBe(true);
    if (compact.ok) expect(compact.value).toContain('{');
  });

  it('points at the yaml line that failed', () => {
    const broken = convertData('foo: [\n  1,\n', 'yaml', 'json', true);
    expect(broken.ok).toBe(false);
    if (!broken.ok) {
      expect(broken.error.code).toBe('yaml_invalid');
      expect(broken.error.line).toBeGreaterThan(0);
    }
    const tab = convertData('a:\n\tb: 1\n', 'yaml', 'json', true);
    expect(tab).toMatchObject({ ok: false, error: { code: 'yaml_invalid', line: 2 } });
    expect(convertData('', 'yaml', 'json', true)).toMatchObject({ ok: false, error: { code: 'empty_input' } });
    expect(convertData('1e309', 'yaml', 'json', true)).toMatchObject({ ok: false, error: { code: 'number_too_large' } });
  });

  it('round-trips xml elements, attributes, numbers and escaped text', () => {
    const xml = '<note id="1">café &amp; 東京</note>';
    expect(valueOf(xml, 'xml')).toEqual({ note: { '@id': '1', '#text': 'café & 東京' } });
    const back = convertData(JSON.stringify({ note: { '@id': '1', '#text': 'a < b' } }), 'json', 'xml', false);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.value).toContain('&lt;');
      expect(valueOf(back.value, 'xml')).toEqual({ note: { '@id': '1', '#text': 'a < b' } });
    }
    expect(valueOf('<n>42</n>', 'xml')).toEqual({ n: 42 });
    expect(valueOf('<n>007</n>', 'xml')).toEqual({ n: '007' });
    expect(valueOf('<root>&#x1F600;</root>', 'xml')).toEqual({ root: '😀' });
  });

  it('reports the xml line and refuses a doctype', () => {
    const broken = convertData('<root>\n  <a></b>\n</root>', 'xml', 'json', true);
    expect(broken).toMatchObject({ ok: false, error: { code: 'xml_invalid', line: 2 } });
    expect(convertData('<a></a><b></b>', 'xml', 'json', true)).toMatchObject({
      ok: false,
      error: { code: 'xml_invalid' },
    });
    expect(convertData('<!DOCTYPE note><note>ok</note>', 'xml', 'json', true)).toMatchObject({
      ok: false,
      error: { code: 'xml_doctype' },
    });
    expect(convertData('', 'xml', 'json', true)).toMatchObject({ ok: false, error: { code: 'empty_input' } });
  });

  it('wraps a json array in a single xml root', () => {
    const xml = convertData('["a","b"]', 'json', 'xml', true);
    expect(xml.ok).toBe(true);
    if (!xml.ok) return;
    expect(xml.value).toContain('<root>');
    expect(xml.value).toContain('<item>a</item>');
    expect(valueOf(xml.value, 'xml')).toEqual({ root: { item: ['a', 'b'] } });
  });
});
