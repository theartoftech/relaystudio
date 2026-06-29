export function formatResponseSize(body: string): string {
  const bytes = new TextEncoder().encode(body).length;
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${formatUnitValue(kilobytes)} KB`;

  return `${formatUnitValue(kilobytes / 1024)} MB`;
}

function formatUnitValue(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, "");
}
