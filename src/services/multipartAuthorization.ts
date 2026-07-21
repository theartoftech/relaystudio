import type { ProjectService } from "../project/projectModel";

export interface MultipartFileApproval {
  serviceId: string;
  fieldId: string;
  filePath: string;
  destinationOrigin: string;
}

export function approveMultipartFile(service: ProjectService, fieldId: string, destinationUrl: string): MultipartFileApproval {
  const field = service.body.fields?.find((candidate) => candidate.id === fieldId && candidate.enabled && candidate.valueType === "file");
  if (!field) throw new Error("Multipart file field was not found or is not enabled.");
  if (!field.value.trim()) throw new Error("Choose a local multipart file before approving it.");
  return {
    serviceId: service.id,
    fieldId,
    filePath: field.value,
    destinationOrigin: destinationOrigin(destinationUrl)
  };
}

export function isMultipartFileApproved(
  approval: MultipartFileApproval,
  service: ProjectService,
  fieldId: string,
  destinationUrl: string
): boolean {
  const field = service.body.fields?.find((candidate) => candidate.id === fieldId);
  return Boolean(field)
    && approval.serviceId === service.id
    && approval.fieldId === fieldId
    && approval.filePath === field?.value
    && approval.destinationOrigin === destinationOrigin(destinationUrl);
}

export function assertMultipartFilesApproved(
  approvals: readonly MultipartFileApproval[],
  service: ProjectService,
  destinationUrl: string
): void {
  if (service.body.contentType !== "multipart/form-data") return;
  for (const field of service.body.fields ?? []) {
    if (!field.enabled || field.valueType !== "file") continue;
    if (!approvals.some((approval) => isMultipartFileApproved(approval, service, field.id, destinationUrl))) {
      const fileName = field.value.replace(/\\/g, "/").split("/").pop() || field.name || "file";
      throw new Error(`Approve local file '${fileName}' for ${destinationOrigin(destinationUrl)} before sending.`);
    }
  }
}

function destinationOrigin(value: string): string {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
    return parsed.origin;
  } catch {
    throw new Error("Multipart file approval requires an absolute HTTP(S) destination.");
  }
}
