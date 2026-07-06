import { writeFile, rename, unlink, mkdir } from 'fs/promises';
import path from 'path';
import { Catalog, RunFile, RunEntry, HarEntry } from './types.js';

async function atomicWrite(content: string, outputPath: string): Promise<void> {
  const tmp = outputPath + '.tmp';
  await writeFile(tmp, content, 'utf-8');
  try {
    await rename(tmp, outputPath);
  } catch {
    // Windows: rename fails if target is open in another app — write directly
    try {
      await writeFile(outputPath, content, 'utf-8');
    } finally {
      await unlink(tmp).catch(() => {});
    }
  }
}

export async function writeJsonCatalog(catalog: Catalog, outputPath: string): Promise<void> {
  await ensureDir(outputPath);
  await atomicWrite(JSON.stringify(catalog, null, 2), outputPath);
}

export async function writeCsvCatalog(catalog: Catalog, outputPath: string): Promise<void> {
  await ensureDir(outputPath);
  const header = 'method,path,entity,queryParamKeys,sampleUrl,firstSeen,sourceFiles';
  const rows = catalog.entries.map(e =>
    [
      csvEscape(e.method),
      csvEscape(e.path),
      csvEscape(e.entity),
      csvEscape(e.queryParamKeys.join('|')),
      csvEscape(e.sampleUrl ?? ''),
      csvEscape(e.firstSeen),
      csvEscape(e.sourceFiles.join('|')),
    ].join(',')
  );
  await atomicWrite([header, ...rows].join('\r\n'), outputPath);
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export function buildRunFile(
  taggedEntries: Array<{ entry: HarEntry; sourceFile: string }>,
  harFiles: string[],
  runAt: string
): RunFile {
  const entries: RunEntry[] = taggedEntries.map(({ entry }) => {
    const text = entry.response?.content?.text;
    const mime = entry.response?.content?.mimeType ?? '';
    let response: unknown = undefined;
    if (text && mime.includes('json')) {
      try { response = JSON.parse(text); } catch { /* skip unparseable */ }
    }
    return {
      method: entry.request.method.toUpperCase(),
      url: entry.request.url,
      status: entry.response?.status ?? 0,
      timestamp: entry.startedDateTime,
      response,
    };
  });

  return { runAt, harFiles, entries };
}

export async function writeRunFile(runFile: RunFile, runsDir: string, harName?: string): Promise<string> {
  await mkdir(runsDir, { recursive: true });
  let baseName: string;
  if (harName) {
    // Use the HAR filename (without extension) as the run file name
    baseName = path.basename(harName, path.extname(harName)).replace(/\s+/g, '-');
  } else {
    baseName = runFile.runAt.replace(/:/g, '-').replace(/\..+$/, '');
  }
  const filePath = path.join(runsDir, `${baseName}.json`);
  await writeFile(filePath, JSON.stringify(runFile, null, 2), 'utf-8');
  return filePath;
}
