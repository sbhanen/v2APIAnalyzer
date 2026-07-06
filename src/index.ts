#!/usr/bin/env node
import path from 'path';
import { parseArgs } from 'util';
import { loadHarEntries } from './har-parser.js';
import { normalizeEntry } from './url-normalizer.js';
import { loadExistingCatalog, mergeCatalog } from './catalog-manager.js';
import { writeJsonCatalog, writeCsvCatalog, buildRunFile, writeRunFile } from './output-writer.js';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      hars:    { type: 'string',  default: './hars' },
      output:  { type: 'string',  default: './output' },
      file:    { type: 'string' },
      json:    { type: 'string' },
      csv:     { type: 'string' },
      verbose: { type: 'boolean', default: false },
      help:    { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });

  if (values.help) {
    console.log(`
HAR Catalog Builder — SAP C4C OData v1

Usage:
  npm run catalog [options]
  node --loader ts-node/esm src/index.ts [options]

Options:
  --hars <dir>       Directory containing .har files  (default: ./hars)
  --output <dir>     Output directory                 (default: ./output)
  --file <name>      Process a single HAR file only (e.g. --file "contract account.har")
  --json <file>      Override catalog.json path
  --csv  <file>      Override catalog.csv path
  --verbose          Print each new/updated endpoint
  -h, --help         Show this help
`);
    return;
  }

  const runAt = new Date().toISOString();
  const harsDir   = values.hars as string;
  const outputDir = values.output as string;
  const singleFile = values.file as string | undefined;
  const jsonPath  = (values.json as string | undefined) ?? path.join(outputDir, 'catalog.json');
  const csvPath   = (values.csv  as string | undefined) ?? path.join(outputDir, 'catalog.csv');

  console.log('HAR Catalog Builder — SAP C4C OData v1');
  console.log('=======================================');
  console.log(singleFile ? `Processing: ${singleFile}` : `Scanning: ${harsDir}`);

  const taggedEntries = await loadHarEntries(harsDir, singleFile);
  console.log();

  // Normalize all HAR entries
  const normalized = taggedEntries
    .map(({ entry, sourceFile }) => normalizeEntry(entry, sourceFile))
    .filter((e): e is NonNullable<typeof e> => e !== null);

  // Load existing catalog and merge
  const existing = await loadExistingCatalog(jsonPath);
  const existingCount = existing.entries.length;
  if (existingCount > 0) {
    console.log(`Existing catalog: ${jsonPath} (${existingCount} entries)`);
  } else {
    console.log(`No existing catalog — creating fresh`);
  }
  console.log();

  const { catalog, result } = mergeCatalog(existing, normalized);

  console.log('Merging...');
  console.log(`  New endpoints:        ${result.newCount}`);
  console.log(`  Updated (new params): ${result.updatedCount}`);
  console.log(`  Unchanged:            ${result.unchangedCount}`);
  console.log(`  Total:                ${existingCount} → ${result.totalCount}`);
  console.log();

  if (values.verbose && result.newCount + result.updatedCount > 0) {
    const oldKeys = new Set(existing.entries.map(e => `${e.method}::${e.path}`));
    const oldParamMap = new Map(existing.entries.map(e => [`${e.method}::${e.path}`, e.queryParamKeys]));

    for (const entry of catalog.entries) {
      const key = `${entry.method}::${entry.path}`;
      if (!oldKeys.has(key)) {
        console.log(`  [NEW]     ${entry.method.padEnd(7)} ${entry.path}`);
      } else {
        const prevParams = oldParamMap.get(key) ?? [];
        const addedParams = entry.queryParamKeys.filter(p => !prevParams.includes(p));
        if (addedParams.length > 0) {
          console.log(`  [UPDATED] ${entry.method.padEnd(7)} ${entry.path}  (+${addedParams.join(', ')})`);
        }
      }
    }
    console.log();
  }

  await writeJsonCatalog(catalog, jsonPath);

  // Write per-run file with full response bodies
  const harFileNames = [...new Set(taggedEntries.map(t => t.sourceFile))];
  const runFile = buildRunFile(taggedEntries, harFileNames, runAt);
  const runsDir = path.join(outputDir, 'runs');
  const runPath = await writeRunFile(runFile, runsDir, singleFile);

  try {
    await writeCsvCatalog(catalog, csvPath);
    console.log('Output written:');
    console.log(`  ${jsonPath}`);
    console.log(`  ${csvPath}`);
    console.log(`  ${runPath}`);
  } catch (err) {
    console.log('Output written:');
    console.log(`  ${jsonPath}`);
    console.log(`  ${runPath}`);
    console.warn(`  WARNING: could not write ${csvPath} — close it in Excel and re-run to update it`);
    console.warn(`  (${(err as Error).message})`);
  }
}

main().catch(err => {
  console.error('Fatal error:', (err as Error).message);
  process.exit(1);
});
