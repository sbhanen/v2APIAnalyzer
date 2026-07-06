import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { HarEntry, HarFile } from './types.js';

const C4C_PATH_MARKER = '/sap/c4c/api/v1/';

export async function loadHarEntries(
  harsDir: string,
  singleFile?: string
): Promise<Array<{ entry: HarEntry; sourceFile: string }>> {
  if (singleFile) {
    return loadSingleHarFile(harsDir, singleFile);
  }

  const dirEntries = await readdir(harsDir, { withFileTypes: true });
  const harFiles = dirEntries
    .filter(d => d.isFile() && d.name.toLowerCase().endsWith('.har'))
    .map(d => d.name)
    .sort();

  if (harFiles.length === 0) {
    console.warn(`  No .har files found in ${harsDir}`);
    return [];
  }

  const results: Array<{ entry: HarEntry; sourceFile: string }> = [];

  for (const fileName of harFiles) {
    const filePath = path.join(harsDir, fileName);
    try {
      const har = await parseHarFile(filePath);
      const filtered = filterC4cEntries(har.log.entries);
      console.log(`  Loaded ${fileName.padEnd(40)} — ${filtered.length} C4C entries`);
      for (const entry of filtered) {
        results.push({ entry, sourceFile: fileName });
      }
    } catch (err) {
      console.warn(`  WARNING: skipping ${fileName} — ${(err as Error).message}`);
    }
  }

  return results;
}

async function loadSingleHarFile(
  harsDir: string,
  fileName: string
): Promise<Array<{ entry: HarEntry; sourceFile: string }>> {
  const filePath = path.join(harsDir, fileName);
  const har = await parseHarFile(filePath);
  const filtered = filterC4cEntries(har.log.entries);
  console.log(`  Loaded ${fileName.padEnd(40)} — ${filtered.length} C4C entries`);
  return filtered.map(entry => ({ entry, sourceFile: fileName }));
}

export async function parseHarFile(filePath: string): Promise<HarFile> {
  const raw = await readFile(filePath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('invalid JSON');
  }
  const har = parsed as HarFile;
  if (!har?.log?.entries || !Array.isArray(har.log.entries)) {
    throw new Error('missing log.entries array');
  }
  return har;
}

export function filterC4cEntries(entries: HarEntry[]): HarEntry[] {
  return entries.filter(e => e.request?.url?.includes(C4C_PATH_MARKER));
}
