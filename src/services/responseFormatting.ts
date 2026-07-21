export function formatResponseSize(body: string): string {
  const bytes = new TextEncoder().encode(body).length;
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${formatUnitValue(kilobytes)} KB`;

  return `${formatUnitValue(kilobytes / 1024)} MB`;
}

export function formatResponseDestination(finalUrl: string): string {
  try {
    const url = new URL(finalUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "Unavailable";
  } catch {
    return "Unavailable";
  }
}

function formatUnitValue(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, "");
}
