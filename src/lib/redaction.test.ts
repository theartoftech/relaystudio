import { describe, expect, it } from "vitest";
import { isSecretKey, redactRecord, redactText, redactUrl, redactValue } from "./redaction";

describe("redaction utilities", () => {
  it("classifies common secret keys", () => {
    expect(isSecretKey("Authorization")).toBe(true);
    expect(isSecretKey("clientSecret")).toBe(true);
    expect(isSecretKey("baseUrl")).toBe(false);
    expect(["apiKey", "api_key", "api-key", "x-api-key", "X_API_KEY"].every(isSecretKey)).toBe(true);
  });

  it("removes URL userinfo and redacts sensitive query values without hiding useful routing context", () => {
    expect(redactUrl("https://alice:password@example.test/orders?api_key=abc123&status=open#result")).toBe(
      "https://example.test/orders?api_key=********&status=open#result"
    );
    expect(redactUrl("/orders?token=abc123&status=open")).toBe("/orders?token=********&status=open");
  });

  it("redacts canonical secret spellings in raw text and embedded URLs", () => {
    const redacted = redactText("apiKey=one api_key=two api-key=three x-api-key=four https://u:p@example.test?a=1&token=five");

    expect(redacted).not.toMatch(/one|two|three|four|five|u:p/);
    expect(redacted).toContain("apiKey=********");
    expect(redacted).toContain("https://example.test/?a=1&token=********");
  });

  it("redacts bearer values with a stable display mask", () => {
    expect(redactValue("Authorization", "Bearer abc123")).toBe("Bearer ********");
  });

  it("redacts secret records without changing public values", () => {
    expect(
      redactRecord({
        Authorization: "Bearer abc123",
        baseUrl: "https://api.example.com"
      })
    ).toEqual({
      Authorization: "Bearer ********",
      baseUrl: "https://api.example.com"
    });
  });
});
