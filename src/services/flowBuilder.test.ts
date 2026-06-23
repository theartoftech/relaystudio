import { describe, expect, it, vi } from "vitest";
import { createSampleProject, type ProjectFlow } from "../project/projectModel";
import {
  addFlowNode,
  connectFlowNodes,
  deleteFlowNode,
  normalizeFlow,
  orderFlowNodes,
  reorderFlowNode,
  runFlow,
  validateFlow
} from "./flowBuilder";
import type { HttpTransport } from "./serviceRunner";

const project = createSampleProject("2026-06-21T00:00:00.000Z");
const qa = project.environments[0];
const flow = project.flows.find((item) => item.id === "authenticated-read") as ProjectFlow;
const services = project.services;

describe("flow builder", () => {
  it("normalizes legacy step lists into positioned nodes and success edges", () => {
    const legacy = { id: "legacy", name: "Legacy", steps: ["login", "current-user"], nodes: [], edges: [] };
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
    expect(validateFlow(missingService, services).map((issue) => issue.message)).toContain("Missing service for flow step: Missing Service.");
    expect(validateFlow(missingEdgeNode, services).map((issue) => issue.message)).toContain("Flow has a dependency link with a missing step.");
    expect(validateFlow(cycle, services).map((issue) => issue.message)).toContain("Flow dependencies contain a cycle.");
    expect(() => orderFlowNodes(cycle)).toThrow("Flow dependencies contain a cycle.");
  });

  it("adds, deletes, connects, and reorders request nodes", () => {
    const service = services.find((item) => item.id === "search-products")!;
    const added = addFlowNode(flow, service);
    const newNode = added.nodes[added.nodes.length - 1];
    const connected = connectFlowNodes(added, added.nodes[0].id, newNode.id, "failure");
    const duplicate = connectFlowNodes(connected, added.nodes[0].id, newNode.id, "failure");
    const reordered = reorderFlowNode(duplicate, newNode.id, "left");
    const deleted = deleteFlowNode(reordered, newNode.id);

    expect(newNode).toMatchObject({ serviceId: "search-products", label: "Search Products", status: "idle" });
    expect(connected.edges).toHaveLength(added.edges.length + 1);
    expect(duplicate.edges).toHaveLength(connected.edges.length);
    expect(reordered.nodes[reordered.nodes.length - 2].id).toBe(newNode.id);
    expect(deleted.nodes.some((node) => node.id === newNode.id)).toBe(false);
    expect(deleted.edges.some((edge) => edge.source === newNode.id || edge.target === newNode.id)).toBe(false);
  });

  it("runs successful flow steps with grouped console events", async () => {
    const transport = vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: `{"ok":true}`,
      durationMs: 5
    }) as HttpTransport & ReturnType<typeof vi.fn>;

    const result = await runFlow(flow, services, qa, transport);

    expect(result.issues).toEqual([]);
    expect(result.steps.map((step) => step.status)).toEqual(["success", "success", "success", "success"]);
    expect(result.flow.nodes.map((node) => node.status)).toEqual(["success", "success", "success", "success"]);
    expect(result.events.map((event) => event.message)).toContain("[Login] success.");
    expect(transport).toHaveBeenCalledTimes(4);
  });

  it("fails a step and skips downstream success dependencies", async () => {
    const transport = vi.fn()
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        body: `{"ok":true}`,
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

    expect(result.issues.map((issue) => issue.message)).toContain("Missing service for flow step: Missing Service.");
    expect(result.flow.nodes[0].status).toBe("blocked");
    expect(result.events[0].message).toContain("Flow blocked:");
    expect(transport).not.toHaveBeenCalled();
  });
});
