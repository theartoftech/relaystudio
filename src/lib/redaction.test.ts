import { describe, expect, it } from "vitest";
import { isSecretKey, redactRecord, redactValue } from "./redaction";

describe("redaction utilities", () => {
  it("classifies common secret keys", () => {
    expect(isSecretKey("Authorization")).toBe(true);
    expect(isSecretKey("clientSecret")).toBe(true);
    expect(isSecretKey("baseUrl")).toBe(false);
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
