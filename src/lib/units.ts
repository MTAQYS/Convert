import { err, ok, type ConvertResult } from './errors';
import { formatQuantity } from './number';

export const CATEGORIES = ['length', 'weight', 'temperature', 'data', 'time', 'speed'] as const;

export type Category = (typeof CATEGORIES)[number];

export type UnitId =
  | 'mm'
  | 'cm'
  | 'm'
  | 'km'
  | 'in'
  | 'ft'
  | 'yd'
  | 'mi'
  | 'mg'
  | 'g'
  | 'kg'
  | 't'
  | 'oz'
  | 'lb'
  | 'C'
  | 'F'
  | 'K'
  | 'B'
  | 'kB'
  | 'MB'
  | 'GB'
  | 'TB'
  | 'KiB'
  | 'MiB'
  | 'GiB'
  | 'TiB'
  | 'ms'
  | 's'
  | 'min'
  | 'h'
  | 'day'
  | 'week'
  | 'mps'
  | 'kmh'
  | 'mph'
  | 'kn'
  | 'fps';

type LinearUnit = { id: UnitId; category: Exclude<Category, 'temperature'>; toBase: number };

const KiB = 1024;
const MiB = KiB * 1024;
const GiB = MiB * 1024;
const TiB = GiB * 1024;

const LINEAR: LinearUnit[] = [
  { id: 'mm', category: 'length', toBase: 0.001 },
  { id: 'cm', category: 'length', toBase: 0.01 },
  { id: 'm', category: 'length', toBase: 1 },
  { id: 'km', category: 'length', toBase: 1000 },
  { id: 'in', category: 'length', toBase: 0.0254 },
  { id: 'ft', category: 'length', toBase: 0.3048 },
  { id: 'yd', category: 'length', toBase: 0.9144 },
  { id: 'mi', category: 'length', toBase: 1609.344 },
  { id: 'mg', category: 'weight', toBase: 0.001 },
  { id: 'g', category: 'weight', toBase: 1 },
  { id: 'kg', category: 'weight', toBase: 1000 },
  { id: 't', category: 'weight', toBase: 1_000_000 },
  { id: 'oz', category: 'weight', toBase: 28.349523125 },
  { id: 'lb', category: 'weight', toBase: 453.59237 },
  { id: 'B', category: 'data', toBase: 1 },
  { id: 'kB', category: 'data', toBase: 1000 },
  { id: 'MB', category: 'data', toBase: 1_000_000 },
  { id: 'GB', category: 'data', toBase: 1_000_000_000 },
  { id: 'TB', category: 'data', toBase: 1_000_000_000_000 },
  { id: 'KiB', category: 'data', toBase: KiB },
  { id: 'MiB', category: 'data', toBase: MiB },
  { id: 'GiB', category: 'data', toBase: GiB },
  { id: 'TiB', category: 'data', toBase: TiB },
  { id: 'ms', category: 'time', toBase: 0.001 },
  { id: 's', category: 'time', toBase: 1 },
  { id: 'min', category: 'time', toBase: 60 },
  { id: 'h', category: 'time', toBase: 3600 },
  { id: 'day', category: 'time', toBase: 86400 },
  { id: 'week', category: 'time', toBase: 604800 },
  { id: 'mps', category: 'speed', toBase: 1 },
  { id: 'kmh', category: 'speed', toBase: 1000 / 3600 },
  { id: 'mph', category: 'speed', toBase: 1609.344 / 3600 },
  { id: 'kn', category: 'speed', toBase: 1852 / 3600 },
  { id: 'fps', category: 'speed', toBase: 0.3048 },
];

const TEMPERATURE: UnitId[] = ['C', 'F', 'K'];

const byId = new Map<string, LinearUnit>(LINEAR.map((unit) => [unit.id, unit]));

export function isUnitId(value: string): value is UnitId {
  return byId.has(value) || (TEMPERATURE as string[]).includes(value);
}

export function unitCategory(id: string): Category | null {
  if ((TEMPERATURE as string[]).includes(id)) return 'temperature';
  return byId.get(id)?.category ?? null;
}

export function unitsIn(category: Category): readonly UnitId[] {
  if (category === 'temperature') return TEMPERATURE;
  return LINEAR.filter((unit) => unit.category === category).map((unit) => unit.id);
}

export function convertUnit(value: number, from: string, to: string): ConvertResult<number> {
  if (!Number.isFinite(value)) return err('number_too_large');
  const fromCat = unitCategory(from);
  const toCat = unitCategory(to);
  if (!fromCat || !toCat) return err('unknown_unit');
  if (fromCat !== toCat) return err('unit_mismatch');
  if (fromCat !== 'temperature' && value < 0) return err('number_negative');
  if (fromCat === 'temperature') return convertTemperature(value, from, to);
  const source = byId.get(from);
  const target = byId.get(to);
  if (!source || !target) return err('unknown_unit');
  const base = value * source.toBase;
  if (!Number.isFinite(base)) return err('number_too_large');
  if (fromCat === 'data' && Math.abs(base) > Number.MAX_SAFE_INTEGER) return err('number_too_large');
  const out = base / target.toBase;
  if (!Number.isFinite(out)) return err('number_too_large');
  return ok(out);
}

export function convertAll(value: number, from: string): ConvertResult<{ unit: UnitId; value: number }[]> {
  const category = unitCategory(from);
  if (!category) return err('unknown_unit');
  const rows: { unit: UnitId; value: number }[] = [];
  for (const unit of unitsIn(category)) {
    const converted = convertUnit(value, from, unit);
    if (!converted.ok) return converted;
    rows.push({ unit, value: converted.value });
  }
  return ok(rows);
}

export function formatByteSize(bytes: number): { amount: string; unit: 'B' | 'kB' | 'MB' | 'GB' | 'TB' } {
  const abs = Math.abs(bytes);
  const table: { unit: 'TB' | 'GB' | 'MB' | 'kB' | 'B'; size: number }[] = [
    { unit: 'TB', size: 1e12 },
    { unit: 'GB', size: 1e9 },
    { unit: 'MB', size: 1e6 },
    { unit: 'kB', size: 1000 },
    { unit: 'B', size: 1 },
  ];
  const chosen = table.find((item) => abs >= item.size) ?? table[table.length - 1];
  const amount = chosen.unit === 'B' ? bytes : bytes / chosen.size;
  return { amount: formatQuantity(amount), unit: chosen.unit };
}

const ABSOLUTE_ZERO_C = -273.15;

function convertTemperature(value: number, from: string, to: string): ConvertResult<number> {
  const celsius = toCelsius(value, from);
  if (!celsius.ok) return celsius;
  if (celsius.value < ABSOLUTE_ZERO_C - 1e-6) return err('below_absolute_zero');
  if (to === 'C') return ok(celsius.value);
  if (to === 'K') return ok(celsius.value - ABSOLUTE_ZERO_C);
  if (to === 'F') return ok((celsius.value * 9) / 5 + 32);
  return err('unknown_unit');
}

function toCelsius(value: number, unit: string): ConvertResult<number> {
  if (unit === 'C') return ok(value);
  if (unit === 'K') return ok(value + ABSOLUTE_ZERO_C);
  if (unit === 'F') return ok(((value - 32) * 5) / 9);
  return err('unknown_unit');
}
