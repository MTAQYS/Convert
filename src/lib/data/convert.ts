import { parseDocument, stringify } from 'yaml';
import { err, ok, type ConvertResult } from '../errors';
import { checkTextSize, stripBom } from '../text';
import { parseCsv, stringifyCsv } from './csv';
import { parseJson, stringifyJson } from './json';
import { parseXml, stringifyXml } from './xml';

export const DATA_FORMATS = ['json', 'csv', 'yaml', 'xml'] as const;

export type DataFormat = (typeof DATA_FORMATS)[number];

export function convertData(input: string, from: DataFormat, to: DataFormat, pretty: boolean): ConvertResult<string> {
  try {
    const parsed = parseData(input, from);
    if (!parsed.ok) return parsed;
    return stringifyData(parsed.value, to, pretty);
  } catch {
    return err('generic');
  }
}

function parseData(input: string, format: DataFormat): ConvertResult<unknown> {
  if (format === 'json') return parseJson(input);
  if (format === 'csv') return parseCsv(input);
  if (format === 'yaml') return parseYaml(input);
  return parseXml(input);
}

function stringifyData(value: unknown, format: DataFormat, pretty: boolean): ConvertResult<string> {
  const finite = assertData(value);
  if (!finite.ok) return finite;
  if (format === 'json') return stringifyJson(value, pretty);
  if (format === 'csv') return stringifyCsv(value);
  if (format === 'yaml') return stringifyYaml(value, pretty);
  return stringifyXml(value, pretty);
}

export function parseYaml(input: string): ConvertResult<unknown> {
  const text = stripBom(input);
  const sized = checkTextSize(text);
  if (!sized.ok) return sized;
  if (text.trim() === '') return err('empty_input');
  try {
    const doc = parseDocument(text, { prettyErrors: true, strict: true });
    if (doc.errors.length > 0) {
      const failure = doc.errors[0];
      const pos = failure.linePos?.[0];
      return err('yaml_invalid', { line: pos?.line, column: pos?.col });
    }
    const value: unknown = doc.toJS({ maxAliasCount: 50 });
    if (value === undefined) return err('empty_input');
    return assertData(value);
  } catch {
    return err('yaml_invalid');
  }
}

export function stringifyYaml(value: unknown, pretty: boolean): ConvertResult<string> {
  try {
    const text = stringify(value, {
      aliasDuplicateObjects: false,
      collectionStyle: pretty ? 'block' : 'flow',
      lineWidth: pretty ? 80 : 0,
      indent: 2,
    });
    if (typeof text !== 'string') return err('yaml_invalid');
    return ok(text.endsWith('\n') ? text : `${text}\n`);
  } catch {
    return err('yaml_invalid');
  }
}

function assertData(value: unknown, depth = 0): ConvertResult<unknown> {
  if (depth > 200) return err('generic');
  if (value === null) return ok(value);
  const kind = typeof value;
  if (kind === 'string' || kind === 'boolean') return ok(value);
  if (kind === 'number') return Number.isFinite(value) ? ok(value) : err('number_too_large');
  if (kind === 'bigint') return err('number_too_large');
  if (Array.isArray(value)) {
    for (const item of value) {
      const checked = assertData(item, depth + 1);
      if (!checked.ok) return checked;
    }
    return ok(value);
  }
  if (kind === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const checked = assertData(item, depth + 1);
      if (!checked.ok) return checked;
    }
    return ok(value);
  }
  return err('generic');
}
