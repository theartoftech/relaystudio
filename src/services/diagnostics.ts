import type { RelayProject } from "../project/projectModel";
import type { RunnerConsoleEvent } from "./serviceRunner";

export interface DiagnosticsBundleInput {
  appVersion: string;
  platform: string;
  project: RelayProject;
  events: RunnerConsoleEvent[];
  generatedAt?: string;
}

export interface DiagnosticsBundle {
  format: "relay-studio-diagnostics";
  schemaVersion: 1;
  generatedAt: string;
  appVersion: string;
  platform: string;
  project: {
    id: string;
    name: string;
    schemaVersion: number;
    serviceCount: number;
    flowCount: number;
    environmentCount: number;
  };
  recentEvents: RunnerConsoleEvent[];
}

export function createDiagnosticsBundle(input: DiagnosticsBundleInput): DiagnosticsBundle {
  return {
    format: "relay-studio-diagnostics",
    schemaVersion: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    appVersion: input.appVersion,
    platform: input.platform,
    project: {
      id: input.project.id,
      name: input.project.name,
      schemaVersion: input.project.schemaVersion,
      serviceCount: input.project.services.length,
      flowCount: input.project.flows.length,
      environmentCount: input.project.environments.length
    },
    recentEvents: input.events.slice(-100).map((event) => ({
      ...event,
      message: redactDiagnosticText(event.message)
    }))
  };
}

function redactDiagnosticText(value: string): string {
  return value
    .replace(/(Authorization\s*:\s*)Bearer\s+[^\s,;]+/gi, "$1Bearer ********")
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer ********")
    .replace(/((?:password|token|secret|api[-_]?key)\s*[:=]\s*)([^\s,;]+)/gi, "$1********");
}
