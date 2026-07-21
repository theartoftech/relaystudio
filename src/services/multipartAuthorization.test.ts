import { describe, expect, it } from "vitest";
import { approveMultipartFile, assertMultipartFilesApproved, isMultipartFileApproved, type MultipartFileApproval } from "./multipartAuthorization";
import { createSampleProject } from "../project/projectModel";

describe("multipart file session authorization", () => {
  const service = {
    ...createSampleProject().services[0],
    id: "upload",
    body: {
      contentType: "multipart/form-data" as const,
      raw: "",
      fields: [{ id: "asset", name: "asset", value: "/private/tmp/private.txt", enabled: true, valueType: "file" as const }]
    }
  };

  it("binds approval to the exact service, field, file path, and destination origin", () => {
    const approval = approveMultipartFile(service, "asset", "https://api.example.test/uploads");

    expect(isMultipartFileApproved(approval, service, "asset", "https://api.example.test/other")).toBe(true);
    expect(isMultipartFileApproved(approval, service, "asset", "https://other.example.test/uploads")).toBe(false);
    expect(isMultipartFileApproved(approval, { ...service, body: { ...service.body, fields: [{ ...service.body.fields![0], value: "/tmp/other.txt" }] } }, "asset", "https://api.example.test/uploads")).toBe(false);
  });

  it("rejects ordinary send until every enabled file is approved for this session", () => {
    const approvals: MultipartFileApproval[] = [];

    expect(() => assertMultipartFilesApproved(approvals, service, "https://api.example.test/uploads")).toThrow(
      "Approve local file 'private.txt' for https://api.example.test before sending."
    );
    approvals.push(approveMultipartFile(service, "asset", "https://api.example.test/uploads"));
    expect(() => assertMultipartFilesApproved(approvals, service, "https://api.example.test/uploads")).not.toThrow();
  });

  it("throws actionable errors for malformed destinations and missing file rows", () => {
    expect(() => approveMultipartFile(service, "missing", "https://api.example.test/uploads")).toThrow("Multipart file field was not found");
    expect(() => approveMultipartFile(service, "asset", "/relative")).toThrow("Multipart file approval requires an absolute HTTP(S) destination");
    expect(() => approveMultipartFile({ ...service, body: { ...service.body, fields: [{ ...service.body.fields![0], value: "" }] } }, "asset", "https://api.example.test/uploads")).toThrow("Choose a local multipart file");
    expect(() => approveMultipartFile(service, "asset", "ftp://api.example.test/uploads")).toThrow("absolute HTTP(S) destination");
  });

  it("ignores non-file and disabled rows while keeping missing bodies harmless", () => {
    const noBody = { ...service, body: { contentType: "none" as const, raw: "" } };
    const ignoredRows = {
      ...service,
      body: {
        ...service.body,
        fields: [
          { ...service.body.fields![0], enabled: false },
          { id: "note", name: "note", value: "visible", enabled: true, valueType: "text" as const }
        ]
      }
    };

    expect(() => assertMultipartFilesApproved([], noBody, "https://api.example.test/uploads")).not.toThrow();
    expect(() => assertMultipartFilesApproved([], ignoredRows, "https://api.example.test/uploads")).not.toThrow();
    expect(isMultipartFileApproved(approveMultipartFile(service, "asset", "https://api.example.test/uploads"), service, "missing", "https://api.example.test/uploads")).toBe(false);
  });
});
