import { err, ok, type ConvertResult } from './errors';
import { checkTextSize, positionAt, stripBom } from './text';

const NAMED_ENTITIES = buildNamedEntities();

export function encodeBase64Text(input: string): ConvertResult<string> {
  const sized = checkTextSize(input);
  if (!sized.ok) return sized;
  return ok(bytesToBase64(new TextEncoder().encode(input)));
}

export function decodeBase64Text(input: string): ConvertResult<string> {
  if (stripBom(input).trim() === '') return ok('');
  const sized = checkTextSize(input);
  if (!sized.ok) return sized;
  const bytes = base64ToBytes(input);
  if (!bytes.ok) return bytes;
  try {
    return ok(new TextDecoder('utf-8', { fatal: true }).decode(bytes.value));
  } catch {
    return err('base64_not_utf8');
  }
}

export function encodeBase64Bytes(bytes: Uint8Array): ConvertResult<string> {
  try {
    return ok(bytesToBase64(bytes));
  } catch {
    return err('base64_invalid');
  }
}

export function base64ToBytes(input: string): ConvertResult<Uint8Array> {
  const cleaned = stripBom(input).trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (cleaned === '') return ok(new Uint8Array());
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) return err('base64_invalid');
  const pad = cleaned.length % 4;
  if (pad === 1) return err('base64_invalid');
  const padded = pad === 0 ? cleaned : cleaned + '='.repeat(4 - pad);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return ok(bytes);
  } catch {
    return err('base64_invalid');
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function encodeUrl(input: string): ConvertResult<string> {
  const sized = checkTextSize(input);
  if (!sized.ok) return sized;
  return ok(encodeURIComponent(input));
}

export function decodeUrl(input: string): ConvertResult<string> {
  const text = stripBom(input);
  if (text === '') return ok('');
  const sized = checkTextSize(text);
  if (!sized.ok) return sized;
  try {
    return ok(decodeURIComponent(text));
  } catch {
    return err('url_invalid');
  }
}

export function encodeHtml(input: string): ConvertResult<string> {
  const sized = checkTextSize(input);
  if (!sized.ok) return sized;
  return ok(
    input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;'),
  );
}

export function decodeHtml(input: string): ConvertResult<string> {
  const text = stripBom(input);
  if (text === '') return ok('');
  const sized = checkTextSize(text);
  if (!sized.ok) return sized;
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '&') {
      out += text[i];
      continue;
    }
    const semi = text.indexOf(';', i + 1);
    const nextAmp = text.indexOf('&', i + 1);
    const body = semi === -1 ? '' : text.slice(i + 1, semi);
    const broken =
      semi === -1 || (nextAmp !== -1 && nextAmp < semi) || body.length === 0 || body.length > 32 || /\s/.test(body);
    if (broken) return err('html_bad_ampersand', positionAt(text, i));
    if (body.startsWith('#')) {
      const point = decodeNumericEntity(body);
      if (!point.ok) return err(point.error.code, positionAt(text, i));
      out += point.value;
      i = semi;
      continue;
    }
    const named = NAMED_ENTITIES[body];
    if (named === undefined) return err('html_unknown_entity', { ...positionAt(text, i), detail: body });
    out += named;
    i = semi;
  }
  return ok(out);
}

function decodeNumericEntity(body: string): ConvertResult<string> {
  const hex = body[1] === 'x' || body[1] === 'X';
  const digits = hex ? body.slice(2) : body.slice(1);
  if (digits === '' || (hex ? !/^[0-9a-fA-F]+$/.test(digits) : !/^[0-9]+$/.test(digits))) {
    return err('html_bad_codepoint');
  }
  const code = Number.parseInt(digits, hex ? 16 : 10);
  if (!Number.isInteger(code) || code < 1 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
    return err('html_bad_codepoint');
  }
  try {
    return ok(String.fromCodePoint(code));
  } catch {
    return err('html_bad_codepoint');
  }
}

function buildNamedEntities(): Record<string, string> {
  const map: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: '\u00a0',
    iexcl: '¡',
    cent: '¢',
    pound: '£',
    curren: '¤',
    yen: '¥',
    brvbar: '¦',
    sect: '§',
    uml: '¨',
    copy: '©',
    ordf: 'ª',
    laquo: '«',
    not: '¬',
    shy: '\u00ad',
    reg: '®',
    macr: '¯',
    deg: '°',
    plusmn: '±',
    sup2: '²',
    sup3: '³',
    acute: '´',
    micro: 'µ',
    para: '¶',
    middot: '·',
    cedil: '¸',
    sup1: '¹',
    ordm: 'º',
    raquo: '»',
    frac14: '¼',
    frac12: '½',
    frac34: '¾',
    iquest: '¿',
    times: '×',
    divide: '÷',
    euro: '€',
    oelig: 'œ',
    OElig: 'Œ',
    scaron: 'š',
    Scaron: 'Š',
    Yuml: 'Ÿ',
    fnof: 'ƒ',
    ndash: '–',
    mdash: '—',
    lsquo: '‘',
    rsquo: '’',
    sbquo: '‚',
    ldquo: '“',
    rdquo: '”',
    bdquo: '„',
    hellip: '…',
    bull: '•',
    prime: '′',
    Prime: '″',
    trade: '™',
    minus: '−',
    permil: '‰',
    lsaquo: '‹',
    rsaquo: '›',
  };
  const latin =
    'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml oslash ugrave uacute ucirc uuml yacute thorn yuml';
  const names = latin.split(' ');
  const codes = [
    192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213,
    214, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236,
    237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 248, 249, 250, 251, 252, 253, 254, 255,
  ];
  names.forEach((name, index) => {
    map[name] = String.fromCodePoint(codes[index]);
  });
  map.AMP = '&';
  map.LT = '<';
  map.GT = '>';
  map.QUOT = '"';
  return map;
}
