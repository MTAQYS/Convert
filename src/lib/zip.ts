import { zipSync, unzipSync } from 'fflate';
import { err, ok, type ConvertResult } from './errors';
import { uniqueFilenames } from './image';

export function buildZip(files: { name: string; data: Uint8Array }[]): ConvertResult<Uint8Array> {
  if (files.length === 0) return err('empty_input');
  try {
    const names = uniqueFilenames(files.map((file) => file.name));
    const input: Record<string, Uint8Array> = {};
    files.forEach((file, index) => {
      input[names[index]] = file.data;
    });
    return ok(zipSync(input, { level: 6 }));
  } catch {
    return err('zip_failed');
  }
}

export function readZipNames(data: Uint8Array): string[] {
  return Object.keys(unzipSync(data));
}
