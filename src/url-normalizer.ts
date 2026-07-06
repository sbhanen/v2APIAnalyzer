import { HarEntry, CatalogEntry } from './types.js';

const C4C_PATH_MARKER = '/sap/c4c/api/v1/';
// Matches key predicates like ('GUID'), (123), (KeyA='x',KeyB='y')
const KEY_PREDICATE_RE = /\([^)]*\)/g;

export function normalizeEntry(
  entry: HarEntry,
  sourceFile: string
): CatalogEntry | null {
  const path = extractNormalizedPath(entry.request.url);
  if (path === null) return null;

  return {
    method: entry.request.method.toUpperCase(),
    path,
    entity: extractEntityName(path),
    queryParamKeys: extractQueryParamKeys(entry.request.queryString ?? []),
    sampleUrl: entry.request.url,
    sampleResponse: parseResponseBody(entry),
    firstSeen: entry.startedDateTime,
    sourceFiles: [sourceFile],
  };
}

export function extractNormalizedPath(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const markerIndex = parsed.pathname.indexOf(C4C_PATH_MARKER);
  if (markerIndex === -1) return null;

  // Everything after /sap/c4c/api/v1/
  const afterMarker = parsed.pathname.slice(markerIndex + C4C_PATH_MARKER.length);

  // Skip the service name segment (first path segment)
  const slashIndex = afterMarker.indexOf('/');
  const withoutServiceName = slashIndex === -1
    ? '' // URL ended at service name (e.g. just the service root)
    : afterMarker.slice(slashIndex);

  // If nothing left after the service name, the path IS the service root
  const rawPath = withoutServiceName || '/' + afterMarker;

  // Neutralize key predicates
  return rawPath.replace(KEY_PREDICATE_RE, '(*)');
}

export function extractEntityName(normalizedPath: string): string {
  // Strip leading slash, take first segment, remove any trailing (*) or trailing slash
  const segment = normalizedPath.replace(/^\//, '').split('/')[0];
  return segment.replace(/\(\*\)$/, '');
}

export function extractQueryParamKeys(
  queryString: Array<{ name: string; value: string }>
): string[] {
  return [...new Set(queryString.map(q => q.name))].sort();
}

function parseResponseBody(entry: HarEntry): unknown {
  const text = entry.response?.content?.text;
  if (!text) return undefined;
  const mime = entry.response?.content?.mimeType ?? '';
  if (!mime.includes('json')) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
