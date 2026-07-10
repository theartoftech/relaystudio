import { describe, expect, it } from "vitest";
import { buildDefaultProjectPath, isBrowserFallbackProjectPath, joinProjectPath, slugProjectFileName } from "./defaultProjectPath";

describe("default project paths", () => {
  it("builds browser fallback paths with restproj file names", () => {
    expect(buildDefaultProjectPath("Sample API Regression")).toBe("/private/tmp/sample-api-regression.restproj");
  });

  it("builds Windows paths with backslash separators", () => {
    expect(buildDefaultProjectPath("Test Jefferyhaynes Net", "C:\\Users\\JeffHaynes\\Documents\\relaystudio"))
      .toBe("C:\\Users\\JeffHaynes\\Documents\\relaystudio\\test-jefferyhaynes-net.restproj");
  });

  it("normalizes trailing separators without silently dropping the file name", () => {
    expect(joinProjectPath("C:\\Users\\JeffHaynes\\Documents\\relaystudio\\", "sample.restproj"))
      .toBe("C:\\Users\\JeffHaynes\\Documents\\relaystudio\\sample.restproj");
    expect(joinProjectPath("/Users/jeffhaynes/Documents/relaystudio/", "sample.restproj"))
      .toBe("/Users/jeffhaynes/Documents/relaystudio/sample.restproj");
  });

  it("uses an explicit fallback name for blank project names", () => {
    expect(slugProjectFileName("  ")).toBe("relay-studio-project.restproj");
  });

  it("identifies browser fallback paths", () => {
    expect(isBrowserFallbackProjectPath("/private/tmp/sample.restproj")).toBe(true);
    expect(isBrowserFallbackProjectPath("C:\\Users\\JeffHaynes\\Documents\\relaystudio\\sample.restproj")).toBe(false);
  });
});
