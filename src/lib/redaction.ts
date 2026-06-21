const SECRET_FIELD_PATTERN = /(authorization|password|token|secret|apikey|api-key|cookie|set-cookie)/i;

export function isSecretKey(key: string): boolean {
  return SECRET_FIELD_PATTERN.test(key);
}

export function redactValue(key: string, value: string): string {
  if (!isSecretKey(key)) {
    return value;
  }

  if (/authorization/i.test(key) || /^bearer\s+/i.test(value)) {
    return "Bearer ********";
  }

  return "********";
}

export function redactRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, redactValue(key, value)])
  );
}
