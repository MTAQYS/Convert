export const ERROR_CODES = [
  'empty_input',
  'empty_value',
  'file_too_large',
  'not_text',
  'invalid_number',
  'number_too_large',
  'number_negative',
  'below_absolute_zero',
  'unknown_unit',
  'unit_mismatch',
  'json_invalid',
  'csv_unclosed_quote',
  'csv_invalid',
  'yaml_invalid',
  'xml_invalid',
  'xml_doctype',
  'base64_invalid',
  'base64_not_utf8',
  'url_invalid',
  'html_bad_ampersand',
  'html_unknown_entity',
  'html_bad_codepoint',
  'hex_invalid',
  'rgb_invalid',
  'rgb_range',
  'hsl_invalid',
  'hsl_range',
  'oklch_invalid',
  'oklch_range',
  'color_alpha_unsupported',
  'image_type_unsupported',
  'image_too_many_pixels',
  'image_decode_failed',
  'image_encode_failed',
  'avif_encode_unsupported',
  'dimension_invalid',
  'dimension_too_large',
  'quality_invalid',
  'zip_failed',
  'worker_failed',
  'generic',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ConvertError = {
  code: ErrorCode;
  line?: number;
  column?: number;
  detail?: string;
};

export type ConvertResult<T> = { ok: true; value: T } | { ok: false; error: ConvertError };

export function ok<T>(value: T): ConvertResult<T> {
  return { ok: true, value };
}

export function err(code: ErrorCode, extra?: Omit<ConvertError, 'code'>): ConvertResult<never> {
  return { ok: false, error: { code, ...extra } };
}
