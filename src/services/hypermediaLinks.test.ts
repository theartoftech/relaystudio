import { describe, expect, it } from "vitest";
import { createSampleProject, type AuthProfile, type ProjectService } from "../project/projectModel";
import { createLinkedGetService, tokenizeJsonResponseLinks } from "./hypermediaLinks";

const project = createSampleProject("2026-07-29T00:00:00.000Z");
const source = project.services.find((service) => service.id === "create-order") as ProjectService;

describe("hypermedia response links", () => {
  it("creates a same-origin GET request with copied authorization and no source payload", () => {
    const linked = createLinkedGetService({
      sourceService: source,
      sourceRequestUrl: "http://localhost:8080/api/contacts",
      targetUrl: "http://localhost:8080/api/profile/contacts?projection=summary&sort=name#ignored",
      existingServiceIds: ["linked-get-api-profile-contacts"]
    });

    expect(linked).toMatchObject({
      id: "linked-get-api-profile-contacts-2",
      name: "GET /api/profile/contacts",
      folder: source.folder,
      method: "GET",
      path: "/api/profile/contacts",
      auth: source.auth,
      authProfile: source.authProfile,
      headers: [{ name: "Accept", value: "application/json", enabled: true }],
      queryParams: [
        { name: "projection", value: "summary", enabled: true },
        { name: "sort", value: "name", enabled: true }
      ],
      pathParams: [],
      body: { contentType: "none", raw: "" }
    });
    expect(linked.authProfile).not.toBe(source.authProfile);
    expect(linked.headers).not.toBe(source.headers);
    expect(linked.timeoutMs).toBe(source.timeoutMs);
    expect(linked.retry).toEqual(source.retry);
    expect(linked.retry).not.toBe(source.retry);
  });

  it("copies every supported authorization profile independently", () => {
    const profiles: AuthProfile[] = [
      { type: "none" },
      { type: "bearer", tokenVariable: "accessToken" },
      { type: "apiKey", apiKeyName: "X-API-Key", apiKeyValue: "{{apiKey}}" },
      { type: "basic", usernameVariable: "username", passwordVariable: "password" },
      { type: "oauthClientCredentials", clientIdVariable: "clientId", clientSecretVariable: "clientSecret", tokenUrl: "{{baseUrl}}/oauth/token" },
      { type: "customHeader", customHeaderName: "X-Custom-Auth", customHeaderValue: "{{customAuth}}" }
    ];

    for (const profile of profiles) {
      const sourceWithProfile = { ...source, auth: profile.type, authProfile: profile };
      const linked = createLinkedGetService({
        sourceService: sourceWithProfile,
        sourceRequestUrl: "https://api.example.com/orders",
        targetUrl: "https://api.example.com/profile",
        existingServiceIds: []
      });
      expect(linked.auth).toBe(profile.type);
      expect(linked.authProfile).toEqual(profile);
      expect(linked.authProfile).not.toBe(profile);
    }
  });

  it("rejects invalid, credential-bearing, non-HTTP, and cross-origin destinations", () => {
    const create = (targetUrl: string) => createLinkedGetService({
      sourceService: source,
      sourceRequestUrl: "http://localhost:8080/api/contacts",
      targetUrl,
      existingServiceIds: []
    });

    expect(() => create("not a URL")).toThrow("absolute HTTP or HTTPS URL");
    expect(() => create("ftp://localhost:8080/private")).toThrow("absolute HTTP or HTTPS URL");
    expect(() => create("http://admin:secret@localhost:8080/private")).toThrow("cannot contain embedded credentials");
    expect(() => create("https://attacker.example/private")).toThrow("will not copy authorization to a different origin");
    expect(() => create("http://localhost:8080/items?tag=one&tag=two")).toThrow("duplicate query parameter");
    expect(() => createLinkedGetService({
      sourceService: source,
      sourceRequestUrl: "relative/source",
      targetUrl: "http://localhost:8080/items",
      existingServiceIds: []
    })).toThrow("source request URL must be an absolute HTTP or HTTPS URL");
  });

  it("creates unique root request identities without query parameters", () => {
    const first = createLinkedGetService({
      sourceService: source,
      sourceRequestUrl: "https://api.example.com/orders",
      targetUrl: "https://api.example.com/",
      existingServiceIds: []
    });
    const third = createLinkedGetService({
      sourceService: source,
      sourceRequestUrl: "https://api.example.com/orders",
      targetUrl: "https://api.example.com/",
      existingServiceIds: ["linked-get-root", "linked-get-root-2"]
    });

    expect(first).toMatchObject({ id: "linked-get-root", name: "GET /", path: "/", queryParams: [] });
    expect(third.id).toBe("linked-get-root-3");
  });

  it("turns only HTTP(S) JSON string values into response-link tokens", () => {
    const body = JSON.stringify({
      "https://example.test/key": "not linked as a key",
      profile: { href: "http://localhost:8080/api/profile/contacts" },
      secure: "https://example.test/items/1?q=hello world",
      script: "javascript:alert(1)"
    }, null, 2);
    const tokens = tokenizeJsonResponseLinks(body);

    expect(tokens.filter((token) => token.href).map((token) => token.href)).toEqual([
      "http://localhost:8080/api/profile/contacts",
      "https://example.test/items/1?q=hello%20world"
    ]);
    expect(tokens.map((token) => token.text).join("")).toBe(body);
  });

  it("leaves malformed JSON and ordinary text untouched", () => {
    expect(tokenizeJsonResponseLinks("{ broken")).toEqual([{ text: "{ broken" }]);
    expect(tokenizeJsonResponseLinks("Visit https://example.test")).toEqual([{ text: "Visit https://example.test" }]);
  });
});
