import { describe, expect, it } from "vitest";
import { createSampleProject, type ProjectService } from "../project/projectModel";
import { buildExecutableRequest, normalizeResponse } from "./serviceRunner";
import {
  LARGE_RESPONSE_WARNING_BYTES,
  artifactToExecutedResponse,
  assertSavedResponsePath,
  buildSavedResponseDraft,
  defaultSavedResponsePath,
  redactResponseBody,
  responseWarning,
  validateSavedResponseArtifact
} from "./savedResponses";

const project = createSampleProject("2026-06-21T00:00:00.000Z");
const qa = project.environments[0];
const login = project.services.find((service) => service.id === "login") as ProjectService;
const createOrder = project.services.find((service) => service.id === "create-order") as ProjectService;

describe("saved response artifacts", () => {
  it("builds JSON artifacts with metadata and redacted secret fields", () => {
    const request = buildExecutableRequest(login, qa);
    const response = normalizeResponse(login, {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accessToken: "secret-token",
        nested: { clientSecret: "client-secret", visible: "ok" }
      }),
      durationMs: 45
    });

    const draft = buildSavedResponseDraft({
      service: login,
      request,
      response,
      filePath: "/tmp/login.json",
      capturedAt: "2026-06-21T15:00:00.000Z"
    });

    expect(draft.metadata).toMatchObject({
      serviceId: "login",
      serviceName: "Login",
      fileName: "login.json",
      method: "POST",
      status: 200,
      bodyKind: "json",
      redacted: true
    });
    expect(draft.artifact.body).toContain('"accessToken": "********"');
    expect(draft.artifact.body).toContain('"clientSecret": "********"');
    expect(draft.artifact.body).toContain('"visible": "ok"');
    expect(draft.artifact.body).not.toContain("secret-token");
    expect(draft.warning).toBeNull();
  });

  it("classifies non-JSON responses as raw and warns clearly", () => {
    const request = buildExecutableRequest(createOrder, qa);
    const response = normalizeResponse(createOrder, {
      status: 202,
      statusText: "Accepted",
      headers: { "content-type": "text/plain" },
      body: "queued Authorization: Bearer raw-secret-token",
      durationMs: 12
    });

    const draft = buildSavedResponseDraft({
      service: createOrder,
      request,
      response,
      filePath: "/tmp/create-order.txt",
      capturedAt: "2026-06-21T15:00:00.000Z"
    });

    expect(draft.metadata.bodyKind).toBe("raw");
    expect(draft.artifact.body).toBe("queued Authorization: Bearer ********");
    expect(draft.warning).toBe("Non-JSON response saved as raw text.");
  });

  it("converts saved artifacts back into executable response viewer data", () => {
    const response = normalizeResponse(createOrder, {
      status: 403,
      statusText: "Forbidden",
      headers: { "content-type": "application/json" },
      body: `{"message":"forbidden"}`,
      durationMs: 30
    });
    const draft = buildSavedResponseDraft({
      service: createOrder,
      request: buildExecutableRequest(createOrder, qa),
      response,
      filePath: "/tmp/forbidden.json",
      capturedAt: "2026-06-21T15:00:00.000Z"
    });

    const opened = artifactToExecutedResponse(draft.artifact);

    expect(opened.ok).toBe(false);
    expect(opened.status).toBe(403);
    expect(opened.prettyBody).toContain('"message": "forbidden"');
    expect(opened.headers["x-relay-studio-saved-response"]).toBe("2026-06-21T15:00:00.000Z");
  });

  it("validates paths and artifact schema before persistence or reload", () => {
    expect(() => assertSavedResponsePath("")).toThrow("Saved response path is required.");
    expect(() => assertSavedResponsePath("/tmp/response.html")).toThrow("Saved response file must use the .json or .txt extension.");

    const response = normalizeResponse(createOrder, {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: "{}",
      durationMs: 1
    });
    const draft = buildSavedResponseDraft({
      service: createOrder,
      request: buildExecutableRequest(createOrder, qa),
      response,
      filePath: "/tmp/create-order.json"
    });

    expect(() => validateSavedResponseArtifact(draft.artifact)).not.toThrow();
    expect(() => validateSavedResponseArtifact({ ...draft.artifact, format: "unknown" as typeof draft.artifact.format })).toThrow("Unsupported saved response file format.");
    expect(() => validateSavedResponseArtifact({ ...draft.artifact, schemaVersion: 2 as typeof draft.artifact.schemaVersion })).toThrow("Unsupported saved response schema version: 2");
  });

  it("generates default paths and large response warnings", () => {
    const response = normalizeResponse(createOrder, {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: "{}",
      durationMs: 1
    });
    const rawResponse = normalizeResponse(createOrder, {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/plain" },
      body: "plain",
      durationMs: 1
    });

    expect(defaultSavedResponsePath(createOrder, response, "2026-06-21T15:00:00.000Z")).toBe("/private/tmp/create-order-2026-06-21T15-00-00-000Z.json");
    expect(defaultSavedResponsePath(createOrder, rawResponse, "2026-06-21T15:00:00.000Z")).toBe("/private/tmp/create-order-2026-06-21T15-00-00-000Z.txt");
    expect(responseWarning({
      ...project.savedResponses[0],
      sizeBytes: LARGE_RESPONSE_WARNING_BYTES + 1
    })).toBe("Large response saved. Reopening may take longer than usual.");
  });

  it("redacts malformed JSON-like and raw credential values defensively", () => {
    expect(redactResponseBody(`{"accessToken":"abc"`, "application/json")).toBe(`{"accessToken":"********"`);
    expect(redactResponseBody("token=abc123 password=secret", "text/plain")).toBe("token=\"********\" password=\"********\"");
    expect(redactResponseBody("", "application/json")).toBe("");
  });
});
