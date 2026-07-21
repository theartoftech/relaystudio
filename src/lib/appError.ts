export type AppErrorCategory =
  | "validation"
  | "auth"
  | "network"
  | "http"
  | "filesystem"
  | "schema"
  | "import"
  | "flow"
  | "cancelled"
  | "timeout"
  | "unknown";

export interface AppErrorOptions {
  retryable?: boolean;
  status?: number;
  guidance?: string;
  cause?: unknown;
}

export class AppError extends Error {
  readonly category: AppErrorCategory;
  readonly code: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly guidance?: string;

  constructor(category: AppErrorCategory, code: string, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = "AppError";
    if (typeof options.cause !== "undefined") {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
    this.category = category;
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.status = options.status;
    this.guidance = options.guidance;
  }
}

export function normalizeAppError(error: unknown, abortKind?: "cancelled" | "timeout"): AppError {
  if (error instanceof AppError) {
    const redacted = redactText(error.message);
    return redacted === error.message ? error : new AppError(error.category, error.code, redacted, {
      retryable: error.retryable,
      status: error.status,
      guidance: error.guidance,
      cause: (error as Error & { cause?: unknown }).cause
    });
  }
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = redactText(rawMessage);

  if (error instanceof DOMException && error.name === "AbortError") {
    return abortKind === "cancelled"
      ? new AppError("cancelled", "REQUEST_CANCELLED", "Request cancelled.", { cause: error })
      : new AppError("timeout", "REQUEST_TIMEOUT", "Request timed out.", { retryable: true, cause: error });
  }
  if (/bearer token|unauthenticated|unauthorized|\b401\b|\b403\b/i.test(rawMessage)) {
    return new AppError("auth", "AUTH_FAILURE", message, { cause: error });
  }
  if (/failed to fetch|network|connection|dns|certificate|tls/i.test(rawMessage)) {
    return new AppError("network", "NETWORK_FAILURE", message, { retryable: true, cause: error });
  }
  return new AppError("unknown", "UNEXPECTED_FAILURE", message, { cause: error });
}
import { redactText } from "./redaction";
