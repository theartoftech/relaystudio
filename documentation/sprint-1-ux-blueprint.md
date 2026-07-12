# Sprint 1 UX Blueprint And Test Strategy

## Status

Sprint 1 is implemented as a planning package. The artifacts in this file translate the approved Sprint 0 screenshots into implementation-ready structure for Sprint 2.

## Design Brief

Relay Studio is a local-first desktop REST client for engineers and product managers who need to test REST services, save projects, inspect responses, and chain calls without relying on a hosted Postman-style service. The approved direction is a dense desktop IDE workbench with project navigation, tabbed request editing, inspector panels, response evidence, and console transparency visible together.

## Canonical Shell Anatomy

The default desktop shell has these regions:

| Region | Purpose | Sprint 2 Requirement |
| --- | --- | --- |
| Desktop title or command bar | Window identity, command search, environment selector, primary run/save actions | Must be visible on initial app load |
| Activity rail or primary sidebar | Fast access to Projects, Services, Runner, Flows, Saved Responses, and Settings | Must show active section and stable icons |
| Project explorer | Hierarchical project content: services, folders, flows, environments, variables, vault, saved responses | Must support empty and populated states |
| Tab strip | Open editors for welcome, requests, flows, saved responses, settings, and import wizard | Must support active, inactive, dirty, and closeable tab states |
| Request composer | HTTP method, URL, protocol/options, Send Request, and related run actions | Must visually match the approved screenshot density |
| Request editor | Authorization, Headers, Query Params, Path Params, Body, Retry, Tests, Settings, and script-related tabs | Must show tab state and validation indicators |
| Inspector | Context-sensitive details for auth, variables, request properties, environment, docs, scripts, and flow context | Must be docked on the right by default |
| Response dock | Status, timing, payload size, response body, headers, cookies, tests, metrics, save response controls | Must be visible below the editor on desktop widths |
| Console dock | Ordered execution events, timestamps, filtering, clear, export log, and flow grouping | Must be visible or one click away below the response/editor area |
| Status and validation surfaces | Dirty state, request validation, missing auth, malformed JSON, blocked flow, save warnings | Must be explicit and actionable |

## Navigation Model

### Primary Areas

| Area | Entry Point | Opens In | Notes |
| --- | --- | --- | --- |
| Projects | Activity rail or sidebar | Project explorer plus welcome/project tab | Used for create, open, recent, and save workflows |
| Services | Activity rail or explorer tree | Request editor tab | Main editing surface for REST calls |
| Runner | Activity rail or command surface | Runner tab or focused current request | Executes the current selected request |
| Flows | Activity rail or explorer tree | Flow editor tab | Visual workflow canvas and flow console context |
| Saved Responses | Activity rail or explorer tree | Saved response viewer tab | Browse, compare, and reload previous evidence |
| Settings | Activity rail, command surface, or menu | Settings tab or modal | Preferences, encryption, redaction, close behavior |
| Import API Docs | Command surface, welcome, or explorer empty state | Import wizard tab | First-class project growth workflow |

### Explorer Hierarchy

```text
Project
  Services
    Auth
      POST Login
      POST Logout
    Products
      GET List Products
      GET Get Product
    Orders
      POST Create Order
      GET Get Order
      PUT Update Order
      DELETE Cleanup Order
  Flows
    Authenticated Read
    Create And Cleanup
  Environments
    QA Environment
    Staging Environment
    Prod Environment
  Variables
    Global Variables
    Vault (Encrypted)
  Saved Responses
    Today
    Yesterday
```

### Tab Rules

- Welcome, import wizard, requests, flows, saved responses, settings, and diagnostics can open as tabs.
- Request tabs display method and short service name.
- Flow tabs display a flow icon and flow name.
- Saved response tabs display file name and response status where available.
- Dirty tabs show a visible unsaved marker.
- Closing a dirty tab triggers the same save decision model as window close when project state is affected.

## Command Placement Map

| Command | Primary Location | Secondary Location | Keyboard Target |
| --- | --- | --- | --- |
| New Project | File menu or command surface | Welcome screen | `Cmd/Ctrl+N` |
| Import API Docs | Command surface | Welcome, explorer empty state, command palette | `Cmd/Ctrl+I` |
| Open Project | File menu or command surface | Recent projects | `Cmd/Ctrl+O` |
| Save Project | Command surface | File menu, command palette | `Cmd/Ctrl+S` |
| Save All | Ribbon or command palette | File menu | `Cmd/Ctrl+Shift+S` |
| Close Project | File menu | Command palette | None required |
| Send Request | Request composer | Command surface, command palette | `Cmd/Ctrl+Enter` |
| Run Flow | Flow editor toolbar | Command surface, command palette | `Cmd/Ctrl+R` |
| Stop | Command surface while running | Console dock | `Esc` when execution is focused |
| Save Response | Response dock | Command surface, command palette | None required |
| Export Response | Response dock | Command surface | None required |
| History | Command surface | Response dock or console dock | None required |
| Environment Selector | Top command bar or ribbon | Inspector | None required |
| Manage Environments | Environment dropdown | Settings | None required |
| Settings | Activity rail or command surface | Command palette | `Cmd/Ctrl+,` |
| Command Search | Top command bar | Keyboard only | `Cmd/Ctrl+K` |

