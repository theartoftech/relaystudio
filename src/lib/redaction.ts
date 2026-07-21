export const REDACTION_MASK = "********";
const SECRET_FIELD_PATTERN = /(authorization|password|passphrase|token|secret|api.?key|cookie|credential)/i;

export function isSecretKey(key: string): boolean {
  return SECRET_FIELD_PATTERN.test(key.replace(/[^a-z0-9]/gi, ""));
}

export function redactValue(key: string, value: string): string {
  if (!isSecretKey(key)) {
    return value;
  }

  if (/authorization/i.test(key) || /^bearer\s+/i.test(value)) {
    return `Bearer ${REDACTION_MASK}`;
  }

  return REDACTION_MASK;
}

export function redactUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const relative = trimmed.startsWith("/");
  try {
    const parsed = new URL(trimmed, relative ? "https://relay-studio.invalid" : undefined);
    if (!relative && !["http:", "https:"].includes(parsed.protocol)) {
      return redactKeyValueText(value);
    }
    parsed.username = "";
    parsed.password = "";
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isSecretKey(key)) parsed.searchParams.set(key, REDACTION_MASK);
    }
    const redacted = relative ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.toString();
    return value.replace(trimmed, redacted);
  } catch {
    return redactKeyValueText(value)
      .replace(/\/\/[^\s/@]+@/g, "//");
  }
}

export function redactText(value: string): string {
  const urlsRedacted = value.replace(/https?:\/\/[^\s,;]+/gi, (candidate) => {
    const trailing = candidate.match(/[.)\]}]+$/)?.[0] ?? "";
    const url = trailing ? candidate.slice(0, -trailing.length) : candidate;
    return `${redactUrl(url)}${trailing}`;
  });
  return redactKeyValueText(urlsRedacted);
}

export function redactJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
    key,
    isSecretKey(key) ? redactValue(key, String(nested ?? "")) : redactJsonValue(nested)
  ]));
}

function redactKeyValueText(value: string): string {
  const bearerRedacted = value
    .replace(/(authorization\s*[:=]\s*)bearer\s+[^\s,;&}]+/gi, `$1Bearer ${REDACTION_MASK}`)
    .replace(/bearer\s+(?!token\s+variable\b)[a-z0-9._~+/-]+=*/gi, `Bearer ${REDACTION_MASK}`);
  return bearerRedacted.replace(
    /(["']?)([a-z][a-z0-9_-]*)(\1\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&}]+)/gi,
    (match, quote: string, key: string, separator: string, rawValue: string) => {
      if (!isSecretKey(key)) return match;
      if (/^authorization$/i.test(key.trim()) || rawValue.replace(/["']/g, "") === REDACTION_MASK) return match;
      const masked = rawValue.startsWith('"') || rawValue.startsWith("'") ? `${rawValue[0]}${REDACTION_MASK}${rawValue[0]}` : REDACTION_MASK;
      return `${quote}${key}${separator}${masked}`;
    }
  );
}

export function redactRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, redactValue(key, value)])
  );
}
