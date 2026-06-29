import { describe, expect, it } from "vitest";
import { formatResponseSize } from "./responseFormatting";

describe("response formatting", () => {
  it("keeps small response bodies in bytes", () => {
    expect(formatResponseSize("a".repeat(512))).toBe("512 B");
  });

  it("formats response bodies over one kilobyte as KB", () => {
    expect(formatResponseSize("a".repeat(3467))).toBe("3.4 KB");
    expect(formatResponseSize("a".repeat(16 * 1024))).toBe("16 KB");
  });

  it("formats response bodies over one megabyte as MB", () => {
    expect(formatResponseSize("a".repeat(1536 * 1024))).toBe("1.5 MB");
  });

  it("measures utf-8 bytes instead of JavaScript character count", () => {
    expect(formatResponseSize("é".repeat(512))).toBe("1 KB");
  });
});
