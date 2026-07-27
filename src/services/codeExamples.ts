import { AppError } from "../lib/appError";
import {
  isSecretKey,
  redactJsonValue,
  redactText,
  redactUrl,
  REDACTION_MASK
} from "../lib/redaction";
import type {
  KeyValueRow,
  ProjectEnvironment,
  ProjectFlow,
  FlowMapping,
  ProjectService
} from "../project/projectModel";
import { orderFlowNodes, resolveFlowNodeService, validateFlow } from "./flowBuilder";
import {
  MAX_CODE_EXAMPLE_FLOW_REQUESTS,
  MAX_CODE_EXAMPLE_OUTPUT_BYTES,
  assertUtf8ByteLimit
} from "./resourceLimits";
import { buildExecutableRequest } from "./serviceRunner";
import { resolveTemplate, validateService } from "./serviceDesigner";

export const CODE_EXAMPLE_LANGUAGES = [
  { id: "http", label: "HTTP" },
  { id: "curl", label: "cURL" },
  { id: "csharp", label: "C#" },
  { id: "java", label: "Java" },
  { id: "jquery", label: "jQuery" },
  { id: "node", label: "Node.js" },
  { id: "php", label: "PHP" },
  { id: "python", label: "Python" },
  { id: "ruby", label: "Ruby" }
] as const;

export type CodeExampleLanguage = typeof CODE_EXAMPLE_LANGUAGES[number]["id"];

export interface CodeExample {
  title: string;
  language: CodeExampleLanguage;
  code: string;
  requestCount: number;
  warnings: string[];
}

interface CodeField {
  name: string;
  value: string;
  kind: "text" | "file";
  contentType: string | null;
}

type CodeBody =
  | { kind: "none" }
  | { kind: "raw"; contentType: "application/json" | "text/plain"; value: string }
  | { kind: "urlencoded"; fields: CodeField[] }
  | { kind: "multipart"; fields: CodeField[] };

interface CodeRequest {
  name: string;
  method: ProjectService["method"];
  url: string;
  headers: Array<[string, string]>;
  body: CodeBody;
}

interface RenderOptions {
  includePreamble: boolean;
  stepIndex?: number;
  flowVariableNames?: string[];
}

const codeExampleLabel = "Generated code example";

export function isCodeExampleLanguage(value: string): value is CodeExampleLanguage {
  return CODE_EXAMPLE_LANGUAGES.some((language) => language.id === value);
}

export function generateRequestCodeExample(
  service: ProjectService,
  environment: ProjectEnvironment,
  language: CodeExampleLanguage
): CodeExample {
  assertLanguage(language);
  const request = buildCodeRequest(service, environment);
  const code = renderRequest(language, request, { includePreamble: true });
  assertCodeOutput(code);
  assertNoCredentialCanaries(code, collectCredentialCanaries(service, environment));
  return {
    title: service.name,
    language,
    code,
    requestCount: 1,
    warnings: request.body.kind === "multipart" && request.body.fields.some((field) => field.kind === "file")
      ? ["Replace each file placeholder with a path or file object approved for the destination before running this example."]
      : []
  };
}

export function generateFlowCodeExample(
  flow: ProjectFlow,
  services: ProjectService[],
  environment: ProjectEnvironment,
  language: CodeExampleLanguage
): CodeExample {
  assertLanguage(language);
  const issues = validateFlow(flow, services).filter((issue) => issue.severity === "error");
  if (issues.length > 0) {
    throw new AppError(
      "flow",
      "CODE_EXAMPLE_INVALID_FLOW",
      `Cannot generate code for ${flow.name}: ${issues.map((issue) => issue.message).join(" ")}`,
      { guidance: "Repair the highlighted flow steps, links, or mappings and try again." }
    );
  }
  const orderedNodes = orderFlowNodes(flow);
  if (orderedNodes.length > MAX_CODE_EXAMPLE_FLOW_REQUESTS) {
    throw new AppError(
      "flow",
      "CODE_EXAMPLE_FLOW_TOO_LARGE",
      `Cannot generate code for ${flow.name}: the flow has ${orderedNodes.length} requests and the safe limit is ${MAX_CODE_EXAMPLE_FLOW_REQUESTS}.`,
      { guidance: "Split the flow into smaller developer examples." }
    );
  }

  const normalizedRequests = orderedNodes.map((node) => {
    const service = resolveFlowNodeService(node, services).service;
    if (!service) {
      throw new AppError("flow", "CODE_EXAMPLE_MISSING_REQUEST", `Cannot generate code: missing request for flow step ${node.label}.`);
    }
    return { node, service, request: buildCodeRequest(service, environment) };
  });
  const comment = commentPrefix(language);
  const sections = normalizedRequests.map(({ node, request }, index) => {
    const incoming = flow.edges.filter((edge) => edge.target === node.id);
    const prerequisites = incoming.map((edge) => {
      const source = orderedNodes.find((candidate) => candidate.id === edge.source);
      return `${source?.label ?? edge.source} ${edge.condition === "success" ? "succeeds" : "fails"}`;
    });
    const mappings = flow.mappings.filter((mapping) => mapping.sourceNodeId === node.id);
    const precedingNodeIds = new Set(orderedNodes.slice(0, index).map((precedingNode) => precedingNode.id));
    const availableVariableNames = flow.mappings
      .filter((mapping) => precedingNodeIds.has(mapping.sourceNodeId))
      .map((mapping) => mapping.variableName);
    const guidance = [
      `${comment} Step ${index + 1}: ${node.label}`,
      prerequisites.length > 0
        ? `${comment} Run when ${joinConditions(prerequisites)}.`
        : `${comment} Entry step.`,
      ...mappings.map((mapping) => (
        `${comment} Capture ${mapping.jsonPath} as ${secretPlaceholder(mapping.variableName)}${mapping.secret ? " (secret)" : ""}.`
      ))
    ];
    const renderedRequest = renderRequest(language, request, {
      includePreamble: false,
      stepIndex: index + 1,
      flowVariableNames: availableVariableNames
    });
    const captures = renderFlowMappingCaptures(language, mappings, index + 1, node.label);
    return `${guidance.join("\n")}\n${renderedRequest}${captures ? `\n${captures}` : ""}`;
  });
  const header = [
    `${comment} Flow: ${flow.name}`,
    `${comment} Requests are ordered by Relay Studio dependencies.`,
    `${comment} Branch comments preserve success/failure prerequisites; adapt them to your application's control flow.`,
    `${comment} Credential placeholders such as <REDACTED> must be supplied securely before running; Relay Studio never exports credentials.`
  ].join("\n");
  const preamble = renderFlowPreamble(language, normalizedRequests.map(({ request }) => request), flow.mappings);
  const code = `${header}${preamble ? `\n\n${preamble}` : ""}\n\n${sections.join(`\n\n${comment} ${"-".repeat(72)}\n\n`)}`;
  assertCodeOutput(code);
  for (const { service } of normalizedRequests) {
    assertNoCredentialCanaries(code, collectCredentialCanaries(service, environment));
  }
  return {
    title: flow.name,
    language,
    code,
    requestCount: normalizedRequests.length,
    warnings: [language === "java" || language === "jquery"
      ? `The ${language === "java" ? "Java" : "jQuery"} flow example applies response mappings in dependency order. Add application-specific success and failure condition handling before running branched flows.`
      : "Flow examples show dependency order, branch prerequisites, and response mappings. Add application-specific condition and JSONPath handling before running branched flows."]
  };
}

