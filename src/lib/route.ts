export const ROUTES = ['images', 'data', 'encoding', 'colors', 'units'] as const;

export type RouteId = (typeof ROUTES)[number];

export function parseHash(hash: string): RouteId {
  const raw = hash.replace(/^#\/?/, '').split(/[?#]/)[0];
  if ((ROUTES as readonly string[]).includes(raw)) return raw as RouteId;
  return 'images';
}
