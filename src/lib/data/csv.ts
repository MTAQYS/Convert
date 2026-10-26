import { err, ok, type ConvertResult } from '../errors';
import { checkTextSize, stripBom } from '../text';

type Cell = { value: string; quoted: boolean };
type Row = { cells: Cell[]; line: number };
type Delimiter = ',' | ';' | '\t';

export function parseCsv(input: string): ConvertResult<unknown> {
  const text = stripBom(input);
  const sized = checkTextSize(text);
  if (!sized.ok) return sized;
  if (text.trim() === '') return err('empty_input');
  const delimiter = detectDelimiter(text);
  const table = tokenize(text, delimiter);
  if (!table.ok) return table;
  const rows = table.value.filter((row) => !(row.cells.length === 1 && !row.cells[0].quoted && row.cells[0].value === ''));
  if (rows.length === 0) return err('empty_input');

  const seen = new Map<string, number>();
  const headers = rows[0].cells.map((cell, index) => {
    const name = cell.value.trim() || `column_${index + 1}`;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name}_${count + 1}`;
  });

  const records: Record<string, unknown>[] = [];
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (row.cells.length > headers.length) return err('csv_invalid', { line: row.line });
    const record: Record<string, unknown> = Object.create(null);
    headers.forEach((name, index) => {
      const cell = row.cells[index];
      record[name] = cell ? coerceCell(cell, delimiter) : null;
    });
    records.push(record);
  }
  return ok(records);
}

export function stringifyCsv(value: unknown): ConvertResult<string> {
  const rows = toRows(value);
  if (!rows.ok) return rows;
  const lines = rows.value.map((row) => row.map(escapeCell).join(','));
  return ok(`${lines.join('\n')}\n`);
}

function detectDelimiter(input: string): Delimiter {
  let commas = 0;
  let semis = 0;
  let tabs = 0;
  let inQuotes = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') i += 1;
        else inQuotes = false;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === '\n' || char === '\r') break;
    if (char === ',') commas += 1;
    else if (char === ';') semis += 1;
    else if (char === '\t') tabs += 1;
  }
  if (semis > commas && semis >= tabs) return ';';
  if (tabs > commas && tabs > semis) return '\t';
  return ',';
}

function tokenize(input: string, delimiter: Delimiter): ConvertResult<Row[]> {
  const rows: Row[] = [];
  let cells: Cell[] = [];
  let field = '';
  let inQuotes = false;
  let fieldQuoted = false;
  let closed = false;
  let line = 1;
  let rowLine = 1;
  let quoteLine = 1;

  const pushField = () => {
    cells.push({ value: field, quoted: fieldQuoted });
    field = '';
    fieldQuoted = false;
    closed = false;
  };
  const pushRow = () => {
    pushField();
    rows.push({ cells, line: rowLine });
    cells = [];
    rowLine = line + 1;
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
          continue;
        }
        inQuotes = false;
        closed = true;
        continue;
      }
      if (char === '\n') line += 1;
      field += char;
      continue;
    }
    if (char === '"') {
      if (field !== '' || closed) return err('csv_invalid', { line });
      inQuotes = true;
      fieldQuoted = true;
      quoteLine = line;
      continue;
    }
    if (char === delimiter) {
      pushField();
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      pushRow();
      line += 1;
      continue;
    }
    if (closed) return err('csv_invalid', { line });
    field += char;
  }
  if (inQuotes) return err('csv_unclosed_quote', { line: quoteLine });
  if (field.length > 0 || fieldQuoted || cells.length > 0) pushRow();
  return ok(rows);
}

function coerceCell(cell: Cell, delimiter: Delimiter): unknown {
  if (cell.quoted) {
    const value = cell.value;
    if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    }
    return value;
  }
  const value = cell.value.trim();
  if (value === '') return '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  let numeric = value;
  if (delimiter !== ',' && /^\d+,\d+$/.test(value)) numeric = value.replace(',', '.');
  if (/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(numeric)) {
    const number = Number(numeric);
    if (Number.isFinite(number)) return number;
  }
  return value;
}

function toRows(value: unknown): ConvertResult<unknown[][]> {
  if (value === null || value === undefined) return err('empty_input');
  if (Array.isArray(value)) {
    if (value.length === 0) return err('empty_input');
    if (value.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))) {
      const keys: string[] = [];
      for (const item of value) {
        for (const key of Object.keys(item as object)) {
          if (!keys.includes(key)) keys.push(key);
        }
      }
      const body = value.map((item) => keys.map((key) => (item as Record<string, unknown>)[key] ?? null));
      return ok([keys, ...body]);
    }
    if (value.every((item) => Array.isArray(item))) return ok(value as unknown[][]);
    if (value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
      return ok([['value'], ...value.map((item) => [item])]);
    }
    return err('csv_invalid');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length === 0) return err('empty_input');
    return ok([keys, keys.map((key) => record[key])]);
  }
  return ok([['value'], [value]]);
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const mustQuote =
    typeof value === 'object' ||
    /[",\r\n\t;]/.test(text) ||
    text !== text.trim() ||
    text === '' ||
    /^(?:true|false|null|[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(text);
  if (mustQuote) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