function buildCodeRequest(service: ProjectService, environment: ProjectEnvironment): CodeRequest {
  if (service.body.raw) assertCodeOutput(service.body.raw);
  const blockingIssues = validateService(service, environment).filter((issue) => issue.severity === "error");
  if (blockingIssues.length > 0) {
    throw new AppError(
      "validation",
      "CODE_EXAMPLE_INVALID_REQUEST",
      `Cannot generate code for ${service.name || "this request"}: ${blockingIssues.map((issue) => issue.message).join(" ")}`,
      { guidance: "Correct the request validation errors and try again." }
    );
  }

  const safeEnvironment = redactEnvironment(environment);
  const serviceWithoutAuth: ProjectService = {
    ...service,
    auth: "none",
    authProfile: { type: "none" }
  };

  try {
    const executable = buildExecutableRequest(serviceWithoutAuth, safeEnvironment);
    const headerMap = new Map<string, [string, string]>();
    for (const [name, value] of Object.entries(executable.redactedHeaders)) {
      headerMap.set(name.toLowerCase(), [name, normalizeRedactionMask(value)]);
    }
    const authHeader = codeAuthHeader(service);
    if (authHeader) headerMap.set(authHeader[0].toLowerCase(), authHeader);

    return {
      name: service.name,
      method: service.method,
      url: normalizeRedactionMask(redactUrl(executable.url)),
      headers: [...headerMap.values()].sort(([first], [second]) => first.localeCompare(second, undefined, { sensitivity: "base" })),
      body: buildCodeBody(service, safeEnvironment, executable.body)
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = redactText(error instanceof Error ? error.message : String(error));
    throw new AppError(
      "validation",
      "CODE_EXAMPLE_BUILD_FAILED",
      `Cannot generate code for ${service.name}: ${message}`,
      { guidance: "Review the request body, enabled fields, and variables and try again.", cause: error }
    );
  }
}

function buildCodeBody(service: ProjectService, environment: ProjectEnvironment, executableBody: string | null): CodeBody {
  if (service.body.contentType === "none") return { kind: "none" };
  if (service.body.contentType === "application/json") {
    if (!executableBody) return { kind: "raw", contentType: service.body.contentType, value: "" };
    const parsed = JSON.parse(executableBody) as unknown;
    return {
      kind: "raw",
      contentType: service.body.contentType,
      value: normalizeRedactionMask(JSON.stringify(redactJsonValue(parsed), null, 2))
    };
  }
  if (service.body.contentType === "text/plain") {
    return {
      kind: "raw",
      contentType: service.body.contentType,
      value: normalizeRedactionMask(redactText(executableBody ?? ""))
    };
  }

  const fields = (service.body.fields ?? [])
    .filter((field) => field.enabled)
    .map((field): CodeField => ({
      name: field.name,
      value: field.valueType === "file"
        ? filePlaceholder(field.name)
        : isSecretKey(field.name)
          ? "<REDACTED>"
          : normalizeRedactionMask(redactText(resolveTemplate(field.value, environment, false))),
      kind: field.valueType === "file" ? "file" : "text",
      contentType: field.contentType?.trim() || null
    }));
  return service.body.contentType === "application/x-www-form-urlencoded"
    ? { kind: "urlencoded", fields }
    : { kind: "multipart", fields };
}

function redactEnvironment(environment: ProjectEnvironment): ProjectEnvironment {
  return {
    ...environment,
    variables: environment.variables.map((variable) => ({
      ...variable,
      value: variable.secret || isSecretKey(variable.name)
        ? secretPlaceholder(variable.name)
        : variable.value
    }))
  };
}

function codeAuthHeader(service: ProjectService): [string, string] | null {
  const auth = service.authProfile;
  if (auth.type === "none") return null;
  if (auth.type === "bearer") return ["Authorization", `Bearer ${secretPlaceholder(auth.tokenVariable || "bearerToken")}`];
  if (auth.type === "apiKey") return [auth.apiKeyName?.trim() || "X-API-Key", "<API_KEY>"];
  if (auth.type === "basic") return ["Authorization", "Basic <BASE64_USERNAME_PASSWORD>"];
  if (auth.type === "oauthClientCredentials") return ["Authorization", "Bearer <OAUTH_ACCESS_TOKEN>"];
  return [auth.customHeaderName?.trim() || "X-Custom-Auth", "<CUSTOM_AUTH_VALUE>"];
}

function renderRequest(language: CodeExampleLanguage, request: CodeRequest, options: RenderOptions): string {
  if (language === "http") return renderHttp(request);
  if (language === "curl") return renderCurl(request);
  if (language === "csharp") return renderCSharp(request, options);
  if (language === "java") return renderJava(request, options);
  if (language === "jquery") return renderJQuery(request, options);
  if (language === "node") return renderNode(request, options);
  if (language === "php") return renderPhp(request, options);
  if (language === "python") return renderPython(request, options);
  return renderRuby(request, options);
}

function renderFlowPreamble(language: CodeExampleLanguage, requests: CodeRequest[], mappings: FlowMapping[]): string {
  if (language === "csharp") {
    return [
      "using System.Collections.Generic;",
      "using System.IO;",
      "using System.Net.Http;",
      "using System.Text;",
      "",
      "using var client = new HttpClient();"
    ].join("\n");
  }
  if (language === "java") {
    const mappingSetup = mappings.length > 0
      ? [
          "",
          "// Requires com.fasterxml.jackson.core:jackson-databind for JSON response mappings.",
          "var objectMapper = new ObjectMapper();",
          "var flowVariables = new HashMap<String, String>();"
        ]
      : [];
    return javaImports(requests, mappings.length > 0)
      .concat("", "var client = HttpClient.newHttpClient();", ...mappingSetup)
      .join("\n");
  }
  if (language === "jquery") return "const flowVariables = {};";
  if (language === "node" && requests.some((request) => request.body.kind === "multipart")) {
    return "import { openAsBlob } from \"node:fs\";";
  }
  if (language === "php") return "<?php";
  if (language === "python") return "import requests";
  if (language === "ruby") return "require 'net/http'\nrequire 'uri'";
  return "";
}

function renderHttp(request: CodeRequest): string {
  const parsed = parseCodeUrl(request.url);
  const headers = new Map(request.headers);
  if (!hasHeader(headers, "host")) headers.set("Host", parsed.host);
  const lines = [
    `# ${request.name}`,
    `# URL: ${request.url}`,
    `${request.method} ${parsed.path} HTTP/1.1`,
    ...[...headers].map(([name, value]) => `${name}: ${value}`)
  ];
  const body = serializedBody(request.body);
  if (body) lines.push("", body);
  return lines.join("\n");
}

function renderCurl(request: CodeRequest): string {
  const lines = [
    `curl --request ${request.method} \\`,
    `  --url ${shellQuote(request.url)}`
  ];
  for (const [name, value] of request.headers) {
    if (request.body.kind === "multipart" && name.toLowerCase() === "content-type") continue;
    lines[lines.length - 1] += " \\";
    lines.push(`  --header ${shellQuote(`${name}: ${value}`)}`);
  }
  if (request.body.kind === "urlencoded") {
    for (const field of request.body.fields) {
      lines[lines.length - 1] += " \\";
      lines.push(`  --data-urlencode ${shellQuote(`${field.name}=${field.value}`)}`);
    }
  } else if (request.body.kind === "multipart") {
    for (const field of request.body.fields) {
      const value = field.kind === "file"
        ? `${field.name}=@${field.value}${field.contentType ? `;type=${field.contentType}` : ""}`
        : `${field.name}=${field.value}`;
      lines[lines.length - 1] += " \\";
      lines.push(`  --form ${shellQuote(value)}`);
    }
  } else if (request.body.kind === "raw" && request.body.value) {
    lines[lines.length - 1] += " \\";
    lines.push(`  --data-raw ${shellQuote(request.body.value)}`);
  }
  return lines.join("\n");
}

function renderCSharp(request: CodeRequest, options: RenderOptions): string {
  const suffix = variableSuffix(options.stepIndex);
  const lines = options.includePreamble
    ? ["using System.Collections.Generic;", "using System.IO;", "using System.Net.Http;", "using System.Text;", "", "using var client = new HttpClient();"]
    : [];
  lines.push(`using var request${suffix} = new HttpRequestMessage(new HttpMethod(${csharpString(request.method)}), ${csharpString(request.url)});`);
  for (const [name, value] of request.headers) {
    if (name.toLowerCase() === "content-type" && request.body.kind !== "none") continue;
    lines.push(`request${suffix}.Headers.TryAddWithoutValidation(${csharpString(name)}, ${csharpString(value)});`);
  }
  appendCSharpBody(lines, request.body, suffix);
  lines.push(`using var response${suffix} = await client.SendAsync(request${suffix});`);
  lines.push(`var responseBody${suffix} = await response${suffix}.Content.ReadAsStringAsync();`);
  return lines.join("\n");
}

function appendCSharpBody(lines: string[], body: CodeBody, suffix: string): void {
  if (body.kind === "raw") {
    lines.push(`request${suffix}.Content = new StringContent(${csharpString(body.value)}, Encoding.UTF8, ${csharpString(body.contentType)});`);
  } else if (body.kind === "urlencoded") {
    const entries = body.fields.map((field) => `new KeyValuePair<string, string>(${csharpString(field.name)}, ${csharpString(field.value)})`);
    lines.push(`request${suffix}.Content = new FormUrlEncodedContent(new[] { ${entries.join(", ")} });`);
  } else if (body.kind === "multipart") {
    lines.push(`using var multipart${suffix} = new MultipartFormDataContent();`);
    body.fields.forEach((field, index) => {
      if (field.kind === "text") {
        lines.push(`multipart${suffix}.Add(new StringContent(${csharpString(field.value)}), ${csharpString(field.name)});`);
      } else {
        lines.push(`using var fileStream${suffix}_${index + 1} = File.OpenRead(${csharpString(field.value)});`);
        lines.push(`var fileContent${suffix}_${index + 1} = new StreamContent(fileStream${suffix}_${index + 1});`);
        if (field.contentType) lines.push(`fileContent${suffix}_${index + 1}.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(${csharpString(field.contentType)});`);
        lines.push(`multipart${suffix}.Add(fileContent${suffix}_${index + 1}, ${csharpString(field.name)}, "selected-file");`);
      }
    });
    lines.push(`request${suffix}.Content = multipart${suffix};`);
  }
}

function javaImports(requests: CodeRequest[], includeFlowMappings = false): string[] {
  const imports = [
    "import java.net.URI;",
    "import java.net.http.HttpClient;",
    "import java.net.http.HttpRequest;",
    "import java.net.http.HttpResponse;"
  ];
  if (requests.some((request) => request.body.kind === "urlencoded")) {
    imports.splice(1, 0, "import java.net.URLEncoder;", "import java.nio.charset.StandardCharsets;");
  }
  if (requests.some((request) => request.body.kind === "multipart")) {
    imports.unshift("import java.io.ByteArrayOutputStream;");
    if (!imports.includes("import java.nio.charset.StandardCharsets;")) imports.push("import java.nio.charset.StandardCharsets;");
    imports.push("import java.nio.file.Files;", "import java.nio.file.Path;", "import java.util.UUID;");
  }
  if (includeFlowMappings) {
    imports.unshift("import com.fasterxml.jackson.databind.JsonNode;", "import com.fasterxml.jackson.databind.ObjectMapper;");
    imports.push("import java.util.HashMap;");
  }
  return imports;
}

function renderJava(request: CodeRequest, options: RenderOptions): string {
  const suffix = variableSuffix(options.stepIndex);
  const lines = options.includePreamble
    ? [...javaImports([request]), "", "var client = HttpClient.newHttpClient();", ""]
    : [];
  const bodyPublisher = `bodyPublisher${suffix}`;

  if (request.body.kind === "none") {
    lines.push(`var ${bodyPublisher} = HttpRequest.BodyPublishers.noBody();`);
  } else if (request.body.kind === "raw") {
    lines.push(`var ${bodyPublisher} = HttpRequest.BodyPublishers.ofString(${javaFlowExpression(request.body.value, options.flowVariableNames)});`);
  } else if (request.body.kind === "urlencoded") {
    const formBody = `formBody${suffix}`;
    const fields = request.body.fields.map((field) => (
      `    URLEncoder.encode(${javaString(field.name)}, StandardCharsets.UTF_8) + "=" + URLEncoder.encode(${javaFlowExpression(field.value, options.flowVariableNames)}, StandardCharsets.UTF_8)`
    ));
    lines.push(`var ${formBody} = String.join("&",\n${fields.join(",\n")}\n);`);
    lines.push(`var ${bodyPublisher} = HttpRequest.BodyPublishers.ofString(${formBody});`);
  } else {
    appendJavaMultipartBody(lines, request.body, suffix, options.flowVariableNames);
  }

  lines.push(`var requestBuilder${suffix} = HttpRequest.newBuilder()`);
  lines.push(`    .uri(URI.create(${javaFlowExpression(request.url, options.flowVariableNames)}))`);
  lines.push(`    .method(${javaString(request.method)}, ${bodyPublisher});`);
  for (const [name, value] of request.headers) {
    if (request.body.kind === "multipart" && name.toLowerCase() === "content-type") continue;
    lines.push(`requestBuilder${suffix}.header(${javaString(name)}, ${javaFlowExpression(value, options.flowVariableNames)});`);
  }
  if (request.body.kind === "multipart") {
    lines.push(`requestBuilder${suffix}.header("Content-Type", "multipart/form-data; boundary=" + boundary${suffix});`);
  }
  lines.push(`var response${suffix} = client.send(requestBuilder${suffix}.build(), HttpResponse.BodyHandlers.ofString());`);
  lines.push(`var responseBody${suffix} = response${suffix}.body();`);
  return lines.join("\n");
}

function appendJavaMultipartBody(
  lines: string[],
  body: Extract<CodeBody, { kind: "multipart" }>,
  suffix: string,
  flowVariableNames: string[] | undefined
): void {
  const boundary = `boundary${suffix}`;
  const multipartBody = `multipartBody${suffix}`;
  lines.push(`var ${boundary} = "RelayStudioBoundary-" + UUID.randomUUID();`);
  lines.push(`var ${multipartBody} = new ByteArrayOutputStream();`);
  body.fields.forEach((field) => {
    lines.push(`${multipartBody}.writeBytes(("--" + ${boundary} + "\\r\\n").getBytes(StandardCharsets.UTF_8));`);
    if (field.kind === "file") {
      lines.push(`${multipartBody}.writeBytes(${javaString(`Content-Disposition: form-data; name="${field.name}"; filename="selected-file"\r\n`)}.getBytes(StandardCharsets.UTF_8));`);
      if (field.contentType) {
        lines.push(`${multipartBody}.writeBytes(${javaString(`Content-Type: ${field.contentType}\r\n`)}.getBytes(StandardCharsets.UTF_8));`);
      }
      lines.push(`${multipartBody}.writeBytes("\\r\\n".getBytes(StandardCharsets.UTF_8));`);
      lines.push(`${multipartBody}.writeBytes(Files.readAllBytes(Path.of(${javaString(field.value)})));`);
      lines.push(`${multipartBody}.writeBytes("\\r\\n".getBytes(StandardCharsets.UTF_8));`);
    } else {
      const prefix = `Content-Disposition: form-data; name="${field.name}"\r\n\r\n`;
      lines.push(`${multipartBody}.writeBytes((${javaString(prefix)} + ${javaFlowExpression(field.value, flowVariableNames)} + "\\r\\n").getBytes(StandardCharsets.UTF_8));`);
    }
  });
  lines.push(`${multipartBody}.writeBytes(("--" + ${boundary} + "--\\r\\n").getBytes(StandardCharsets.UTF_8));`);
  lines.push(`var bodyPublisher${suffix} = HttpRequest.BodyPublishers.ofByteArray(${multipartBody}.toByteArray());`);
}

function renderJQuery(request: CodeRequest, options: RenderOptions): string {
  const suffix = variableSuffix(options.stepIndex);
  const lines: string[] = [];
  let dataExpression = "undefined";
  if (request.body.kind === "raw") dataExpression = jsString(request.body.value);
  if (request.body.kind === "urlencoded") {
    dataExpression = `new URLSearchParams(${jsPairsWithFlowVariables(request.body.fields, options.flowVariableNames)}).toString()`;
  }
  if (request.body.kind === "multipart") {
    lines.push(`const formData${suffix} = new FormData();`);
    request.body.fields.forEach((field) => {
      const value = field.kind === "file"
        ? `document.querySelector(${jsString(`input[name="${field.name}"]`)}).files[0] /* ${field.value} */`
        : javascriptFlowExpression(field.value, options.flowVariableNames);
      lines.push(`formData${suffix}.append(${jsString(field.name)}, ${value});`);
    });
    dataExpression = `formData${suffix}`;
  }
  const headers = request.headers.filter(([name]) => !(request.body.kind === "multipart" && name.toLowerCase() === "content-type"));
  lines.push(`const response${suffix} = await $.ajax({`);
  lines.push(`  url: ${javascriptFlowExpression(request.url, options.flowVariableNames)},`);
  lines.push(`  method: ${jsString(request.method)},`);
  if (headers.length) lines.push(`  headers: ${jsObjectWithFlowVariables(headers, options.flowVariableNames)},`);
  if (request.body.kind !== "none") {
    const renderedData = request.body.kind === "raw"
      ? javascriptFlowExpression(request.body.value, options.flowVariableNames)
      : dataExpression;
    lines.push(`  data: ${renderedData},`);
  }
  if (request.body.kind === "raw") lines.push(`  contentType: ${jsString(request.body.contentType)},`);
  if (request.body.kind === "multipart") lines.push("  processData: false,", "  contentType: false,");
  lines.push("});");
  return lines.join("\n");
}

function renderFlowMappingCaptures(
  language: CodeExampleLanguage,
  mappings: FlowMapping[],
  stepIndex: number,
  stepLabel: string
): string {
  if (mappings.length === 0) return "";
  const suffix = variableSuffix(stepIndex);
  if (language === "java") {
    const responseData = `responseData${suffix}`;
    const response = `response${suffix}`;
    const responseBody = `responseBody${suffix}`;
    const stepContext = `Flow step ${stepIndex} (${stepLabel})`;
    return [
      `if (${response}.statusCode() < 200 || ${response}.statusCode() >= 300) {`,
      `    throw new IllegalStateException(${javaString(`${stepContext} returned HTTP `)} + ${response}.statusCode() + ${javaString(" before response mappings could be applied. Replace credential placeholders and confirm the endpoint.")});`,
      "}",
      `if (${responseBody} == null || ${responseBody}.isBlank()) {`,
      `    throw new IllegalStateException(${javaString(`${stepContext} returned an empty response body required by response mappings. Replace credential placeholders and confirm the endpoint.`)});`,
      "}",
      `JsonNode ${responseData};`,
      "try {",
      `    ${responseData} = objectMapper.readTree(${responseBody});`,
      "} catch (com.fasterxml.jackson.core.JsonProcessingException error) {",
      `    throw new IllegalStateException(${javaString(`${stepContext} did not return valid JSON required by response mappings. Replace credential placeholders and confirm the endpoint response.`)}, error);`,
      "}",
      ...mappings.flatMap((mapping) => {
        const mappedValue = `mappedValue${suffix}_${javaIdentifier(mapping.variableName)}`;
        return [
          `var ${mappedValue} = ${javaJsonPathExpression(responseData, mapping.jsonPath)};`,
          `if (${mappedValue}.isMissingNode() || ${mappedValue}.isNull()) {`,
          `    throw new IllegalStateException(${javaString(`Response mapping ${mapping.jsonPath} for ${mapping.variableName} was missing or null.`)});`,
          "}",
          `if (!${mappedValue}.isValueNode()) {`,
          `    throw new IllegalStateException(${javaString(`Response mapping ${mapping.jsonPath} for ${mapping.variableName} must resolve to a scalar value.`)});`,
          "}",
          `flowVariables.put(${javaString(mapping.variableName)}, ${mappedValue}.asText());`
        ];
      })
    ].join("\n");
  }
  if (language !== "jquery") return "";
  const response = `response${suffix}`;
  const responseData = `responseData${suffix}`;
  return [
    `const ${responseData} = typeof ${response} === "string" ? JSON.parse(${response}) : ${response};`,
    ...mappings.map((mapping) => (
      `flowVariables[${jsString(mapping.variableName)}] = ${javascriptJsonPathExpression(responseData, mapping.jsonPath)};`
    ))
  ].join("\n");
}

function renderNode(request: CodeRequest, options: RenderOptions): string {
  const suffix = variableSuffix(options.stepIndex);
  const lines = request.body.kind === "multipart" && options.includePreamble ? ["import { openAsBlob } from \"node:fs\";", ""] : [];
  let bodyExpression: string | null = null;
  if (request.body.kind === "raw") bodyExpression = jsString(request.body.value);
  if (request.body.kind === "urlencoded") bodyExpression = `new URLSearchParams(${jsPairs(request.body.fields)})`;
  if (request.body.kind === "multipart") {
    lines.push(`const formData${suffix} = new FormData();`);
    request.body.fields.forEach((field) => {
      if (field.kind === "file") {
        const optionsArgument = field.contentType ? `, { type: ${jsString(field.contentType)} }` : "";
        lines.push(`formData${suffix}.append(${jsString(field.name)}, await openAsBlob(${jsString(field.value)}${optionsArgument}), "selected-file");`);
      } else {
        lines.push(`formData${suffix}.append(${jsString(field.name)}, ${jsString(field.value)});`);
      }
    });
    bodyExpression = `formData${suffix}`;
  }
  const headers = request.headers.filter(([name]) => !(request.body.kind === "multipart" && name.toLowerCase() === "content-type"));
  lines.push(`const response${suffix} = await fetch(${jsString(request.url)}, {`);
  lines.push(`  method: ${jsString(request.method)},`);
  if (headers.length) lines.push(`  headers: ${jsObject(headers)},`);
  if (bodyExpression !== null) lines.push(`  body: ${bodyExpression},`);
  lines.push("});");
  lines.push(`const responseBody${suffix} = await response${suffix}.text();`);
  return lines.join("\n");
}

function renderPhp(request: CodeRequest, options: RenderOptions): string {
  const suffix = variableSuffix(options.stepIndex);
  const lines = options.includePreamble ? ["<?php", ""] : [];
  lines.push(`$curl${suffix} = curl_init();`);
  let postFields: string | null = null;
  if (request.body.kind === "raw") postFields = phpString(request.body.value);
  if (request.body.kind === "urlencoded") postFields = phpString(new URLSearchParams(request.body.fields.map((field) => [field.name, field.value])).toString());
  if (request.body.kind === "multipart") {
    const fields = request.body.fields.map((field) => field.kind === "file"
      ? `${phpString(field.name)} => new CURLFile(${phpString(field.value)}${field.contentType ? `, ${phpString(field.contentType)}` : ""})`
      : `${phpString(field.name)} => ${phpString(field.value)}`);
    postFields = `[${fields.join(", ")}]`;
  }
  const headers = request.headers.filter(([name]) => !(request.body.kind === "multipart" && name.toLowerCase() === "content-type"));
  lines.push(`curl_setopt_array($curl${suffix}, [`);
  lines.push(`    CURLOPT_URL => ${phpString(request.url)},`);
  lines.push(`    CURLOPT_CUSTOMREQUEST => ${phpString(request.method)},`);
  lines.push("    CURLOPT_RETURNTRANSFER => true,");
  if (headers.length) lines.push(`    CURLOPT_HTTPHEADER => [${headers.map(([name, value]) => phpString(`${name}: ${value}`)).join(", ")}],`);
  if (postFields !== null) lines.push(`    CURLOPT_POSTFIELDS => ${postFields},`);
  lines.push("]);");
  lines.push(`$response${suffix} = curl_exec($curl${suffix});`);
  lines.push(`if ($response${suffix} === false) { throw new RuntimeException(curl_error($curl${suffix})); }`);
  lines.push(`curl_close($curl${suffix});`);
  return lines.join("\n");
}

function renderPython(request: CodeRequest, options: RenderOptions): string {
  const suffix = variableSuffix(options.stepIndex);
  const lines = options.includePreamble ? ["import requests", ""] : [];
  const headers = request.headers.filter(([name]) => !(request.body.kind === "multipart" && name.toLowerCase() === "content-type"));
  const requestArguments = [pythonString(request.url)];
  if (headers.length) requestArguments.push(`headers=${pythonDict(headers)}`);
  if (request.body.kind === "raw") requestArguments.push(`data=${pythonString(request.body.value)}`);
  if (request.body.kind === "urlencoded") requestArguments.push(`data=[${request.body.fields.map((field) => `(${pythonString(field.name)}, ${pythonString(field.value)})`).join(", ")}]`);
  if (request.body.kind === "multipart") {
    const files = request.body.fields.map((field) => field.kind === "file"
      ? `(${pythonString(field.name)}, ("selected-file", open(${pythonString(field.value)}, "rb")${field.contentType ? `, ${pythonString(field.contentType)}` : ""}))`
      : `(${pythonString(field.name)}, (None, ${pythonString(field.value)}))`);
    requestArguments.push(`files=[${files.join(", ")}]`);
  }
  lines.push(`response${suffix} = requests.${request.method.toLowerCase()}(${requestArguments.join(", ")})`);
  lines.push(`response${suffix}.raise_for_status()`);
  lines.push(`response_body${suffix} = response${suffix}.text`);
  return lines.join("\n");
}

function renderRuby(request: CodeRequest, options: RenderOptions): string {
  const suffix = variableSuffix(options.stepIndex);
  const lines = options.includePreamble ? ["require 'net/http'", "require 'uri'", "", `uri${suffix} = URI(${rubyString(request.url)})`] : [`uri${suffix} = URI(${rubyString(request.url)})`];
  lines.push(`request${suffix} = Net::HTTPGenericRequest.new(${rubyString(request.method)}, ${request.body.kind === "none" ? "false" : "true"}, true, uri${suffix}.request_uri)`);
  for (const [name, value] of request.headers) {
    if (request.body.kind === "multipart" && name.toLowerCase() === "content-type") continue;
    lines.push(`request${suffix}[${rubyString(name)}] = ${rubyString(value)}`);
  }
  if (request.body.kind === "raw") lines.push(`request${suffix}.body = ${rubyString(request.body.value)}`);
  if (request.body.kind === "urlencoded") {
    const fields = request.body.fields.map((field) => `[${rubyString(field.name)}, ${rubyString(field.value)}]`);
    lines.push(`request${suffix}.set_form([${fields.join(", ")}], 'application/x-www-form-urlencoded')`);
  }
  if (request.body.kind === "multipart") {
    const fields = request.body.fields.map((field) => field.kind === "file"
      ? `[${rubyString(field.name)}, File.open(${rubyString(field.value)})${field.contentType ? `, { content_type: ${rubyString(field.contentType)} }` : ""}]`
      : `[${rubyString(field.name)}, ${rubyString(field.value)}]`);
    lines.push(`request${suffix}.set_form([${fields.join(", ")}], 'multipart/form-data')`);
  }
  lines.push(`response${suffix} = Net::HTTP.start(uri${suffix}.hostname, uri${suffix}.port, use_ssl: uri${suffix}.scheme == 'https') do |http|`);
  lines.push(`  http.request(request${suffix})`);
  lines.push("end");
  lines.push(`response_body${suffix} = response${suffix}.body`);
  return lines.join("\n");
}

function serializedBody(body: CodeBody): string {
  if (body.kind === "none") return "";
  if (body.kind === "raw") return body.value;
  if (body.kind === "urlencoded") return new URLSearchParams(body.fields.map((field) => [field.name, field.value])).toString();
  return body.fields.map((field) => `${field.name}=${field.kind === "file" ? `@${field.value}` : field.value}`).join("\n");
}

function collectCredentialCanaries(service: ProjectService, environment: ProjectEnvironment): string[] {
  const canaries = environment.variables
    .filter((variable) => variable.secret || isSecretKey(variable.name))
    .map((variable) => variable.value);
  const auth = service.authProfile;
  canaries.push(auth.apiKeyValue ?? "", auth.customHeaderValue ?? "");
  collectSensitiveRows(canaries, service.headers);
  collectSensitiveRows(canaries, service.queryParams);
  collectSensitiveRows(canaries, service.body.fields ?? []);
  if (service.body.contentType === "application/json" && service.body.raw.trim()) {
    try {
      collectJsonCredentials(JSON.parse(service.body.raw) as unknown, canaries);
    } catch {
      // Request validation produces the actionable malformed JSON error before rendering.
    }
  }
  return [...new Set(canaries.map((value) => value.trim()).filter((value) => value.length >= 4 && !value.includes("{{")))];
}

function collectSensitiveRows(target: string[], rows: KeyValueRow[]): void {
  rows.filter((row) => row.enabled && isSecretKey(row.name)).forEach((row) => target.push(row.value));
}

function collectJsonCredentials(value: unknown, target: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonCredentials(item, target));
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    if (isSecretKey(key) && typeof nested === "string") target.push(nested);
    else collectJsonCredentials(nested, target);
  });
}

