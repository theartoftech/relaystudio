export const MAX_RESPONSE_BODY_BYTES = 5 * 1024 * 1024;
export const MAX_PROJECT_FILE_BYTES = 4 * 1024 * 1024;

export const MAX_OPENAPI_DOCUMENT_BYTES = 2 * 1024 * 1024;
export const MAX_OPENAPI_TOTAL_BYTES = 10 * 1024 * 1024;
export const MAX_OPENAPI_EXTERNAL_DOCUMENTS = 20;
export const MAX_OPENAPI_REFERENCE_DEPTH = 32;
export const MAX_OPENAPI_GRAPH_NODES = 20_000;
export const MAX_OPENAPI_OBJECT_KEYS = 1_000;

export const MAX_COMPARISON_BODY_BYTES = 1 * 1024 * 1024;
export const MAX_COMPARISON_JSON_DEPTH = 64;
export const MAX_COMPARISON_JSON_NODES = 20_000;
export const MAX_COMPARISON_DIFF_ENTRIES = 10_000;
export const MAX_COMPARISON_RAW_LINES = 10_000;

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function assertUtf8ByteLimit(value: string, limit: number, label: string): void {
  const bytes = utf8ByteLength(value);
  if (bytes > limit) {
    throw new Error(`${label} exceeds the safe limit of ${formatBytes(limit)} (${bytes} bytes). Reduce the input and try again.`);
  }
}

export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MiB`;
}
