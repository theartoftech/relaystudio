import type { FlowNode, FlowNodePosition } from "../project/projectModel";

interface PositionChangeLike {
  id?: string;
  type: string;
  position?: FlowNodePosition;
}

export interface FlowCanvasSize {
  width: number;
  height: number;
}

export interface FlowCanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface FlowCanvasViewportOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  padding?: number;
}

export interface FlowCanvasScrollWorldOptions extends FlowCanvasViewportOptions {
  viewport: FlowCanvasViewport;
}

export function nextActiveDragPositions(
  activeNodeId: string | null,
  changes: readonly PositionChangeLike[]
): Record<string, FlowNodePosition> | null {
  if (!activeNodeId) return null;
  const positionChange = changes.find((change) => (
    change.type === "position" && change.id === activeNodeId && Boolean(change.position)
  ));
  if (!positionChange?.position) return null;
  return { [activeNodeId]: positionChange.position };
}

export function recoverVisibleFlowPositions(
  nodes: readonly FlowNode[],
  canvasSize: FlowCanvasSize | null
): Record<string, FlowNodePosition> | null {
  if (!canvasSize || !nodes.length || canvasSize.width < 120 || canvasSize.height < 120) return null;
  if (nodes.some((node) => nodeIntersectsCanvas(node.position, canvasSize))) return null;

  const startX = 42;
  const startY = Math.max(36, Math.min(120, Math.floor(canvasSize.height * 0.28)));
  return Object.fromEntries(nodes.map((node, index) => [
    node.id,
    flowLayoutPosition(index, startX, startY)
  ]));
}

export function resetFlowLayoutPositions(nodes: readonly FlowNode[]): Record<string, FlowNodePosition> {
  return Object.fromEntries(nodes.map((node, index) => [node.id, flowLayoutPosition(index)]));
}

export function centerFlowViewportForNodes(
  nodes: readonly Pick<FlowNode, "position">[],
  canvasSize: FlowCanvasSize | null,
  zoom: number,
  options: FlowCanvasViewportOptions = {}
): FlowCanvasViewport {
  if (!canvasSize || !nodes.length) return { x: 0, y: 0, zoom };

  const nodeWidth = options.nodeWidth ?? 190;
  const nodeHeight = options.nodeHeight ?? 112;
  const padding = options.padding ?? 42;
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxX = Math.max(...nodes.map((node) => node.position.x + nodeWidth));
  const maxY = Math.max(...nodes.map((node) => node.position.y + nodeHeight));
  const scaledWidth = (maxX - minX) * zoom;
  const scaledHeight = (maxY - minY) * zoom;
  const availableWidth = Math.max(1, canvasSize.width - padding * 2);
  const availableHeight = Math.max(1, canvasSize.height - padding * 2);

  return {
    x: (scaledWidth <= availableWidth ? (canvasSize.width - scaledWidth) / 2 : padding) - minX * zoom,
    y: (scaledHeight <= availableHeight ? (canvasSize.height - scaledHeight) / 2 : padding) - minY * zoom,
    zoom
  };
}

export function scrollWorldSizeForNodes(
  nodes: readonly Pick<FlowNode, "position">[],
  canvasSize: FlowCanvasSize | null,
  options: FlowCanvasScrollWorldOptions
): FlowCanvasSize {
  const visibleSize = canvasSize ?? { width: 0, height: 0 };
  if (!nodes.length) return visibleSize;

  const nodeWidth = options.nodeWidth ?? 190;
  const nodeHeight = options.nodeHeight ?? 112;
  const padding = options.padding ?? 42;
  const viewport = options.viewport;
  const maxX = Math.max(...nodes.map((node) => (
    (node.position.x + nodeWidth) * viewport.zoom + viewport.x
  )));
  const maxY = Math.max(...nodes.map((node) => (
    (node.position.y + nodeHeight) * viewport.zoom + viewport.y
  )));

  return {
    width: Math.ceil(Math.max(visibleSize.width, maxX + padding)),
    height: Math.ceil(Math.max(visibleSize.height, maxY + padding))
  };
}

function nodeIntersectsCanvas(position: FlowNodePosition, canvasSize: FlowCanvasSize): boolean {
  const nodeWidth = 190;
  const nodeHeight = 112;
  return position.x + nodeWidth >= 0
    && position.y + nodeHeight >= 0
    && position.x <= canvasSize.width
    && position.y <= canvasSize.height;
}

function flowLayoutPosition(index: number, startX = 80, startY = 120): FlowNodePosition {
  return {
    x: startX + index * 230,
    y: startY + (index % 2) * 92
  };
}
