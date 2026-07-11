import type {
  FlowEdge,
  FlowEdgeCondition,
  FlowMapping,
  FlowNode,
  FlowNodeStatus,
  ProjectEnvironment,
  ProjectFlow,
  ProjectVariable,
  ProjectService
} from "../project/projectModel";
import { runServiceRequest, type ExecutableRequest, type ExecutedResponse, type HttpTransport, type RunnerConsoleEvent } from "./serviceRunner";

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
  environment: ProjectEnvironment;
  steps: FlowRunStep[];
  events: RunnerConsoleEvent[];
  issues: FlowValidationIssue[];
  request: ExecutableRequest | null;
  response: ExecutedResponse | null;
  error: string | null;
}

export type FlowTemplateId = "authenticated-read" | "create-read-cleanup";

export interface FlowTemplate {
  id: FlowTemplateId;
  name: string;
  description: string;
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "authenticated-read",
    name: "Authenticated Read",
    description: "Login, capture a bearer token, then run read requests with that token."
  },
  {
    id: "create-read-cleanup",
    name: "Create Read Cleanup",
    description: "Login, create a record, read it back, then delete it with the captured id."
  }
];

export function normalizeFlow(flow: ProjectFlow): ProjectFlow {
  const nodes = flow.nodes?.length ? flow.nodes : flow.steps.map((serviceId, index) => createFlowNode(flow.id, serviceId, index));
  const edges = flow.edges?.length ? flow.edges : createLinearEdges(nodes);
  return {
    ...flow,
    steps: nodes.map((node) => node.serviceId),
    nodes,
    edges,
    mappings: flow.mappings ?? []
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
    edges: normalized.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    mappings: normalized.mappings.filter((mapping) => mapping.sourceNodeId !== nodeId)
  };
}

export function addFlowMapping(
  flow: ProjectFlow,
  sourceNodeId: string,
  preset: Partial<Omit<FlowMapping, "id" | "sourceNodeId">> = {}
): ProjectFlow {
  const normalized = normalizeFlow(flow);
  const nextIndex = normalized.mappings.length + 1;
  return {
    ...normalized,
    mappings: [
      ...normalized.mappings,
      {
        id: `${normalized.id}-mapping-${nextIndex}`,
        sourceNodeId,
        jsonPath: preset.jsonPath ?? "$.id",
        variableName: preset.variableName ?? `variable${nextIndex}`,
        secret: preset.secret ?? false
      }
    ]
  };
}

export function applyFlowTemplate(flow: ProjectFlow, templateId: FlowTemplateId): ProjectFlow {
  const normalized = normalizeFlow(flow);
  const steps = templateSteps(templateId);
  const nodes = steps.map((serviceId, index) => createFlowNode(normalized.id, serviceId, index));
  const mappings: FlowMapping[] = templateMappings(templateId, normalized.id, nodes);

  return {
    ...normalized,
    steps,
    nodes,
    edges: createLinearEdges(nodes),
    mappings
  };
}

export function updateFlowMapping(flow: ProjectFlow, mappingId: string, patch: Partial<Omit<FlowMapping, "id">>): ProjectFlow {
  const normalized = normalizeFlow(flow);
  return {
    ...normalized,
    mappings: normalized.mappings.map((mapping) => (
      mapping.id === mappingId ? { ...mapping, ...patch } : mapping
    ))
  };
}