## Platform Shell Decision

The default implementation should use the focused IDE workbench shell from the macOS-style and full IDE references. The Windows ribbon reference is useful for command grouping but should be treated as a deferred platform enhancement unless Sprint 2 implementation proves the command surface is too crowded.

Decision:

- Sprint 2 baseline: shared cross-platform IDE shell.
- Windows ribbon: deferred enhancement.
- Command palette: required baseline because it reduces dependence on ribbon/menu density.

## Screen Inventory

| Screen Or State | Purpose | Sprint Target |
| --- | --- | --- |
| Welcome / Project Start | New project, open project, recent projects, import API docs | Sprint 2 shell, Sprint 3 persistence |
| OpenAPI Import Wizard | URL/file entry, parse, preview, select, import summary | Sprint 4A |
| Main Workbench | Default project workspace | Sprint 2 shell |
| Service Collection Explorer | Navigate services, folders, flows, environments, variables, responses | Sprint 2 shell, Sprint 4 data |
| Service Editor | Edit method, URL, auth, params, headers, body, retry, tests, scripts | Sprint 4 |
| Authorization Panel | Configure auth mode and preview generated headers | Sprint 4 |
| Variables Inspector | View and edit environment/global/vault variables | Sprint 3-4 |
| Single Request Runner | Execute service and stream request events | Sprint 5 |
| Response Viewer | Inspect status, timing, headers, pretty/raw body, schema, compare | Sprint 5-6 |
| Saved Responses Browser | Browse response evidence by service, date, and flow | Sprint 6 |
| Flow Builder | Visual chained request workflow | Sprint 7 |
| Flow Mapping Panel | JSONPath extraction and target injection | Sprint 8 |
| Execution Console | Request and flow event stream with filtering/export | Sprint 5-8 |
| Settings / Preferences | Encryption, close behavior, redaction, defaults | Sprint 2-3 |
| Validation States | Invalid JSON, missing auth, invalid URL, missing variable, blocked flow | Sprint 4-8 |
| Save-On-Close Prompt | Save, Do Not Save, Cancel for dirty projects | Sprint 3 |

## OpenAPI / Swagger Import Workflow

### Steps

1. User chooses `Import API Docs`.
2. User enters an OpenAPI/Swagger URL or selects a local JSON/YAML file.
3. App fetches or reads the source.
4. App validates whether the document is OpenAPI 3.x or Swagger 2.0.
5. App parses servers, base paths, tags, operations, parameters, request bodies, response examples, and security schemes.
6. App presents a preview grouped by tag and method/path.
7. User selects all endpoints, selected tags, or selected operations.
8. User chooses naming strategy: operation id, tag plus operation, or method plus path.
9. App previews conflicts and unsupported features.
10. User confirms import.
11. App creates service definitions and import metadata.
12. App shows an import summary with created, skipped, and warning counts.

### Error States

| State | Required Behavior |
| --- | --- |
| Unreachable URL | Show source URL, network category, and retry action |
| Invalid JSON/YAML | Show parse location when available |
| Unsupported spec version | Explain supported versions |
| Missing servers/base URL | Allow import with project/environment base URL placeholder |
| Duplicate operation names | Apply deterministic suffix and show warning |
| Unsupported auth scheme | Import service and mark auth setup incomplete |
| User cancellation | Leave project unchanged |

## Test Strategy

### Test Categories

| Tag | Scope | Runs By Default |
| --- | --- | --- |
| `unit` | Pure request construction, schema validation, redaction, JSONPath, typed errors | Yes |
| `component` | Service editor, auth panel, inspector, response viewer, console, save prompt | Yes |
| `playwright` | Full UI workflows against local/stubbed services | Yes in CI |
| `live-rest` | Gated tests against a configured external REST target | No, explicit opt-in |
| `security` | Secret scanning, dependency audit, Tauri checks, redaction snapshots | Yes in release gate |
| `platform` | macOS, Windows, Linux packaging smoke checks | Release gate |

### Workflow Coverage

| Workflow | Unit | Component | Playwright | Live REST |
| --- | --- | --- | --- | --- |
| Create/open/save project | Yes | Yes | Yes | No |
| Import OpenAPI spec | Yes | Yes | Yes | Optional with fixture |
| Edit service request | Yes | Yes | Yes | No |
| Configure auth | Yes | Yes | Yes | Yes |
| Send single request | Yes | Yes | Yes | Yes |
| Save response | Yes | Yes | Yes | Yes |
| Run flow | Yes | Yes | Yes | Yes |
| Map variables | Yes | Yes | Yes | Yes |
| Role-gate errors | No | Yes | Yes with stubs | Yes |
| Redaction | Yes | Yes | Yes | Yes |

## Sprint 2 Acceptance Checklist

Sprint 2 was accepted against its original checklist. The Sprint Portfolio preserves the outcome and Git history retains the detailed checklist.
