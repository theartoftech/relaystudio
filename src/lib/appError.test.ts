import { describe, expect, it } from "vitest";
import { AppError, normalizeAppError } from "./appError";

describe("typed app errors", () => {
  it("preserves explicit typed errors", () => {
    const error = new AppError("schema", "PROJECT_SCHEMA_INVALID", "Project schema is invalid.", {
      guidance: "Restore the recovery backup."
    });

    expect(normalizeAppError(error)).toEqual(error);
  });

  it("classifies cancellation, timeout, network, auth, and unknown failures", () => {
    expect(normalizeAppError(new DOMException("Cancelled", "AbortError"), "cancelled")).toMatchObject({ category: "cancelled", retryable: false });
    expect(normalizeAppError(new DOMException("Timed out", "AbortError"), "timeout")).toMatchObject({ category: "timeout", retryable: true });
    expect(normalizeAppError(new Error("Failed to fetch"))).toMatchObject({ category: "network", retryable: true });
    expect(normalizeAppError(new Error("Bearer token variable is empty."))).toMatchObject({ category: "auth", retryable: false });
    expect(normalizeAppError("unexpected")).toMatchObject({ category: "unknown", message: "unexpected" });
  });

  it("canonically redacts error text before it reaches diagnostics or display", () => {
    const normalized = normalizeAppError(new Error("Request failed at https://u:p@example.test/items?api_key=url-secret token=body-secret"));

    expect(normalized.message).toContain("https://example.test/items?api_key=********");
    expect(normalized.message).not.toMatch(/url-secret|body-secret|u:p/);
  });
});
