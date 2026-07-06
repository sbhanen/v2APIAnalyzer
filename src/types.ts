// Minimal HAR 1.2 subset — only fields we use
export interface HarFile {
  log: HarLog;
}

export interface HarLog {
  entries: HarEntry[];
}

export interface HarEntry {
  startedDateTime: string;
  request: HarRequest;
  response: HarResponse;
}

export interface HarRequest {
  method: string;
  url: string;
  queryString: HarQueryParam[];
}

export interface HarQueryParam {
  name: string;
  value: string;
}

export interface HarResponse {
  status: number;
  content: HarContent;
}

export interface HarContent {
  mimeType: string;
  text?: string;
}

// A single unique API endpoint in the catalog
export interface CatalogEntry {
  method: string;
  path: string;            // Normalized path, key predicates replaced with (*)
  entity: string;          // Top-level OData entity/collection name
  queryParamKeys: string[]; // Sorted, deduped param names seen across all observations
  sampleUrl: string;       // One full URL example as seen in the HAR
  sampleResponse?: unknown; // First response body seen for this endpoint
  firstSeen: string;       // ISO 8601 timestamp of earliest observation
  sourceFiles: string[];   // HAR filenames that contributed this entry
}

export interface Catalog {
  version: string;
  lastUpdated: string;
  entries: CatalogEntry[];
}

// A single observed API call in a run file (includes full response)
export interface RunEntry {
  method: string;
  url: string;
  status: number;
  timestamp: string;
  response: unknown;
}

export interface RunFile {
  runAt: string;
  harFiles: string[];
  entries: RunEntry[];
}

export interface RunResult {
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  totalCount: number;
}