function assertNoCredentialCanaries(code: string, canaries: string[]): void {
  const leaked = canaries.find((canary) => code.includes(canary));
  if (leaked) {
    throw new AppError(
      "validation",
      "CODE_EXAMPLE_REDACTION_FAILED",
      "Code generation stopped because a credential-shaped value remained after redaction.",
      { guidance: "Mark the source variable as secret or remove the literal credential before generating code." }
    );
  }
}

function assertCodeOutput(code: string): void {
  try {
    assertUtf8ByteLimit(code, MAX_CODE_EXAMPLE_OUTPUT_BYTES, codeExampleLabel);
  } catch (error) {
    throw new AppError(
      "validation",
      "CODE_EXAMPLE_OUTPUT_TOO_LARGE",
      redactText(error instanceof Error ? error.message : String(error)),
      { guidance: "Reduce the request body or split the flow into smaller examples.", cause: error }
    );
  }
}

function assertLanguage(language: string): asserts language is CodeExampleLanguage {
  if (!isCodeExampleLanguage(language)) {
    throw new AppError("validation", "CODE_EXAMPLE_LANGUAGE_UNSUPPORTED", `Unsupported code example language: ${language}.`);
  }
}

function parseCodeUrl(value: string): { host: string; path: string } {
  try {
    const parsed = new URL(value);
    return { host: parsed.host, path: `${parsed.pathname}${parsed.search}` || "/" };
  } catch (error) {
    throw new AppError("validation", "CODE_EXAMPLE_URL_INVALID", `Cannot generate code because the resolved URL is invalid: ${redactUrl(value)}.`, { cause: error });
  }
}

