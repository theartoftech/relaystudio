import { describe, expect, it } from "vitest";
import { createSampleProject, type ProjectFlow, type ProjectService } from "../project/projectModel";
import { AppError } from "../lib/appError";
import {
  CODE_EXAMPLE_LANGUAGES,
  generateFlowCodeExample,
  generateRequestCodeExample,
  type CodeExampleLanguage
} from "./codeExamples";

const project = createSampleProject("2026-07-26T00:00:00.000Z");
const qa = project.environments[0];

function service(id: string): ProjectService {
  const match = project.services.find((item) => item.id === id);
  if (!match) throw new Error(`Missing test request: ${id}`);
  return match;
}

describe("REST code examples", () => {
  it("keeps the supported language list stable", () => {
    expect(CODE_EXAMPLE_LANGUAGES).toEqual([
      { id: "http", label: "HTTP" },
      { id: "curl", label: "cURL" },
      { id: "csharp", label: "C#" },
      { id: "java", label: "Java" },
      { id: "jquery", label: "jQuery" },
      { id: "node", label: "Node.js" },
      { id: "php", label: "PHP" },
      { id: "python", label: "Python" },
      { id: "ruby", label: "Ruby" }
    ]);
  });

  it.each(CODE_EXAMPLE_LANGUAGES)("generates a deterministic $label request fixture", ({ id }) => {
    const before = structuredClone(project);
    const first = generateRequestCodeExample(service("create-order"), qa, id);
    const second = generateRequestCodeExample(service("create-order"), qa, id);

    expect(first).toEqual(second);
    expect(first.requestCount).toBe(1);
    expect(first.code).toContain("https://api.example.com/api/orders");
    expect(first.code).toContain("productId");
    expect(first.code).not.toContain("sample-access-token");
    expect(first.code).not.toContain("sample-password");
    expect(project).toEqual(before);
    expect(first.code).toMatchSnapshot();
  });

  it("renders URL-encoded fields in request-model order", () => {
    const form: ProjectService = {
      ...service("create-order"),
      id: "profile-form",
      name: "Update Profile",
      method: "PATCH",
      authProfile: { type: "none" },
      auth: "none",
      body: {
        contentType: "application/x-www-form-urlencoded",
        raw: "",
        fields: [
          { id: "display-1", name: "displayName", value: "Relay Developer", enabled: true },
          { id: "tag-1", name: "tag", value: "api", enabled: true },
          { id: "tag-2", name: "category", value: "desktop", enabled: true }
        ]
      }
    };

    const example = generateRequestCodeExample(form, qa, "python");

    expect(example.code).toContain("('tag', 'api')");
    expect(example.code).toContain("('category', 'desktop')");
    expect(example.code).toContain("requests.patch");
  });

  it("uses multipart file placeholders without reading or exposing local paths", () => {
    const upload: ProjectService = {
      ...service("create-order"),
      id: "asset-upload",
      name: "Upload Asset",
      authProfile: { type: "none" },
      auth: "none",
      body: {
        contentType: "multipart/form-data",
        raw: "",
        fields: [
          { id: "description", name: "description", value: "Profile image", enabled: true, valueType: "text" },
          { id: "asset", name: "asset", value: "/Users/developer/private/avatar.png", enabled: true, valueType: "file", contentType: "image/png" }
        ]
      }
    };

    const example = generateRequestCodeExample(upload, qa, "curl");

    expect(example.code).toContain("<SELECT_FILE_FOR_ASSET>");
    expect(example.code).toContain("type=image/png");
    expect(example.code).not.toContain("/Users/developer");
  });

  it.each(CODE_EXAMPLE_LANGUAGES)("supports practical methods, forms, and multipart safety in $label", ({ id }) => {
    const getExample = generateRequestCodeExample(service("health-check"), qa, id);
    const patchExample = generateRequestCodeExample({
      ...service("create-order"),
      id: "profile-patch",
      name: "Patch Profile",
      method: "PATCH",
      auth: "none",
      authProfile: { type: "none" },
      body: {
        contentType: "application/x-www-form-urlencoded",
        raw: "",
        fields: [{ id: "display-name", name: "displayName", value: "Relay Developer", enabled: true }]
      }
    }, qa, id);
    const deleteExample = generateRequestCodeExample(service("cleanup-order"), qa, id);
    const multipartExample = generateRequestCodeExample({
      ...service("create-order"),
      id: "multipart-method-check",
      name: "Upload File",
      auth: "none",
      authProfile: { type: "none" },
      body: {
        contentType: "multipart/form-data",
        raw: "",
        fields: [{
          id: "asset",
          name: "asset",
          value: "/Users/developer/private/asset.bin",
          enabled: true,
          valueType: "file",
          contentType: "application/octet-stream"
        }]
      }
    }, qa, id);

    expect(getExample.code.toLowerCase()).toContain("get");
    expect(patchExample.code.toLowerCase()).toContain("patch");
    expect(deleteExample.code.toLowerCase()).toContain("delete");
    expect(multipartExample.code).toContain("<SELECT_FILE_FOR_ASSET>");
    expect(multipartExample.code).not.toContain("/Users/developer/private");
  });

  it("redacts credentials from URLs, headers, body fields, and secret variables", () => {
    const secretRequest: ProjectService = {
      ...service("login"),
      path: "/api/auth/login?api_key=literal-query-secret",
      headers: [
        { id: "cookie", name: "Cookie", value: "session=literal-cookie-secret", enabled: true },
        { id: "trace", name: "X-Trace", value: "{{password}}", enabled: true }
      ],
      body: {
        contentType: "application/json",
        raw: JSON.stringify({ username: "{{username}}", password: "literal-body-secret", note: "{{password}}" })
      }
    };

    const example = generateRequestCodeExample(secretRequest, qa, "node");

    for (const secret of ["literal-query-secret", "literal-cookie-secret", "literal-body-secret", "sample-password"]) {
      expect(example.code).not.toContain(secret);
    }
    expect(example.code).toContain("<REDACTED>");
    expect(example.code).toContain("<PASSWORD>");
  });

  it("redacts sensitive values nested in JSON arrays and preserves an explicit Host header", () => {
    const arrayBodyRequest: ProjectService = {
      ...service("create-order"),
      auth: "none",
      authProfile: { type: "none" },
      headers: [{ id: "host", name: "Host", value: "api.example.com", enabled: true }],
      body: {
        contentType: "application/json",
        raw: JSON.stringify([{ profile: { password: "array-password-canary" } }, { apiKey: 42 }])
      }
    };

    const example = generateRequestCodeExample(arrayBodyRequest, qa, "http");

    expect(example.code.match(/^Host:/gm)).toHaveLength(1);
    expect(example.code).not.toContain("array-password-canary");
    expect(example.code).toContain("<REDACTED>");
  });

  it("generates flow requests in dependency order with branch and mapping guidance", () => {
    const source = project.flows.find((item) => item.id === "authenticated-read") as ProjectFlow;
    const flow: ProjectFlow = {
      ...source,
      edges: [
        ...source.edges,
        {
          id: "login-failure-get-product",
          source: source.nodes[0].id,
          target: source.nodes[3].id,
          condition: "failure"
        }
      ]
    };

    const example = generateFlowCodeExample(flow, project.services, qa, "python");
    const loginIndex = example.code.indexOf("Login");
    const currentUserIndex = example.code.indexOf("Current User");
    const listProductsIndex = example.code.indexOf("List Products");
    const getProductIndex = example.code.indexOf("Get Product");

    expect(example.requestCount).toBe(4);
    expect(loginIndex).toBeGreaterThanOrEqual(0);
    expect(currentUserIndex).toBeGreaterThan(loginIndex);
    expect(listProductsIndex).toBeGreaterThan(currentUserIndex);
    expect(getProductIndex).toBeGreaterThan(listProductsIndex);
    expect(example.code).toContain("Run when Login succeeds");
    expect(example.code).toContain("Login fails");
    expect(example.code).toContain("Capture $.accessToken as <ACCESS_TOKEN>");
    expect(example.code).not.toContain("sample-access-token");
  });

  it("captures and reuses mapped response values in jQuery flows", () => {
    const flow = project.flows.find((item) => item.id === "authenticated-read") as ProjectFlow;

    const example = generateFlowCodeExample(flow, project.services, qa, "jquery");
    const capture = 'flowVariables["accessToken"] = responseData_step1["accessToken"];';
    const reuse = '"Authorization": "Bearer " + flowVariables["accessToken"]';

    expect(example.code).toContain("const flowVariables = {};");
    expect(example.code).toContain("const responseData_step1 = typeof response_step1 === \"string\" ? JSON.parse(response_step1) : response_step1;");
    expect(example.code).toContain(capture);
    expect(example.code).toContain(reuse);
    expect(example.code.indexOf(capture)).toBeLessThan(example.code.indexOf(reuse));
    expect(example.code).not.toContain('"Authorization": "Bearer <ACCESS_TOKEN>"');
  });

  it("captures and reuses mapped response values in Java flows", () => {
    const flow = project.flows.find((item) => item.id === "authenticated-read") as ProjectFlow;

    const example = generateFlowCodeExample(flow, project.services, qa, "java");
    const capture = 'flowVariables.put("accessToken", mappedValue_step1_accessToken.asText());';
    const reuse = '"Bearer " + flowVariables.get("accessToken")';

    expect(example.code).toContain("import com.fasterxml.jackson.databind.JsonNode;");
    expect(example.code).toContain("var objectMapper = new ObjectMapper();");
    expect(example.code).toContain("var flowVariables = new HashMap<String, String>();");
    expect(example.code).toContain("Credential placeholders such as <REDACTED> must be supplied securely before running");
    expect(example.code).toContain("if (response_step1.statusCode() < 200 || response_step1.statusCode() >= 300)");
    expect(example.code).toContain("Flow step 1 (Login) returned HTTP");
    expect(example.code).toContain("if (responseBody_step1 == null || responseBody_step1.isBlank())");
    expect(example.code).toContain("catch (com.fasterxml.jackson.core.JsonProcessingException error)");
    expect(example.code).toContain("Flow step 1 (Login) did not return valid JSON required by response mappings");
    expect(example.code).toContain("JsonNode responseData_step1;");
    expect(example.code).toContain("responseData_step1 = objectMapper.readTree(responseBody_step1);");
    expect(example.code).toContain('var mappedValue_step1_accessToken = responseData_step1.path("accessToken");');
    expect(example.code).toContain("if (mappedValue_step1_accessToken.isMissingNode() || mappedValue_step1_accessToken.isNull())");
    expect(example.code).toContain(capture);
    expect(example.code).toContain(reuse);
    expect(example.code.indexOf(capture)).toBeLessThan(example.code.indexOf(reuse));
    expect(example.code.indexOf("response_step1.statusCode() < 200")).toBeLessThan(example.code.indexOf("objectMapper.readTree(responseBody_step1)"));
    expect(example.code).not.toContain('"Bearer <ACCESS_TOKEN>"');
    expect(example.code).not.toContain("Invalid credentials");
  });

  it("renders Java root, indexed, and multiple mapped values safely", () => {
    const source = project.flows.find((item) => item.id === "authenticated-read") as ProjectFlow;
    const mappedEnvironment = {
      ...qa,
      variables: [
        ...qa.variables,
        { id: "numeric-token", name: "1token", value: "synthetic-mapped-token", secret: true }
      ]
    };
    const mappedServices = project.services.map((item) => item.id === "current-user"
      ? {
          ...item,
          authProfile: { type: "bearer" as const, tokenVariable: "1token" },
          headers: [
            ...item.headers,
            { id: "mapped-values", name: "X-Mapped-Values", value: "prefix-<OTHER_TOKEN>-<1TOKEN>", enabled: true },
            { id: "empty-value", name: "X-Empty-Value", value: "", enabled: true }
          ]
        }
      : item);
    const rootFlow: ProjectFlow = {
      ...source,
      mappings: [
        { ...source.mappings[0], jsonPath: "$", variableName: "1token" },
        { ...source.mappings[0], id: "other-token", jsonPath: "$.other", variableName: "otherToken" }
      ]
    };
    const indexedFlow: ProjectFlow = {
      ...source,
      mappings: [{ ...source.mappings[0], jsonPath: "$.tokens[0].value" }]
    };

    const rootExample = generateFlowCodeExample(rootFlow, mappedServices, mappedEnvironment, "java");
    const indexedExample = generateFlowCodeExample(indexedFlow, project.services, qa, "java");

    expect(rootExample.code).toContain("var mappedValue_step1__1token = responseData_step1;");
    expect(rootExample.code).toContain('"Bearer " + flowVariables.get("1token")');
    expect(rootExample.code).toContain('"prefix-" + flowVariables.get("otherToken") + "-" + flowVariables.get("1token")');
    expect(rootExample.code).toContain('requestBuilder_step2.header("X-Empty-Value", "")');
    expect(indexedExample.code).toContain('responseData_step1.path("tokens").path(0).path("value")');
  });

  it("renders supported jQuery JSONPath mappings and rejects unsupported paths", () => {
    const source = project.flows.find((item) => item.id === "authenticated-read") as ProjectFlow;
    const rootMappingFlow: ProjectFlow = {
      ...source,
      mappings: [{ ...source.mappings[0], jsonPath: "$", variableName: "loginResponse" }]
    };
    const indexedMappingFlow: ProjectFlow = {
      ...source,
      mappings: [{ ...source.mappings[0], jsonPath: "$.tokens[0].value" }]
    };
    const unsupportedRootFlow: ProjectFlow = {
      ...source,
      mappings: [{ ...source.mappings[0], jsonPath: "$token" }]
    };
    const unsupportedSegmentFlow: ProjectFlow = {
      ...source,
      mappings: [{ ...source.mappings[0], jsonPath: "$.tokens[*]" }]
    };

    expect(generateFlowCodeExample(rootMappingFlow, project.services, qa, "jquery").code)
      .toContain('flowVariables["loginResponse"] = responseData_step1;');
    expect(generateFlowCodeExample(indexedMappingFlow, project.services, qa, "jquery").code)
      .toContain('responseData_step1["tokens"][0]["value"]');
    expect(() => generateFlowCodeExample(unsupportedRootFlow, project.services, qa, "jquery"))
      .toThrow("Mapping accessToken has invalid JSONPath");
    expect(() => generateFlowCodeExample(unsupportedSegmentFlow, project.services, qa, "jquery"))
      .toThrow("Mapping accessToken has invalid JSONPath");
  });

  it("replaces a supplied multipart content type with Java's generated boundary", () => {
    const upload: ProjectService = {
      ...service("create-order"),
      id: "java-boundary-upload",
      auth: "none",
      authProfile: { type: "none" },
      headers: [
        { id: "content-type", name: "Content-Type", value: "multipart/form-data", enabled: true },
        { id: "trace", name: "X-Trace", value: "safe-trace", enabled: true }
      ],
      body: {
        contentType: "multipart/form-data",
        raw: "",
        fields: [{ id: "asset", name: "asset", value: "/private/asset.bin", enabled: true, valueType: "file" }]
      }
    };

    const example = generateRequestCodeExample(upload, qa, "java");

    expect(example.code.match(/requestBuilder\.header\("Content-Type"/g)).toHaveLength(1);
    expect(example.code).toContain('"multipart/form-data; boundary=" + boundary');
    expect(example.code).toContain('requestBuilder.header("X-Trace", "safe-trace")');
  });

  it("deduplicates Java charset imports for mixed form flows", () => {
    const source = project.flows.find((item) => item.id === "authenticated-read") as ProjectFlow;
    const loginNode = source.nodes[0];
    const currentUserNode = source.nodes[1];
    const mixedServices: ProjectService[] = [
      {
        ...service("login"),
        auth: "none",
        authProfile: { type: "none" },
        body: {
          contentType: "application/x-www-form-urlencoded",
          raw: "",
          fields: [{ id: "username", name: "username", value: "relay-user", enabled: true }]
        }
      },
      {
        ...service("current-user"),
        method: "POST",
        auth: "none",
        authProfile: { type: "none" },
        body: {
          contentType: "multipart/form-data",
          raw: "",
          fields: [{ id: "note", name: "note", value: "relay-note", enabled: true, valueType: "text" }]
        }
      }
    ];
    const mixedFlow: ProjectFlow = {
      ...source,
      steps: [loginNode.serviceId, currentUserNode.serviceId],
      nodes: [loginNode, currentUserNode],
      edges: source.edges.filter((edge) => edge.source === loginNode.id && edge.target === currentUserNode.id),
      mappings: []
    };

    const example = generateFlowCodeExample(mixedFlow, mixedServices, qa, "java");

    expect(example.code.match(/import java\.nio\.charset\.StandardCharsets;/g)).toHaveLength(1);
    expect(example.code).toContain("URLEncoder.encode");
    expect(example.code).toContain("RelayStudioBoundary-");
  });

  it.each(CODE_EXAMPLE_LANGUAGES)("generates a complete dependency-ordered flow in $label", ({ id }) => {
    const flow = project.flows.find((item) => item.id === "authenticated-read") as ProjectFlow;

    const example = generateFlowCodeExample(flow, project.services, qa, id);

    expect(example.requestCount).toBe(4);
    expect(example.code).toContain("Step 1: Login");
    expect(example.code).toContain("Step 4: Get Product");
    expect(example.code).not.toContain("sample-access-token");
  });

  it.each(CODE_EXAMPLE_LANGUAGES)("renders text and mixed multipart bodies safely in $label", ({ id }) => {
    const textExample = generateRequestCodeExample({
      ...service("create-order"),
      id: "text-body",
      name: "Text Body",
      auth: "none",
      authProfile: { type: "none" },
      body: { contentType: "text/plain", raw: "plain request body" }
    }, qa, id);
    const multipartExample = generateRequestCodeExample({
      ...service("create-order"),
      id: "mixed-multipart",
      name: "Mixed Multipart",
      auth: "none",
      authProfile: { type: "none" },
      body: {
        contentType: "multipart/form-data",
        raw: "",
        fields: [
          { id: "caption", name: "caption", value: "Relay asset", enabled: true, valueType: "text" },
          { id: "attachment", name: "attachment", value: "/private/attachment.bin", enabled: true, valueType: "file" }
        ]
      }
    }, qa, id);

    expect(textExample.code).toContain("plain request body");
    expect(multipartExample.code).toContain("Relay asset");
    expect(multipartExample.code).toContain("<SELECT_FILE_FOR_ATTACHMENT>");
    expect(multipartExample.code).not.toContain("/private/attachment.bin");
  });

  it.each([
    [{ type: "bearer", tokenVariable: "accessToken" }, "Bearer <ACCESS_TOKEN>"],
    [{ type: "apiKey", apiKeyLocation: "header", apiKeyName: "X-Test-API-Key", apiKeyValue: "literal-api-key" }, "X-Test-API-Key"],
    [{ type: "basic", usernameVariable: "username", passwordVariable: "password" }, "Basic <BASE64_USERNAME_PASSWORD>"],
    [{ type: "oauthClientCredentials", tokenUrl: "https://api.example.com/token", clientIdVariable: "username", clientSecretVariable: "password", scope: "" }, "Bearer <OAUTH_ACCESS_TOKEN>"],
    [{ type: "customHeader", customHeaderName: "X-Custom-Auth", customHeaderValue: "literal-custom-secret" }, "X-Custom-Auth"]
  ] as const)("renders safe placeholders for the %s authorization profile", (authProfile, expected) => {
    const example = generateRequestCodeExample({
      ...service("health-check"),
      auth: authProfile.type,
      authProfile
    }, qa, "http");

    expect(example.code).toContain(expected);
    expect(example.code).not.toContain("literal-api-key");
    expect(example.code).not.toContain("literal-custom-secret");
  });

  it("rejects unsupported languages and flows over the request limit", () => {
    const excessiveFlow: ProjectFlow = {
      id: "excessive-flow",
      name: "Excessive Flow",
      steps: Array.from({ length: 101 }, () => "health-check"),
      nodes: Array.from({ length: 101 }, (_, index) => ({
        id: `node-${index}`,
        type: "service" as const,
        serviceId: "health-check",
        label: `Health ${index}`,
        status: "idle" as const,
        position: { x: index * 10, y: 0 }
      })),
      edges: [],
      mappings: []
    };

    expect(() => generateRequestCodeExample(service("health-check"), qa, "go" as CodeExampleLanguage)).toThrow("Unsupported code example language");
    expect(() => generateFlowCodeExample(excessiveFlow, project.services, qa, "curl")).toThrow("safe limit is 100");
  });

  it("rejects invalid requests, invalid flows, and excessive output with typed errors", () => {
    const invalidRequest = { ...service("login"), path: "api/login" };
    const cyclicFlow = structuredClone(project.flows[0]);
    cyclicFlow.edges.push({
      id: "cycle",
      source: cyclicFlow.nodes[cyclicFlow.nodes.length - 1].id,
      target: cyclicFlow.nodes[0].id,
      condition: "success"
    });
    const oversizedRequest = {
      ...service("login"),
      body: { contentType: "text/plain" as const, raw: "x".repeat(300_000) }
    };

    expect(() => generateRequestCodeExample(invalidRequest, qa, "http")).toThrowError(AppError);
    expect(() => generateRequestCodeExample(invalidRequest, qa, "http")).toThrow("Path must start with /");
    expect(() => generateFlowCodeExample(cyclicFlow, project.services, qa, "curl")).toThrow("cycle");
    expect(() => generateRequestCodeExample(oversizedRequest, qa, "ruby")).toThrow("safe limit");
  });
});
