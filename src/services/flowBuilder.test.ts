import { describe, expect, it, vi } from "vitest";
import { createSampleProject, type ProjectFlow } from "../project/projectModel";
import {
  addFlowNode,
  addFlowMapping,
  applyFlowTemplate,
  connectFlowNodes,
  connectFlowNodeToService,
  disconnectFlowNodes,
  deleteFlowMapping,
  deleteFlowNode,
  evaluateJsonPath,
  normalizeFlow,
  orderFlowNodes,
  reorderFlowNode,
  resolveFlowNodeService,
  runFlow,
  updateFlowMapping,
  validateFlow
} from "./flowBuilder";
import type { HttpTransport } from "./serviceRunner";

const project = createSampleProject("2026-06-21T00:00:00.000Z");
const qa = project.environments[0];
const flow = project.flows.find((item) => item.id === "authenticated-read") as ProjectFlow;
const services = project.services;

describe("flow builder", () => {
  it("adds and connects a request that is not yet a flow step", () => {
    const singleStepFlow = {
      ...flow,
      steps: ["login"],
      nodes: [flow.nodes[0]],
      edges: []
    };

    const connected = connectFlowNodeToService(singleStepFlow, flow.nodes[0].id, services[1], "success");

    expect(connected.nodes).toHaveLength(2);
    expect(connected.nodes[1]).toMatchObject({ serviceId: services[1].id, label: services[1].name });
    expect(connected.edges).toContainEqual(expect.objectContaining({
      source: flow.nodes[0].id,
      target: connected.nodes[1].id,
      condition: "success"
    }));
  });

  it("connects an existing request step without adding a duplicate", () => {
    const existingService = services.find((service) => service.id === flow.nodes[1].serviceId)!;
    const connected = connectFlowNodeToService(flow, flow.nodes[0].id, existingService, "failure");

    expect(connected.nodes).toHaveLength(flow.nodes.length);
    expect(connected.edges).toContainEqual(expect.objectContaining({
      source: flow.nodes[0].id,
      target: flow.nodes[1].id,
      condition: "failure"
    }));
  });
  it("normalizes legacy step lists into positioned nodes and success edges", () => {
    const legacy = { id: "legacy", name: "Legacy", steps: ["login", "current-user"], nodes: [], edges: [], mappings: [] };
    const normalized = normalizeFlow(legacy);

    expect(normalized.nodes.map((node) => node.serviceId)).toEqual(["login", "current-user"]);
    expect(normalized.edges).toEqual([
      expect.objectContaining({
        source: normalized.nodes[0].id,
        target: normalized.nodes[1].id,
        condition: "success"
      })
    ]);
  });

  it("orders nodes topologically from dependency links", () => {
    const ordered = orderFlowNodes(flow);

    expect(ordered.map((node) => node.serviceId)).toEqual(["login", "current-user", "list-products", "get-product"]);
  });

  it("validates missing services, missing edge endpoints, empty flows, and cycles", () => {
    const missingService = {
      ...flow,
      nodes: [{ ...flow.nodes[0], serviceId: "missing-service", label: "Missing Service" }]
    };
    const missingEdgeNode = {
      ...flow,
      edges: [{ id: "bad-edge", source: "missing", target: flow.nodes[0].id, condition: "success" as const }]
    };
    const cycle = {
      ...flow,
      edges: [
        ...flow.edges,
        { id: "cycle", source: flow.nodes[flow.nodes.length - 1].id, target: flow.nodes[0].id, condition: "success" as const }
      ]
    };

    expect(validateFlow({ ...flow, nodes: [], edges: [], steps: [] }, services).map((issue) => issue.message)).toContain("Flow needs at least one request step.");
    expect(validateFlow(missingService, services).map((issue) => issue.message)).toContain("Missing request for flow step: Missing Service.");
    expect(validateFlow(missingEdgeNode, services).map((issue) => issue.message)).toContain("Flow has a dependency link with a missing step.");
    expect(validateFlow(cycle, services).map((issue) => issue.message)).toContain("Flow dependencies contain a cycle.");
    expect(() => orderFlowNodes(cycle)).toThrow("Flow dependencies contain a cycle.");
  });

  it("validates malformed response mappings before execution", () => {
    const invalidMappings = {
      ...flow,
      mappings: [
        { id: "missing-source", sourceNodeId: "missing-node", jsonPath: "$.token", variableName: "", secret: true },
        { id: "bad-path", sourceNodeId: flow.nodes[0].id, jsonPath: "$..token", variableName: "", secret: false },
        { id: "unnamed-path", sourceNodeId: flow.nodes[0].id, jsonPath: "token", variableName: "", secret: false }
      ]
    };

    const messages = validateFlow(invalidMappings, services).map((issue) => issue.message);

    expect(messages).toContain("Mapping (unnamed) references a missing source step.");
    expect(messages).toContain("Mapping variable name is required.");
    expect(messages).toContain("Mapping (unnamed) has invalid JSONPath: JSONPath contains an empty segment.");
    expect(messages).toContain("Mapping (unnamed) has invalid JSONPath: JSONPath must start with $. or be exactly $.");
  });

  it("resolves generated requests by unique normalized request name", () => {
    const generatedLogin = {
      ...services[0],
      id: "service-99",
      name: "Login Request",
      method: "POST" as const
    };
    const generatedServices = [generatedLogin, ...services.filter((service) => service.id !== "login")];

    expect(resolveFlowNodeService(flow.nodes[0], generatedServices).service).toMatchObject({
      id: "service-99",
      name: "Login Request"
    });
    expect(validateFlow(flow, generatedServices).map((issue) => issue.message)).not.toContain("Missing request for flow step: Login.");
  });

  it("keeps ambiguous generated request names unresolved", () => {
    const generatedServices = [
      { ...services[0], id: "service-99", name: "Login Request" },
      { ...services[0], id: "service-100", name: "Login Endpoint" },
      ...services.filter((service) => service.id !== "login")
    ];

    const result = resolveFlowNodeService(flow.nodes[0], generatedServices);

    expect(result.service).toBeUndefined();
    expect(result.reason).toContain("matches multiple requests");
  });

  it("adds, deletes, connects, and reorders request nodes", () => {
    const service = services.find((item) => item.id === "search-products")!;
    const added = addFlowNode(flow, service);
    const newNode = added.nodes[added.nodes.length - 1];
    const connected = connectFlowNodes(added, added.nodes[0].id, newNode.id, "failure");
    const duplicate = connectFlowNodes(connected, added.nodes[0].id, newNode.id, "failure");
    const disconnected = disconnectFlowNodes(duplicate, added.nodes[0].id, newNode.id, "failure");
    const reordered = reorderFlowNode(duplicate, newNode.id, "left");
    const deleted = deleteFlowNode(reordered, newNode.id);

    expect(newNode).toMatchObject({ serviceId: "search-products", label: "Search Products", status: "idle" });
    expect(connected.edges).toHaveLength(added.edges.length + 1);
    expect(duplicate.edges).toHaveLength(connected.edges.length);
    expect(disconnected.edges).toHaveLength(added.edges.length);
    expect(disconnectFlowNodes(disconnected, added.nodes[0].id, newNode.id, "failure").edges).toHaveLength(added.edges.length);
    expect(reordered.nodes[reordered.nodes.length - 2].id).toBe(newNode.id);
    expect(deleted.nodes.some((node) => node.id === newNode.id)).toBe(false);
    expect(deleted.edges.some((edge) => edge.source === newNode.id || edge.target === newNode.id)).toBe(false);
  });

  it("adds, updates, and deletes response mappings", () => {
    const added = addFlowMapping(flow, flow.nodes[0].id, {
      jsonPath: "$.accessToken",
      variableName: "accessToken",
      secret: true
    });
    const mapping = added.mappings[added.mappings.length - 1];
    const updated = updateFlowMapping(added, mapping.id, {
      jsonPath: "$.token",
      variableName: "accessToken",
      secret: true
    });
    const deleted = deleteFlowMapping(updated, mapping.id);

    expect(mapping).toMatchObject({
      sourceNodeId: flow.nodes[0].id,
      jsonPath: "$.accessToken",
      variableName: "accessToken",
      secret: true
    });
    expect(updated.mappings.find((item) => item.id === mapping.id)).toMatchObject({
      jsonPath: "$.token",
      variableName: "accessToken",
      secret: true
    });
    expect(deleted.mappings.some((item) => item.id === mapping.id)).toBe(false);
  });

  it("applies flow templates with the expected mappings and cleanup steps", () => {
    const emptyFlow: ProjectFlow = {
      id: "new-flow",
      name: "New Flow",
      steps: [],
      nodes: [],
      edges: [],
      mappings: []
    };

    const authenticatedRead = applyFlowTemplate(emptyFlow, "authenticated-read");
    const createReadCleanup = applyFlowTemplate(emptyFlow, "create-read-cleanup");

    expect(authenticatedRead.steps).toEqual(["login", "current-user", "list-products"]);
    expect(authenticatedRead.edges).toHaveLength(2);
    expect(authenticatedRead.mappings).toEqual([
      expect.objectContaining({
        sourceNodeId: authenticatedRead.nodes[0].id,
        jsonPath: "$.accessToken",
        variableName: "accessToken",
        secret: true
      })
    ]);
    expect(createReadCleanup.steps).toEqual(["login", "create-order", "get-order", "cleanup-order"]);
    expect(createReadCleanup.edges).toHaveLength(3);
    expect(createReadCleanup.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceNodeId: createReadCleanup.nodes[0].id,
        variableName: "accessToken",
        secret: true
      }),
      expect.objectContaining({
        sourceNodeId: createReadCleanup.nodes[1].id,
        jsonPath: "$.id",
        variableName: "orderId",
        secret: false
      })
    ]));
  });

  it("evaluates supported JSONPath expressions", () => {
    const body = `{"token":"abc","accessToken":"def","id":42,"items":[{"id":"first"}],"user":{"profile":{"id":"u-1"}}}`;

    expect(evaluateJsonPath(body, "$.token")).toBe("abc");
    expect(evaluateJsonPath(body, "$.accessToken")).toBe("def");
    expect(evaluateJsonPath(body, "$.id")).toBe(42);
    expect(evaluateJsonPath(body, "$.items[0].id")).toBe("first");
    expect(evaluateJsonPath(body, "$.user.profile.id")).toBe("u-1");
    expect(evaluateJsonPath(body, "$")).toEqual(JSON.parse(body));
    expect(evaluateJsonPath(body, "$.missing")).toBeUndefined();
    expect(evaluateJsonPath(body, "$.items[1].id")).toBeUndefined();
    expect(evaluateJsonPath(body, "$.token.id")).toBeUndefined();
    expect(() => evaluateJsonPath("{", "$.token")).toThrow("Response body is not valid JSON.");
    expect(() => evaluateJsonPath(body, "")).toThrow("JSONPath is required.");
    expect(() => evaluateJsonPath(body, "token")).toThrow("JSONPath must start with $. or be exactly $.");
    expect(() => evaluateJsonPath(body, "$.items[*]")).toThrow("Unsupported JSONPath segment: items[*].");
  });

  it("runs successful flow steps with grouped console events", async () => {
    const transport = vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: `{"ok":true,"accessToken":"flow-token"}`,
      durationMs: 5
    }) as HttpTransport & ReturnType<typeof vi.fn>;

    const result = await runFlow(flow, services, qa, transport);

    expect(result.issues).toEqual([]);
    expect(result.steps.map((step) => step.status)).toEqual(["success", "success", "success", "success"]);
    expect(result.flow.nodes.map((node) => node.status)).toEqual(["success", "success", "success", "success"]);
    expect(result.events.map((event) => event.message)).toContain("[Login] success.");
    expect(result.request?.url).toBe("https://api.example.com/api/products/prod-1001");
    expect(result.response?.prettyBody).toContain('"accessToken": "flow-token"');
    expect(transport).toHaveBeenCalledTimes(4);
  });

  it("maps a response value into a later request variable", async () => {
    const mappedFlow = {
      ...flow,
      nodes: flow.nodes.slice(0, 2),
      edges: flow.edges.slice(0, 1),
      steps: ["login", "current-user"],
      mappings: [{
        id: "login-token",
        sourceNodeId: flow.nodes[0].id,
        jsonPath: "$.accessToken",
        variableName: "accessToken",
        secret: true
      }]
    };
    const environment = {
      ...qa,
      variables: qa.variables.map((variable) => (
        variable.name === "accessToken" ? { ...variable, value: "" } : variable
      ))
    };
    const transport = vi.fn()
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        body: `{"accessToken":"mapped-token"}`,
        durationMs: 5
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        body: `{"id":"user-1"}`,
        durationMs: 6
      }) as HttpTransport & ReturnType<typeof vi.fn>;

    const result = await runFlow(mappedFlow, services, environment, transport);

    expect(result.steps.map((step) => step.status)).toEqual(["success", "success"]);
    expect(result.environment.variables.find((variable) => variable.name === "accessToken")).toMatchObject({
      value: "mapped-token",
      secret: true
    });
    expect(transport.mock.calls[1][0].headers.Authorization).toBe("Bearer mapped-token");
    expect(result.events.map((event) => event.message)).toContain("[Login] captured accessToken as a secret.");
  });

  it("captures new and structured mapping values", async () => {
    const mappedFlow = {
      ...flow,
      nodes: flow.nodes.slice(0, 1),
      edges: [],
      steps: ["login"],
      mappings: [
        {
          id: "count",
          sourceNodeId: flow.nodes[0].id,
          jsonPath: "$.count",
          variableName: "count",
          secret: false
        },
        {
          id: "enabled",
          sourceNodeId: flow.nodes[0].id,
          jsonPath: "$.enabled",
          variableName: "enabled",
          secret: false
        },
        {
          id: "profile",
          sourceNodeId: flow.nodes[0].id,
          jsonPath: "$.profile",
          variableName: "profile",
          secret: false
        }
      ]
    };
    const transport = vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: `{"count":3,"enabled":true,"profile":{"id":"u-1"}}`,
      durationMs: 5
    }) as HttpTransport & ReturnType<typeof vi.fn>;

    const result = await runFlow(mappedFlow, services, qa, transport);

    expect(result.environment.variables).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "count", value: "3", secret: false }),
      expect.objectContaining({ name: "enabled", value: "true", secret: false }),
      expect.objectContaining({ name: "profile", value: `{"id":"u-1"}`, secret: false })
    ]));
  });

  it("reports invalid JSON when a successful response cannot be mapped", async () => {
    const mappedFlow = {
      ...flow,
      nodes: flow.nodes.slice(0, 1),
      edges: [],
      steps: ["login"],
      mappings: [{
        id: "token",
        sourceNodeId: flow.nodes[0].id,
        jsonPath: "$.token",
        variableName: "accessToken",
        secret: true
      }]
    };
    const transport = vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/plain" },
      body: `not-json`,
      durationMs: 5
    }) as HttpTransport & ReturnType<typeof vi.fn>;

    const result = await runFlow(mappedFlow, services, qa, transport);

    expect(result.steps.map((step) => step.status)).toEqual(["failed"]);
    expect(result.issues.map((issue) => issue.message)).toContain("[Login] mapping failed: $.token for accessToken. Response body is not valid JSON.");
  });

  it("fails the source step when a mapping result is missing", async () => {
    const mappedFlow = {
      ...flow,
      mappings: [{
        id: "missing-token",
        sourceNodeId: flow.nodes[0].id,
        jsonPath: "$.missing",
        variableName: "accessToken",
        secret: true
      }]
    };
    const transport = vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: `{"ok":true}`,
      durationMs: 5
    }) as HttpTransport & ReturnType<typeof vi.fn>;

    const result = await runFlow(mappedFlow, services, qa, transport);

    expect(result.steps.map((step) => step.status)).toEqual(["failed", "skipped", "skipped", "skipped"]);
    expect(result.issues.map((issue) => issue.message)).toContain("[Login] mapping failed: $.missing produced no value for accessToken.");
    expect(result.events.map((event) => event.message)).toContain("[Login] mapping failed: $.missing produced no value for accessToken.");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("fails a step and skips downstream success dependencies", async () => {
    const transport = vi.fn()
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        body: `{"ok":true,"accessToken":"flow-token"}`,
        durationMs: 5
      })
      .mockResolvedValueOnce({
        status: 500,
        statusText: "Server Error",
        headers: { "content-type": "application/json" },
        body: `{"error":"failed"}`,
        durationMs: 6
      }) as HttpTransport & ReturnType<typeof vi.fn>;

    const result = await runFlow(flow, services, qa, transport);

    expect(result.steps.map((step) => step.status)).toEqual(["success", "failed", "skipped", "skipped"]);
    expect(result.flow.nodes.map((node) => node.status)).toEqual(["success", "failed", "skipped", "skipped"]);
    expect(result.events.map((event) => event.message)).toContain("[List Products] skipped because a dependency did not succeed.");
  });

  it("blocks execution before sending when validation fails", async () => {
    const transport = vi.fn();
    const invalid = {
      ...flow,
      nodes: [{ ...flow.nodes[0], serviceId: "missing-service", label: "Missing Service" }]
    };

    const result = await runFlow(invalid, services, qa, transport);

    expect(result.issues.map((issue) => issue.message)).toContain("Missing request for flow step: Missing Service.");
    expect(result.flow.nodes[0].status).toBe("blocked");
    expect(result.events[0].message).toContain("Flow blocked:");
    expect(transport).not.toHaveBeenCalled();
  });

  it("cancels a running flow and leaves remaining steps cancelled", async () => {
    const controller = new AbortController();
    const transport: HttpTransport = vi.fn(async () => {
      controller.abort();
      throw new DOMException("Cancelled", "AbortError");
    });

    const result = await runFlow(flow, services, qa, transport, { signal: controller.signal });

    expect(result.error).toBe("Flow cancelled.");
    expect(result.flow.nodes.map((node) => node.status)).toEqual(["cancelled", "cancelled", "cancelled", "cancelled"]);
    expect(result.events.map((event) => event.message)).toContain("Flow cancelled by user.");
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