function hasHeader(headers: Map<string, string>, target: string): boolean {
  return [...headers.keys()].some((name) => name.toLowerCase() === target.toLowerCase());
}

function commentPrefix(language: CodeExampleLanguage): string {
  return language === "csharp" || language === "java" || language === "jquery" || language === "node" || language === "php" ? "//" : "#";
}

function joinConditions(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "the dependency condition is met";
  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

function secretPlaceholder(name: string): string {
  const normalized = name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
  return `<${normalized || "SECRET"}>`;
}

function filePlaceholder(name: string): string {
  return `<SELECT_FILE_FOR_${secretPlaceholder(name).slice(1, -1)}>`;
}

function normalizeRedactionMask(value: string): string {
  return value.split(REDACTION_MASK).join("<REDACTED>");
}

function variableSuffix(stepIndex: number | undefined): string {
  return stepIndex ? `_step${stepIndex}` : "";
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function csharpString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`;
}

function javaString(value: string): string {
  return csharpString(value);
}

function javaIdentifier(value: string): string {
  const identifier = value.replace(/[^A-Za-z0-9_$]/g, "_");
  if (!identifier) return "mappedValue";
  return /^[0-9]/.test(identifier) ? `_${identifier}` : identifier;
}

function javaFlowExpression(value: string, variableNames: string[] | undefined): string {
  const candidates = [...new Set(variableNames ?? [])].map((variableName) => ({
    placeholder: secretPlaceholder(variableName),
    expression: `flowVariables.get(${javaString(variableName)})`
  }));
  if (candidates.length === 0) return javaString(value);

  const parts: string[] = [];
  let remainder = value;
  while (remainder.length > 0) {
    const match = candidates
      .map((candidate) => ({ candidate, index: remainder.indexOf(candidate.placeholder) }))
      .filter(({ index }) => index >= 0)
      .sort((first, second) => first.index - second.index)[0];
    if (!match) {
      parts.push(javaString(remainder));
      break;
    }
    if (match.index > 0) parts.push(javaString(remainder.slice(0, match.index)));
    parts.push(match.candidate.expression);
    remainder = remainder.slice(match.index + match.candidate.placeholder.length);
  }
  return parts.length > 0 ? parts.join(" + ") : javaString("");
}

function javaJsonPathExpression(root: string, jsonPath: string): string {
  if (jsonPath === "$") return root;
  if (!jsonPath.startsWith("$.")) throw new Error(`Cannot render unsupported JSONPath: ${jsonPath}.`);
  const tokens: Array<string | number> = [];
  for (const segment of jsonPath.slice(2).split(".")) {
    const match = /^([A-Za-z_][A-Za-z0-9_-]*)(\[\d+\])*$/.exec(segment);
    if (!match) throw new Error(`Cannot render unsupported JSONPath segment: ${segment}.`);
    tokens.push(match[1]);
    for (const index of segment.match(/\[(\d+)\]/g) ?? []) tokens.push(Number(index.slice(1, -1)));
  }
  return tokens.reduce<string>((expression, token) => (
    typeof token === "number" ? `${expression}.path(${token})` : `${expression}.path(${javaString(token)})`
  ), root);
}

function jsString(value: string): string {
  return JSON.stringify(value);
}

function jsPairs(fields: CodeField[]): string {
  return `[${fields.map((field) => `[${jsString(field.name)}, ${jsString(field.value)}]`).join(", ")}]`;
}

function jsPairsWithFlowVariables(fields: CodeField[], variableNames: string[] | undefined): string {
  return `[${fields.map((field) => `[${jsString(field.name)}, ${javascriptFlowExpression(field.value, variableNames)}]`).join(", ")}]`;
}

function jsObject(entries: Array<[string, string]>): string {
  return `{ ${entries.map(([name, value]) => `${jsString(name)}: ${jsString(value)}`).join(", ")} }`;
}

function jsObjectWithFlowVariables(entries: Array<[string, string]>, variableNames: string[] | undefined): string {
  return `{ ${entries.map(([name, value]) => `${jsString(name)}: ${javascriptFlowExpression(value, variableNames)}`).join(", ")} }`;
}

function javascriptFlowExpression(value: string, variableNames: string[] | undefined): string {
  const candidates = [...new Set(variableNames ?? [])].map((variableName) => ({
    placeholder: secretPlaceholder(variableName),
    expression: `flowVariables[${jsString(variableName)}]`
  }));
  if (candidates.length === 0) return jsString(value);

  const parts: string[] = [];
  let remainder = value;
  while (remainder.length > 0) {
    const match = candidates
      .map((candidate) => ({ candidate, index: remainder.indexOf(candidate.placeholder) }))
      .filter(({ index }) => index >= 0)
      .sort((first, second) => first.index - second.index)[0];
    if (!match) {
      parts.push(jsString(remainder));
      break;
    }
    if (match.index > 0) parts.push(jsString(remainder.slice(0, match.index)));
    parts.push(match.candidate.expression);
    remainder = remainder.slice(match.index + match.candidate.placeholder.length);
  }
  return parts.length > 0 ? parts.join(" + ") : jsString("");
}

function javascriptJsonPathExpression(root: string, jsonPath: string): string {
  if (jsonPath === "$") return root;
  if (!jsonPath.startsWith("$.")) throw new Error(`Cannot render unsupported JSONPath: ${jsonPath}.`);
  const tokens: Array<string | number> = [];
  for (const segment of jsonPath.slice(2).split(".")) {
    const match = /^([A-Za-z_][A-Za-z0-9_-]*)(\[\d+\])*$/.exec(segment);
    if (!match) throw new Error(`Cannot render unsupported JSONPath segment: ${segment}.`);
    tokens.push(match[1]);
    for (const index of segment.match(/\[(\d+)\]/g) ?? []) tokens.push(Number(index.slice(1, -1)));
  }
  return tokens.reduce<string>((expression, token) => (
    typeof token === "number" ? `${expression}[${token}]` : `${expression}[${jsString(token)}]`
  ), root);
}

function phpString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function pythonString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r/g, "\\r").replace(/\n/g, "\\n")}'`;
}

function pythonDict(entries: Array<[string, string]>): string {
  return `{${entries.map(([name, value]) => `${pythonString(name)}: ${pythonString(value)}`).join(", ")}}`;
}

function rubyString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
