import type {
  FlowEdge,
  FlowEdgeCondition,
  FlowNode,
  FlowNodeStatus,
  ProjectEnvironment,
  ProjectFlow,
  ProjectService
} from "../project/projectModel";
import { runServiceRequest, type HttpTransport, type RunnerConsoleEvent } from "./serviceRunner";

export interface FlowValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface FlowRunStep {
  nodeId: string;
  serviceId: string;
  status: FlowNodeStatus;
  events: RunnerConsoleEvent[];
}

export interface FlowRunResult {
  flow: ProjectFlow;
  steps: FlowRunStep[];
  events: RunnerConsoleEvent[];
  issues: FlowValidationIssue[];
}

export function normalizeFlow(flow: ProjectFlow): ProjectFlow {
  const nodes = flow.nodes?.length ? flow.nodes : flow.steps.map((serviceId, index) => createFlowNode(flow.id, serviceId, index));
  const edges = flow.edges?.length ? flow.edges : createLinearEdges(nodes);
  return {
    ...flow,
    steps: nodes.map((node) => node.serviceId),
    nodes,
    edges
  };
}

export function addFlowNode(flow: ProjectFlow, service: ProjectService): ProjectFlow {
  const normalized = normalizeFlow(flow);
  const node = createFlowNode(flow.id, service.id, normalized.nodes.length, service.name);
  return {
    ...normalized,
    steps: [...normalized.steps, service.id],
    nodes: [...normalized.nodes, node]
  };
}

export function deleteFlowNode(flow: ProjectFlow, nodeId: string): ProjectFlow {
  const normalized = normalizeFlow(flow);
  const nodes = normalized.nodes.filter((node) => node.id !== nodeId);
  return {
    ...normalized,
    steps: nodes.map((node) => node.serviceId),
    nodes,
    edges: normalized.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
  };
}

export function connectFlowNodes(
  flow: ProjectFlow,
  source: string,
  target: string,
  condition: FlowEdgeCondition
): ProjectFlow {
  const normalized = normalizeFlow(flow);
  const id = `${source}-${condition}-${target}`;
  if (source === target || normalized.edges.some((edge) => edge.id === id)) {
    return normalized;
  }
  return {
    ...normalized,
    edges: [...normalized.edges, { id, source, target, condition }]
  };
}

export function reorderFlowNode(flow: ProjectFlow, nodeId: string, direction: "left" | "right"): ProjectFlow {
  const normalized = normalizeFlow(flow);
  const index = normalized.nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) return normalized;
  const targetIndex = direction === "left" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= normalized.nodes.length) return normalized;
  const nodes = normalized.nodes.slice();
  const [node] = nodes.splice(index, 1);
  nodes.splice(targetIndex, 0, node);
  return {
    ...normalized,
    steps: nodes.map((item) => item.serviceId),
    nodes: nodes.map((item, nextIndex) => ({
      ...item,
      position: { ...item.position, x: 80 + nextIndex * 230 }
    }))
  };
}

export function validateFlow(flow: ProjectFlow, services: ProjectService[]): FlowValidationIssue[] {
  const normalized = normalizeFlow(flow);
  const issues: FlowValidationIssue[] = [];
  const serviceIds = new Set(services.map((service) => service.id));
  const nodeIds = new Set(normalized.nodes.map((node) => node.id));

  if (!normalized.nodes.length) {
    issues.push({ field: "nodes", message: "Flow needs at least one request step.", severity: "error" });
  }
  for (const node of normalized.nodes) {
    if (!serviceIds.has(node.serviceId)) {
      issues.push({ field: "nodes", message: `Missing service for flow step: ${node.label}.`, severity: "error" });
    }
  }
  for (const edge of normalized.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({ field: "edges", message: "Flow has a dependency link with a missing step.", severity: "error" });
    }
  }
  if (hasCycle(normalized)) {
    issues.push({ field: "edges", message: "Flow dependencies contain a cycle.", severity: "error" });
  }

  return issues;
}

