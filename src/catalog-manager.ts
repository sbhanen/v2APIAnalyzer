import { readFile } from 'fs/promises';
import { Catalog, CatalogEntry, RunResult } from './types.js';

export async function loadExistingCatalog(catalogPath: string): Promise<Catalog> {
  try {
    const raw = await readFile(catalogPath, 'utf-8');
    const parsed = JSON.parse(raw) as Catalog;
    if (!parsed?.entries || !Array.isArray(parsed.entries)) {
      throw new Error('invalid catalog structure');
    }
    return parsed;
  } catch (err) {
    const isNotFound = (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (!isNotFound) {
      console.warn(`  WARNING: could not read existing catalog (${(err as Error).message}) — starting fresh`);
    }
    return { version: '1', lastUpdated: '', entries: [] };
  }
}

export function entryKey(entry: CatalogEntry): string {
  return `${entry.method.toUpperCase()}::${entry.path}`;
}

export function mergeCatalog(
  existing: Catalog,
  incoming: CatalogEntry[]
): { catalog: Catalog; result: RunResult } {
  const map = new Map<string, CatalogEntry>();
  for (const e of existing.entries) {
    map.set(entryKey(e), { ...e });
  }

  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const inc of incoming) {
    const key = entryKey(inc);
    if (!map.has(key)) {
      map.set(key, { ...inc });
      newCount++;
    } else {
      const existing = map.get(key)!;
      const mergedParams = [...new Set([...existing.queryParamKeys, ...inc.queryParamKeys])].sort();
      const mergedSources = [...new Set([...existing.sourceFiles, ...inc.sourceFiles])].sort();
      const paramsGrew = mergedParams.length > existing.queryParamKeys.length;

      // Keep the earlier firstSeen (ISO 8601 strings are lexicographically sortable)
      const earlierSeen = inc.firstSeen < existing.firstSeen ? inc.firstSeen : existing.firstSeen;

      map.set(key, {
        ...existing,
        queryParamKeys: mergedParams,
        sourceFiles: mergedSources,
        firstSeen: earlierSeen,
        // Keep the first sampleResponse we ever saw; don't overwrite with a later one
        sampleResponse: existing.sampleResponse ?? inc.sampleResponse,
      });

      if (paramsGrew) updatedCount++;
      else unchangedCount++;
    }
  }

  const entries = [...map.values()].sort((a, b) => {
    if (a.entity !== b.entity) return a.entity.localeCompare(b.entity);
    if (a.method !== b.method) return a.method.localeCompare(b.method);
    return a.path.localeCompare(b.path);
  });

  const catalog: Catalog = {
    version: '1',
    lastUpdated: new Date().toISOString(),
    entries,
  };

  const result: RunResult = {
    newCount,
    updatedCount,
    unchangedCount,
    totalCount: entries.length,
  };

  return { catalog, result };
}
