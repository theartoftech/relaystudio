# Relay Studio Product Terminology Glossary

## Core Objects

| Term | Definition | UI Usage |
| --- | --- | --- |
| Project | Local Relay Studio workspace saved as a `.restproj` file | `Open Project`, `Save Project`, recent projects |
| Service | Reusable REST request definition with method, URL, auth, params, headers, body, retry, and tests | Explorer item and request editor tab |
| Service Folder | Grouping of related services inside a project | Auth, Products, Orders, Admin |
| Request | A concrete executable HTTP call produced from a service plus resolved variables and auth | Request composer, console, response metadata |
| Response | Result of a sent request, including status, timing, headers, body, and errors | Response dock |
| Saved Response | Response evidence persisted to disk with project metadata | Saved Responses explorer |
| Flow | Visual chain of request steps with dependencies and variable mappings | Flow editor tab |
| Step | One executable node inside a flow | Flow console and flow canvas |
| Environment | Named set of variable values such as QA, Staging, or Prod | Environment selector |
| Variable | Named placeholder resolved at execution time | `{{baseUrl}}`, `{{token}}` |
| Vault | Encrypted storage area for sensitive variables | Vault (Encrypted) |
| Auth Profile | Reusable authentication configuration | Auth panel and settings |
| Import Source | OpenAPI/Swagger URL or local file used to generate services | Import wizard |
| Diagnostics Bundle | Redacted support artifact containing logs, app metadata, and recent console events | Settings or Help |

## Execution Terms

| Term | Definition | UI Usage |
| --- | --- | --- |
| Send Request | Execute the active request once | Primary request action |
| Run Flow | Execute the active flow according to dependencies | Primary flow action |
| Stop | Cancel the active request or flow | Execution toolbar and console |
| Resolve Variables | Replace placeholders with environment, global, vault, or flow values | Console event |
| Generated Request Header | Header produced by auth configuration rather than manually entered by the user | Auth preview |
| Request Summary | Resolved method, URL, headers count, params count, body type, and auth state | Inspector |
| Console Event | Timestamped execution log entry | Console dock |
| Timeline | Ordered execution view for request or flow | Console or response metrics |
| Mapping | JSONPath extraction from one response into a variable or later request field | Flow mapping panel |
| Cleanup Policy | Flow behavior that removes remote data created during the run | Create and cleanup flow |

## State Terms

| Term | Definition | Required Behavior |
| --- | --- | --- |
| Dirty | Project has unsaved changes | Show marker and prompt on close |
| Valid | Request or flow can execute | Enable send/run action |
| Invalid | Request or flow has blocking validation errors | Disable execution or show blocking confirmation |
| Blocked | Flow step cannot run because dependency or mapping failed | Show source step and reason |
| Skipped | Flow step intentionally not run due to branch or cleanup policy | Show in flow console |
| Secret | Value that must be hidden except in active credential entry controls | Redact everywhere else |
| Redacted | Secret replaced with a mask or placeholder | Use consistent mask in UI and exports |

## Naming Rules

- Use `Project`, not workspace, when referring to the saved `.restproj` file.
- Use `Service`, not endpoint, for user-created reusable request definitions.
- Use `Request`, not service, when describing one execution event.
- Use `Saved Response`, not snapshot, for persisted response evidence.
- Use `Flow`, not workflow, in UI labels unless describing the general concept.
- Use `Environment`, not profile, for variable sets.
- Use `Vault` only for encrypted sensitive variables.
- Use `Import API Docs` as the primary label for OpenAPI/Swagger import.