export function orderFlowNodes(flow: ProjectFlow): FlowNode[] {
  const normalized = normalizeFlow(flow);
  const inbound = new Map(normalized.nodes.map((node) => [node.id, 0]));
  for (const edge of normalized.edges) {
    inbound.set(edge.target, (inbound.get(edge.target) ?? 0) + 1);
  }
  const queue = normalized.nodes.filter((node) => inbound.get(node.id) === 0);
  const ordered: FlowNode[] = [];

  while (queue.length) {
    const node = queue.shift() as FlowNode;
    ordered.push(node);
    for (const edge of normalized.edges.filter((item) => item.source === node.id)) {
      inbound.set(edge.target, (inbound.get(edge.target) ?? 0) - 1);
      if (inbound.get(edge.target) === 0) {
        const targetNode = normalized.nodes.find((item) => item.id === edge.target);
        if (targetNode) queue.push(targetNode);
      }
    }
  }

  if (ordered.length !== normalized.nodes.length) {
    throw new Error("Flow dependencies contain a cycle.");
  }
  return ordered;
}

export async function runFlow(
  flow: ProjectFlow,
  services: ProjectService[],
  environment: ProjectEnvironment,
  transport?: HttpTransport
): Promise<FlowRunResult> {
  const normalized = normalizeFlow(flow);
  const issues = validateFlow(normalized, services);
  const events = createFlowEventRecorder();
  if (issues.some((issue) => issue.severity === "error")) {
    const blocked = normalized.nodes.map((node) => ({ ...node, status: "blocked" as FlowNodeStatus }));
    events.push("error", `Flow blocked: ${issues.map((issue) => issue.message).join(" ")}`);
    return {
      flow: { ...normalized, nodes: blocked },
      steps: blocked.map((node) => ({ nodeId: node.id, serviceId: node.serviceId, status: node.status, events: [] })),
      events: events.items,
      issues
    };
  }

  events.push("prepare", `Flow started: ${normalized.name}.`);
  const ordered = orderFlowNodes(normalized);
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const nodeStatuses = new Map(normalized.nodes.map((node) => [node.id, "idle" as FlowNodeStatus]));
  const stepResults: FlowRunStep[] = [];

  for (const node of ordered) {
    const dependencyFailed = normalized.edges
      .filter((edge) => edge.target === node.id && edge.condition === "success")
      .some((edge) => nodeStatuses.get(edge.source) !== "success");
    if (dependencyFailed) {
      nodeStatuses.set(node.id, "skipped");
      events.push("success", `[${node.label}] skipped because a dependency did not succeed.`);
      stepResults.push({ nodeId: node.id, serviceId: node.serviceId, status: "skipped", events: [] });
      continue;
    }

    const service = servicesById.get(node.serviceId);
    if (!service) {
      nodeStatuses.set(node.id, "blocked");
      events.push("error", `[${node.label}] blocked because the service is missing.`);
      stepResults.push({ nodeId: node.id, serviceId: node.serviceId, status: "blocked", events: [] });
      continue;
    }

    nodeStatuses.set(node.id, "running");
    events.push("prepare", `[${node.label}] running ${service.method} ${service.path}.`);
    const result = await runServiceRequest(service, environment, transport);
    const status: FlowNodeStatus = result.response?.ok && !result.error ? "success" : "failed";
    nodeStatuses.set(node.id, status);
    events.push(status === "success" ? "success" : "error", `[${node.label}] ${status}.`);
    stepResults.push({ nodeId: node.id, serviceId: node.serviceId, status, events: result.events });
  }

  const nextNodes = normalized.nodes.map((node) => ({ ...node, status: nodeStatuses.get(node.id) ?? "idle" }));
  return {
    flow: { ...normalized, nodes: nextNodes },
    steps: stepResults,
    events: events.items,
    issues
  };
}

export function createFlowNode(flowId: string, serviceId: string, index: number, label = serviceIdToLabel(serviceId)): FlowNode {
  return {
    id: `${flowId}-${serviceId}-${index + 1}`,
    serviceId,
    label,
    position: { x: 80 + index * 230, y: 120 + (index % 2) * 92 },
    status: "idle"
  };
}

function createLinearEdges(nodes: FlowNode[]): FlowEdge[] {
  return nodes.slice(1).map((node, index) => ({
    id: `${nodes[index].id}-success-${node.id}`,
    source: nodes[index].id,
    target: node.id,
    condition: "success"
  }));
}

function hasCycle(flow: ProjectFlow): boolean {
  try {
    orderFlowNodes(flow);
    return false;
  } catch {
    return true;
  }
}

function createFlowEventRecorder() {
  const items: RunnerConsoleEvent[] = [];
  return {
    items,
    push(phase: RunnerConsoleEvent["phase"], message: string) {
      items.push({
        sequence: items.length + 1,
        phase,
        level: phase === "error" ? "error" : phase === "success" ? "success" : "info",
        message
      });
    }
  };
}

function serviceIdToLabel(serviceId: string): string {
  return serviceId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
