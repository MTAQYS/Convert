import { err, ok, type ConvertResult } from '../errors';
import { checkTextSize, positionAt, stripBom } from '../text';

const MAX_DEPTH = 100;

export function parseJson(input: string): ConvertResult<unknown> {
  const text = stripBom(input);
  const sized = checkTextSize(text);
  if (!sized.ok) return sized;
  if (text.trim() === '') return err('empty_input');
  try {
    const parser = new JsonParser(text);
    const value = parser.parseValue(1);
    if (!value.ok) return value;
    parser.skip();
    if (!parser.done()) return err('json_invalid', parser.position());
    return value;
  } catch {
    return err('json_invalid');
  }
}

export function stringifyJson(value: unknown, pretty: boolean): ConvertResult<string> {
  try {
    const text = JSON.stringify(value, null, pretty ? 2 : undefined);
    if (text === undefined) return err('json_invalid');
    return ok(text);
  } catch {
    return err('json_invalid');
  }
}

class JsonParser {
  private index = 0;

  constructor(private readonly source: string) {}

  done(): boolean {
    return this.index >= this.source.length;
  }

  position(): { line: number; column: number } {
    return positionAt(this.source, this.index);
  }

  parseValue(depth: number): ConvertResult<unknown> {
    if (depth > MAX_DEPTH) return err('json_invalid', this.position());
    this.skip();
    const char = this.source[this.index];
    if (char === '{') return this.parseObject(depth);
    if (char === '[') return this.parseArray(depth);
    if (char === '"') return this.parseString();
    if (char === 't') return this.literal('true', true);
    if (char === 'f') return this.literal('false', false);
    if (char === 'n') return this.literal('null', null);
    if (char === '-' || (char !== undefined && char >= '0' && char <= '9')) return this.parseNumber();
    return err('json_invalid', this.position());
  }

  skip(): void {
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (char !== ' ' && char !== '\n' && char !== '\r' && char !== '\t') break;
      this.index += 1;
    }
  }

  private parseObject(depth: number): ConvertResult<unknown> {
    this.index += 1;
    const obj: Record<string, unknown> = Object.create(null);
    this.skip();
    if (this.source[this.index] === '}') {
      this.index += 1;
      return ok(obj);
    }
    while (this.index < this.source.length) {
      this.skip();
      if (this.source[this.index] !== '"') return err('json_invalid', this.position());
      const key = this.parseString();
      if (!key.ok) return key;
      this.skip();
      if (this.source[this.index] !== ':') return err('json_invalid', this.position());
      this.index += 1;
      const value = this.parseValue(depth + 1);
      if (!value.ok) return value;
      obj[key.value] = value.value;
      this.skip();
      if (this.source[this.index] === ',') {
        this.index += 1;
        this.skip();
        if (this.source[this.index] === '}') return err('json_invalid', this.position());
        continue;
      }
      if (this.source[this.index] === '}') {
        this.index += 1;
        return ok(obj);
      }
      return err('json_invalid', this.position());
    }
    return err('json_invalid', this.position());
  }

  private parseArray(depth: number): ConvertResult<unknown> {
    this.index += 1;
    const list: unknown[] = [];
    this.skip();
    if (this.source[this.index] === ']') {
      this.index += 1;
      return ok(list);
    }
    while (this.index < this.source.length) {
      const value = this.parseValue(depth + 1);
      if (!value.ok) return value;
      list.push(value.value);
      this.skip();
      if (this.source[this.index] === ',') {
        this.index += 1;
        this.skip();
        if (this.source[this.index] === ']') return err('json_invalid', this.position());
        continue;
      }
      if (this.source[this.index] === ']') {
        this.index += 1;
        return ok(list);
      }
      return err('json_invalid', this.position());
    }
    return err('json_invalid', this.position());
  }

  private parseString(): ConvertResult<string> {
    this.index += 1;
    let out = '';
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (char === '"') {
        this.index += 1;
        return ok(out);
      }
      if (char === '\\') {
        const next = this.source[this.index + 1];
        const simple: Record<string, string> = {
          '"': '"',
          '\\': '\\',
          '/': '/',
          b: '\b',
          f: '\f',
          n: '\n',
          r: '\r',
          t: '\t',
        };
        if (next === undefined) return err('json_invalid', this.position());
        if (next === 'u') {
          const hex = this.source.slice(this.index + 2, this.index + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) return err('json_invalid', this.position());
          out += String.fromCharCode(Number.parseInt(hex, 16));
          this.index += 6;
          continue;
        }
        if (simple[next] === undefined) return err('json_invalid', this.position());
        out += simple[next];
        this.index += 2;
        continue;
      }
      if (char.charCodeAt(0) < 0x20) return err('json_invalid', this.position());
      out += char;
      this.index += 1;
    }
    return err('json_invalid', this.position());
  }

  private literal<T>(word: string, value: T): ConvertResult<T> {
    if (this.source.slice(this.index, this.index + word.length) !== word) return err('json_invalid', this.position());
    this.index += word.length;
    return ok(value);
  }

  private parseNumber(): ConvertResult<number> {
    const start = this.index;
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.source.slice(this.index));
    if (!match) return err('json_invalid', this.position());
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) return err('number_too_large', positionAt(this.source, start));
    return ok(value);
  }
}
