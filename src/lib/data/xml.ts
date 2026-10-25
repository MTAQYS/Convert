import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { err, ok, type ConvertResult } from '../errors';
import { checkTextSize, stripBom } from '../text';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  ignoreDeclaration: true,
  ignorePiTags: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  allowBooleanAttributes: false,
});

function builder(pretty: boolean): XMLBuilder {
  return new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    textNodeName: '#text',
    format: pretty,
    indentBy: '  ',
    suppressEmptyNode: false,
  });
}

export function parseXml(input: string): ConvertResult<unknown> {
  const text = stripBom(input).trim();
  const sized = checkTextSize(text);
  if (!sized.ok) return sized;
  if (text === '') return err('empty_input');
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) return err('xml_doctype');
  const validation = XMLValidator.validate(text);
  if (validation !== true) {
    return err('xml_invalid', { line: validation.err.line, column: validation.err.col });
  }
  try {
    const parsed: unknown = parser.parse(text);
    if (parsed === undefined || parsed === null || (typeof parsed === 'object' && Object.keys(parsed as object).length === 0)) {
      return err('xml_invalid');
    }
    return ok(coerceTree(parsed));
  } catch {
    return err('xml_invalid');
  }
}

export function stringifyXml(value: unknown, pretty: boolean): ConvertResult<string> {
  try {
    const wrapped = prepareXml(wrapForXml(value));
    const body = builder(pretty).build(wrapped);
    if (typeof body !== 'string' || body.trim() === '') return err('xml_invalid');
    const declaration = '<?xml version="1.0" encoding="UTF-8"?>';
    return ok(pretty ? `${declaration}\n${body.trim()}\n` : `${declaration}${body.trim()}`);
  } catch {
    return err('xml_invalid');
  }
}

function wrapForXml(value: unknown): unknown {
  if (Array.isArray(value)) return { root: { item: value } };
  if (value === null || typeof value !== 'object') return { root: value };
  const keys = Object.keys(value as object);
  if (keys.length !== 1 || keys[0].startsWith('@') || keys[0] === '#text') return { root: value };
  return value;
}

function prepareXml(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => prepareXml(item));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = key.startsWith('@') ? (item === null || item === undefined ? '' : String(item)) : prepareXml(item);
    }
    return out;
  }
  return String(value);
}

function coerceTree(value: unknown): unknown {
  if (typeof value === 'string') return coerceScalar(value);
  if (Array.isArray(value)) return value.map((item) => coerceTree(item));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = Object.create(null);
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = key.startsWith('@') ? String(item) : coerceTree(item);
    }
    return out;
  }
  return value;
}

function coerceScalar(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return value;
}
