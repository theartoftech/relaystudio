import { describe, expect, it } from "vitest";
import {
  centerFlowViewportForNodes,
  nextActiveDragPositions,
  recoverVisibleFlowPositions,
  resetFlowLayoutPositions
} from "./flowCanvasState";

describe("flow canvas state", () => {
  it("tracks only the active dragged node when multiple position changes are reported", () => {
    const next = nextActiveDragPositions("node-2", [
      { id: "node-1", type: "position", position: { x: 10, y: 20 } },
      { id: "node-2", type: "position", position: { x: 150, y: 80 } },
      { id: "node-3", type: "position", position: { x: 300, y: 120 } }
    ]);

    expect(next).toEqual({ "node-2": { x: 150, y: 80 } });
  });

  it("ignores layout and dimension changes when no drag is active", () => {
    expect(nextActiveDragPositions(null, [
      { id: "node-1", type: "dimensions", position: { x: 10, y: 20 } }
    ])).toBeNull();
  });

  it("ignores changes that do not include the active node position", () => {
    expect(nextActiveDragPositions("node-2", [
      { id: "node-1", type: "position", position: { x: 10, y: 20 } },
      { id: "node-2", type: "dimensions" }
    ])).toBeNull();
  });

  it("recovers a flow layout when every node is off canvas", () => {
    const recovered = recoverVisibleFlowPositions([
      { id: "login", serviceId: "login", label: "Login", position: { x: -900, y: -900 }, status: "idle" },
      { id: "read", serviceId: "current-user", label: "Current User", position: { x: -700, y: -900 }, status: "idle" }
    ], { width: 820, height: 420 });

    expect(recovered).toEqual({
      login: { x: 42, y: 117 },
      read: { x: 272, y: 209 }
    });
  });

  it("does not recover layout when at least one node is visible", () => {
    expect(recoverVisibleFlowPositions([
      { id: "login", serviceId: "login", label: "Login", position: { x: 80, y: 120 }, status: "idle" },
      { id: "read", serviceId: "current-user", label: "Current User", position: { x: -700, y: -900 }, status: "idle" }
    ], { width: 820, height: 420 })).toBeNull();
  });

  it("creates a stable default layout for reset actions", () => {
    expect(resetFlowLayoutPositions([
      { id: "login", serviceId: "login", label: "Login", position: { x: -900, y: -900 }, status: "idle" },
      { id: "read", serviceId: "current-user", label: "Current User", position: { x: -700, y: -900 }, status: "idle" }
    ])).toEqual({
      login: { x: 80, y: 120 },
      read: { x: 310, y: 212 }
    });
  });

  it("centers a zoomed-out flow so right-side action boxes remain visible", () => {
    const viewport = centerFlowViewportForNodes([
      { position: { x: 80, y: 120 } },
      { position: { x: 520, y: 212 } },
      { position: { x: 980, y: 120 } }
    ], { width: 1160, height: 520 }, 0.7, { nodeWidth: 178, nodeHeight: 96, padding: 42 });

    expect(viewport.x).toBeCloseTo(146.7);
    expect(viewport.y).toBeCloseTo(110.2);
    expect(viewport.zoom).toBe(0.7);
    expect(980 * viewport.zoom + viewport.x + 178 * viewport.zoom).toBeLessThan(1160);
  });

  it("anchors oversized zoomed-out flows to the left padding", () => {
    const viewport = centerFlowViewportForNodes([
      { position: { x: 80, y: 120 } },
      { position: { x: 1880, y: 120 } }
    ], { width: 760, height: 420 }, 0.7, { nodeWidth: 178, nodeHeight: 96, padding: 42 });

    expect(viewport.x).toBe(-14);
    expect(80 * viewport.zoom + viewport.x).toBe(42);
  });
});
