import { err, ok, type ConvertResult } from './errors';

/**
 * Accepts ASCII digits, an optional sign, a dot or a comma as the decimal
 * mark, spaces as thousands separators, and scientific notation.
 * Fullwidth digits and other scripts are rejected so the failure is explicit.
 */
export function parseNumber(input: string): ConvertResult<number> {
  if (input.trim() === '') return err('empty_value');
  const normalized = normalizeNumeric(input);
  if (normalized === null) return err('invalid_number');
  const value = Number(normalized);
  if (!Number.isFinite(value)) return err('number_too_large');
  return ok(value);
}

function normalizeNumeric(input: string): string | null {
  let body = input.trim().replace(/[\s\u00a0\u202f]/g, '');
  if (body === '') return null;

  let sign = '';
  if (body.startsWith('+') || body.startsWith('-')) {
    sign = body.startsWith('-') ? '-' : '';
    body = body.slice(1);
  }
  if (body === '' || body.includes('+') || body.includes('-')) {
    const exp = body.search(/[eE]/);
    if (exp === -1) return null;
  }

  const expIndex = body.search(/[eE]/);
  const coeff = expIndex === -1 ? body : body.slice(0, expIndex);
  const exp = expIndex === -1 ? '' : body.slice(expIndex);
  if (coeff === '') return null;
  if (exp && !/^[eE][+-]?\d+$/.test(exp)) return null;

  const decimal = normalizeCoefficient(coeff);
  if (decimal === null) return null;
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(decimal)) return null;
  return sign + decimal + exp.toLowerCase();
}

function normalizeCoefficient(coeff: string): string | null {
  const commas = count(coeff, ',');
  const dots = count(coeff, '.');
  if (commas === 0 && dots === 0) {
    return /^\d+$/.test(coeff) ? coeff : null;
  }
  if (commas > 0 && dots > 0) {
    const lastComma = coeff.lastIndexOf(',');
    const lastDot = coeff.lastIndexOf('.');
    if (lastComma > lastDot) {
      if (!/^\d{1,3}(?:\.\d{3})+,\d+$/.test(coeff) && !/^\d+,\d+$/.test(coeff)) return null;
      return coeff.replace(/\./g, '').replace(',', '.');
    }
    if (!/^\d{1,3}(?:,\d{3})+\.\d+$/.test(coeff) && !/^\d+\.\d+$/.test(coeff)) return null;
    return coeff.replace(/,/g, '');
  }
  if (commas === 1) {
    if (!/^\d+,\d+$/.test(coeff) && !/^,\d+$/.test(coeff)) return null;
    return coeff.replace(',', '.');
  }
  if (dots === 1) {
    if (!/^\d+\.\d+$/.test(coeff) && !/^\.\d+$/.test(coeff)) return null;
    return coeff;
  }
  return null;
}

function count(value: string, char: string): number {
  let n = 0;
  for (const c of value) if (c === char) n += 1;
  return n;
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e15 || abs < 1e-6) {
    return value
      .toExponential(6)
      .replace(/\.?0+e/, 'e')
      .replace('e+', 'e+');
  }
  const digits = abs >= 1000 ? 4 : abs >= 1 ? 6 : 8;
  return value
    .toFixed(digits)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
}