export function deleteFlowMapping(flow: ProjectFlow, mappingId: string): ProjectFlow {
  const normalized = normalizeFlow(flow);
  return {
    ...normalized,
    mappings: normalized.mappings.filter((mapping) => mapping.id !== mappingId)
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

export function connectFlowNodeToService(
  flow: ProjectFlow,
  source: string,
  service: ProjectService,
  condition: FlowEdgeCondition
): ProjectFlow {
  const normalized = normalizeFlow(flow);
  const existingTarget = normalized.nodes.find((node) => node.id !== source && node.serviceId === service.id);
  if (existingTarget) {
    return connectFlowNodes(normalized, source, existingTarget.id, condition);
  }

  const withTarget = addFlowNode(normalized, service);
  const target = withTarget.nodes[withTarget.nodes.length - 1];
  return connectFlowNodes(withTarget, source, target.id, condition);
}

export function disconnectFlowNodes(
  flow: ProjectFlow,
  source: string,
  target: string,
  condition: FlowEdgeCondition
): ProjectFlow {
  const normalized = normalizeFlow(flow);
  const id = `${source}-${condition}-${target}`;
  return {
    ...normalized,
    edges: normalized.edges.filter((edge) => edge.id !== id)
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
  const nodeIds = new Set(normalized.nodes.map((node) => node.id));

  if (!normalized.nodes.length) {
    issues.push({ field: "nodes", message: "Flow needs at least one request step.", severity: "error" });
  }
  for (const node of normalized.nodes) {
    const match = resolveFlowNodeService(node, services);
    if (!match.service) {
      issues.push({ field: "nodes", message: match.reason, severity: "error" });
    }
  }
  for (const edge of normalized.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({ field: "edges", message: "Flow has a dependency link with a missing step.", severity: "error" });
    }
  }
  for (const mapping of normalized.mappings) {
    if (!nodeIds.has(mapping.sourceNodeId)) {
      issues.push({ field: "mappings", message: `Mapping ${mapping.variableName || "(unnamed)"} references a missing source step.`, severity: "error" });
    }
    if (!mapping.variableName.trim()) {
      issues.push({ field: "mappings", message: "Mapping variable name is required.", severity: "error" });
    }
    try {
      parseJsonPath(mapping.jsonPath);
    } catch (error) {
      issues.push({
        field: "mappings",
        message: `Mapping ${mapping.variableName || "(unnamed)"} has invalid JSONPath: ${error instanceof Error ? error.message : String(error)}`,
        severity: "error"
      });
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
  transport?: HttpTransport,
  options: { signal?: AbortSignal } = {}
): Promise<FlowRunResult> {
  const normalized = normalizeFlow(flow);
  const issues = validateFlow(normalized, services);
  const events = createFlowEventRecorder();
  if (issues.some((issue) => issue.severity === "error")) {
    const blocked = normalized.nodes.map((node) => ({ ...node, status: "blocked" as FlowNodeStatus }));
    events.push("error", `Flow blocked: ${issues.map((issue) => issue.message).join(" ")}`);
    return {
      flow: { ...normalized, nodes: blocked },
      environment,
      steps: blocked.map((node) => ({ nodeId: node.id, serviceId: node.serviceId, status: node.status, events: [] })),
      events: events.items,
      issues,
      request: null,
      response: null,
      error: issues.map((issue) => issue.message).join(" ")
    };
  }

  events.push("prepare", `Flow started: ${normalized.name}.`);
  const ordered = orderFlowNodes(normalized);
  const nodeStatuses = new Map(normalized.nodes.map((node) => [node.id, "idle" as FlowNodeStatus]));
  const stepResults: FlowRunStep[] = [];
  let runtimeEnvironment = cloneEnvironment(environment);
  let latestRequest: ExecutableRequest | null = null;
  let latestResponse: ExecutedResponse | null = null;
  let latestError: string | null = null;

  for (const node of ordered) {
    if (options.signal?.aborted) {
      events.push("error", "Flow cancelled by user.");
      latestError = "Flow cancelled.";
      break;
    }
    const dependencyFailed = normalized.edges
      .filter((edge) => edge.target === node.id && edge.condition === "success")
      .some((edge) => nodeStatuses.get(edge.source) !== "success");
    if (dependencyFailed) {
      nodeStatuses.set(node.id, "skipped");
      events.push("success", `[${node.label}] skipped because a dependency did not succeed.`);
      stepResults.push({ nodeId: node.id, serviceId: node.serviceId, status: "skipped", events: [] });
      continue;
    }

    const service = resolveFlowNodeService(node, services).service;
    if (!service) {
      nodeStatuses.set(node.id, "blocked");
      events.push("error", `[${node.label}] blocked because the service is missing.`);
      stepResults.push({ nodeId: node.id, serviceId: node.serviceId, status: "blocked", events: [] });
      continue;
    }

    nodeStatuses.set(node.id, "running");
    events.push("prepare", `[${node.label}] running ${service.method} ${service.path}.`);
    const result = await runServiceRequest(service, runtimeEnvironment, transport, undefined, options);
    latestRequest = result.request;
    latestResponse = result.response;
    latestError = result.error;
    let status: FlowNodeStatus = result.response?.ok && !result.error ? "success" : "failed";
    if (status === "success" && result.response) {
      const mappingResult = applyResponseMappings(normalized, node, result.response, runtimeEnvironment);
      if (mappingResult.issues.length) {
        issues.push(...mappingResult.issues);
        mappingResult.issues.forEach((issue) => events.push("error", issue.message));
        status = "failed";
      } else {
        runtimeEnvironment = mappingResult.environment;
        mappingResult.variables.forEach((variable) => {
          events.push("resolveVariables", `[${node.label}] captured ${variable.name}${variable.secret ? " as a secret" : ""}.`);
        });
      }
    }
    nodeStatuses.set(node.id, status);
    events.push(status === "success" ? "success" : "error", `[${node.label}] ${status}.`);
    stepResults.push({ nodeId: node.id, serviceId: node.serviceId, status, events: result.events });
    if (result.typedError?.category === "cancelled") {
      events.push("error", "Flow cancelled by user.");
      latestError = "Flow cancelled.";
      break;
    }
  }

  const flowCancelled = options.signal?.aborted;
  const nextNodes = normalized.nodes.map((node) => ({
    ...node,
    status: flowCancelled && (nodeStatuses.get(node.id) === "idle" || nodeStatuses.get(node.id) === "running" || nodeStatuses.get(node.id) === "failed")
      ? "cancelled" as FlowNodeStatus
      : nodeStatuses.get(node.id) ?? "idle"
  }));
  return {
    flow: { ...normalized, nodes: nextNodes },
    environment: runtimeEnvironment,
    steps: stepResults,
    events: events.items,
    issues,
    request: latestRequest,
    response: latestResponse,
    error: latestError
  };
}

export function evaluateJsonPath(body: string, jsonPath: string): unknown {
  const tokens = parseJsonPath(jsonPath);
  let current: unknown;
  try {
    current = JSON.parse(body) as unknown;
  } catch {
    throw new Error("Response body is not valid JSON.");
  }
  for (const token of tokens) {
    if (typeof token === "number") {
      if (!Array.isArray(current) || token < 0 || token >= current.length) return undefined;
      current = current[token];
      continue;
    }
    if (!isRecord(current) || !(token in current)) return undefined;
    current = current[token];
  }
  return current;
}

export interface FlowNodeServiceResolution {
  service: ProjectService | undefined;
  reason: string;
}

export function resolveFlowNodeService(node: Pick<FlowNode, "serviceId" | "label">, services: ProjectService[]): FlowNodeServiceResolution {
  const exact = services.find((service) => service.id === node.serviceId);
  if (exact) return { service: exact, reason: "" };

  const expectedId = normalizedRequestKey(node.serviceId);
  const expectedLabel = normalizedRequestKey(node.label);
  const candidates = services.filter((service) => {
    const serviceName = normalizedRequestKey(service.name);
    return serviceName === expectedId
      || serviceName === expectedLabel
      || serviceName.startsWith(`${expectedLabel}-`);
  });

  if (candidates.length === 1) {
    return { service: candidates[0], reason: "" };
  }

  if (candidates.length > 1) {
    return {
      service: undefined,
      reason: `Flow step ${node.label} matches multiple requests. Rename requests or bind the step to a single request.`
    };
  }

  return {
    service: undefined,
    reason: `Missing request for flow step: ${node.label}.`
  };
}

function normalizedRequestKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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

function applyResponseMappings(
  flow: ProjectFlow,
  node: FlowNode,
  response: ExecutedResponse,
  environment: ProjectEnvironment
): { environment: ProjectEnvironment; variables: ProjectVariable[]; issues: FlowValidationIssue[] } {
  const mappings = flow.mappings.filter((mapping) => mapping.sourceNodeId === node.id);
  const variables: ProjectVariable[] = [];
  const issues: FlowValidationIssue[] = [];
  for (const mapping of mappings) {
    try {
      const value = evaluateJsonPath(response.rawBody, mapping.jsonPath);
      if (value === undefined) {
        issues.push({
          field: "mappings",
          message: `[${node.label}] mapping failed: ${mapping.jsonPath} produced no value for ${mapping.variableName}.`,
          severity: "error"
        });
        continue;
      }
      variables.push({
        name: mapping.variableName,
        value: stringifyMappedValue(value),
        secret: mapping.secret
      });
    } catch (error) {
      issues.push({
        field: "mappings",
        message: `[${node.label}] mapping failed: ${mapping.jsonPath} for ${mapping.variableName}. ${error instanceof Error ? error.message : String(error)}`,
        severity: "error"
      });
    }
  }
  return {
    environment: variables.length ? { ...environment, variables: mergeVariables(environment.variables, variables) } : environment,
    variables,
    issues
  };
}

function mergeVariables(current: ProjectVariable[], captured: ProjectVariable[]): ProjectVariable[] {
  const next = current.slice();
  for (const variable of captured) {
    const index = next.findIndex((item) => item.name === variable.name);
    if (index >= 0) {
      next[index] = { ...next[index], value: variable.value, secret: next[index].secret || variable.secret };
    } else {
      next.push(variable);
    }
  }
  return next;
}

function cloneEnvironment(environment: ProjectEnvironment): ProjectEnvironment {
  return {
    ...environment,
    variables: environment.variables.map((variable) => ({ ...variable }))
  };
}

function stringifyMappedValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) return String(value);
  return JSON.stringify(value);
}

function parseJsonPath(jsonPath: string): Array<string | number> {
  if (!jsonPath.trim()) throw new Error("JSONPath is required.");
  if (jsonPath === "$") return [];
  if (!jsonPath.startsWith("$.")) throw new Error("JSONPath must start with $. or be exactly $.");
  const tokens: Array<string | number> = [];
  const segments = jsonPath.slice(2).split(".");
  for (const segment of segments) {
    if (!segment) throw new Error("JSONPath contains an empty segment.");
    const match = /^([A-Za-z_][A-Za-z0-9_-]*)(\[\d+\])*$/.exec(segment);
    if (!match) throw new Error(`Unsupported JSONPath segment: ${segment}.`);
    tokens.push(match[1]);
    const indexes = segment.match(/\[(\d+)\]/g) ?? [];
    indexes.forEach((index) => tokens.push(Number(index.slice(1, -1))));
  }
  return tokens;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function templateSteps(templateId: FlowTemplateId): string[] {
  if (templateId === "authenticated-read") {
    return ["login", "current-user", "list-products"];
  }
  return ["login", "create-order", "get-order", "cleanup-order"];
}

function templateMappings(templateId: FlowTemplateId, flowId: string, nodes: FlowNode[]): FlowMapping[] {
  const mappings: FlowMapping[] = [
    {
      id: `${flowId}-mapping-1`,
      sourceNodeId: nodes[0]?.id ?? "",
      jsonPath: "$.accessToken",
      variableName: "accessToken",
      secret: true
    }
  ];
  if (templateId === "create-read-cleanup") {
    mappings.push({
      id: `${flowId}-mapping-2`,
      sourceNodeId: nodes[1]?.id ?? "",
      jsonPath: "$.id",
      variableName: "orderId",
      secret: false
    });
  }
  return mappings;
}
