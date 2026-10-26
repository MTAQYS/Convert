import { err, ok, type ConvertResult } from './errors';

export const MAX_TEXT_CHARS = 50 * 1024 * 1024;

export function stripBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
}

export function positionAt(input: string, index: number): { line: number; column: number } {
  const safe = Math.max(0, Math.min(index, input.length));
  const upto = input.slice(0, safe);
  const lines = upto.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export function checkTextSize(input: string): ConvertResult<void> {
  if (input.length > MAX_TEXT_CHARS) return err('file_too_large');
  return ok(undefined);
}

export function looksBinary(text: string): boolean {
  return text.includes('\u0000');
}
