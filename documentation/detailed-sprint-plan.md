# Relay Studio Detailed Sprint Plan

## Planning Assumptions

- Sprint length: 2 weeks.
- Delivery model: reviewable increments at the end of every sprint.
- Primary acceptance target: configurable external REST API with auth, role gates, read/write endpoints, and negative-path behavior. The target is a validation fixture, not product identity.
- Implementation stack: Tauri, React, TypeScript, Rust command layer, React Flow, Monaco or CodeMirror, Zod, JSONPath, Vitest, Testing Library, Playwright, Rust unit tests, dependency audit, and secret scanning.
- Product direction: desktop-first IDE-style REST client following the Concept 3 Developer IDE Console visual target.
- Sprint 0 status: concluded, with the provided reference screenshots approved as the primary visual and interaction target.
- Security posture: local-first project files, explicit secret redaction, no hosted database, and no committed credentials.

## Release Milestones

| Milestone | Sprints | Outcome |
| --- | --- | --- |
| UX Approval | 0-1 | Reviewable UX package, terminology, acceptance matrix, and implementation-ready backlog |
| App Foundation | 2-4A | Cross-platform shell, local project format, service designer, and OpenAPI import |
| Execution Core | 5-8B | Single request runner, saved responses, visual flows, UX consolidation, variables, mapping, flow UX hardening, and desktop density polish |
| Platform Compliance | 9A-10B | Shared, macOS, and Windows shell work to meet platform design guidance, simplify command surfaces, and add platform-specific verification |
| Enterprise Readiness | 11-13 | Role/error coverage, hardening, coverage gates, security checks, and live REST validation |
| Beta Packaging | 14 | Installable macOS, Windows, and Linux beta builds |

## Sprint 0: UX Intent And Mockup Review

### Status

Concluded and approved. The Sprint 0 reference screenshots represent the target direction for the product.

### Objective

Create the review package that aligns stakeholders on what Relay Studio is before product code begins.

### Deliverables

- Static full-app mockup set in `documentation/mockups`.
- Selected visual target in `documentation/visual-target.md`.
- Live REST acceptance test matrix in `documentation/live-rest-acceptance-test-matrix.md`.
- Initial build phase plan in `documentation/build-phase-plan.md`.
- Sprint 0 decision record in `documentation/sprint-0-decision-record.md`.
- Review notes captured as backlog changes before Sprint 2 starts.

### Work Items

- Review project start, import, workbench, service editor, auth, request runner, response viewer, saved response, flow builder, variable mapping, console, settings, validation, and save-on-close screens.
- Confirm Concept 3 Developer IDE Console as the implementation target.
- Capture the approved screenshots as implementation references for shell anatomy, pane density, command placement, and desktop-native polish.
- Confirm that OpenAPI/Swagger import is a first-class workflow.
- Confirm that the live REST acceptance target is configurable and not product-defining.
- Identify any missing screens or state transitions.

### Acceptance Criteria

- A reviewer can explain the core workflow without external documentation.
- The visual direction reads as a desktop IDE-style workbench.
- Every major workflow has at least one visible screen state.
- Error, empty, loading, dirty-state, and save-state behavior are represented.
- No implementation sprint starts until UX review changes are resolved or explicitly deferred.
- Sprint 0 approval is recorded before Sprint 1 blueprint work begins.

## Sprint 1: UX Blueprint And Test Strategy

### Status

Implemented as planning artifacts:

- `sprint-1-ux-blueprint.md`
- `product-terminology-glossary.md`
- `sample-test-project-definition.md`
- `secret-redaction-policy.md`
- `sprint-2-acceptance-checklist.md`

### Objective

Convert the UX package into an implementation-ready blueprint and test strategy.

### Deliverables

- Final screen hierarchy and navigation model.
- Screenshot-derived shell anatomy and command-placement map.
- Product terminology glossary.
- Implementation backlog with feature boundaries.
- Sample test project definition.
- Secret redaction policy.
- Live acceptance pass/fail rules.
- Sprint 2 screenshot-matching acceptance checklist.

### Work Items

- Define primary areas: Services, Runner, Flows, Saved Responses, Settings, command palette, explorer, inspector, response dock, and console.
- Convert the approved screenshots into a canonical shell anatomy for macOS, Windows, and Linux.
- Decide whether the ribbon command surface is a Windows-specific option, an optional layout mode, or a deferred enhancement.
- Document app terminology for project, service, request, flow, step, variable, environment, saved response, and import source.
- Define OpenAPI import stages: source entry, fetch or file read, parse, preview, selection, generation, and import summary.
- Translate the live REST acceptance matrix into service definitions and flow scenarios.
- Define test tags for fast unit tests, component tests, Playwright tests, and gated live REST tests.
- Define redaction expectations for console logs, response metadata, project files, diagnostics bundles, and exported artifacts.

### Acceptance Criteria

- Each live REST acceptance scenario has a planned service or flow.
- Each planned workflow has at least one automated test category assigned.
- Secret handling rules are clear enough to implement without interpretation.
- Product terminology is stable for UI implementation.
- Sprint 2 has an explicit screenshot-matching acceptance checklist for shell layout, command surface, inspector, response dock, and console.

## Sprint 2: Desktop Foundation

### Status

Implemented. See `sprint-2-implementation-status.md`.

### Objective

Establish the cross-platform app shell, development workflow, and automated quality gates.

### Deliverables

- Tauri desktop app scaffold.
- React and TypeScript frontend shell.
- Rust command layer skeleton.
- Route and pane layout matching the IDE console target.
- Test harnesses and CI quality gates.

### Work Items

- Scaffold the Tauri app with macOS local launch support.
- Add the initial activity bar, explorer pane, tabbed workbench, inspector pane, response dock, and console dock. Sprint 7A later consolidates this into the current simplified shell.
- Add app menu structure for New, Open, Save, Save As, Import API Docs, Settings, and Close.
- Add theme tokens for navy, royal blue, silver, white, cool gray, and error red.
- Add window close interception hooks for future dirty-state prompts.
- Add Vitest, Testing Library, Playwright, Rust unit test setup, linting, type checking, and coverage reporting.
- Add baseline accessibility smoke tests for keyboard navigation through the shell.

### Acceptance Criteria

- The app launches locally on macOS.
- Every primary route renders an empty state.
- CI runs type check, lint, unit tests, component test smoke checks, and coverage reporting.
- Keyboard users can reach the primary shell areas.
- The shell visually matches the Concept 3 layout structure.

## Sprint 3: Project Files And Encryption

### Status

Implemented. See `sprint-3-implementation-status.md`.

### Objective

Give users reliable local project persistence and safe close behavior.

### Deliverables

- Create, open, save, and save-as project workflows.
- Recent projects list.
- Versioned `.restproj` schema.
- Encrypted secret storage.
- Dirty-state tracking and save-on-close prompt.

### Work Items

- Define project schema for services, environments, variables, auth profiles, flows, saved response metadata, import sources, and settings.
- Implement Rust file IO commands for create, open, save, save as, and recent projects.
- Save project files without password prompts.
- Keep secret values redacted in the workspace, console, and saved response artifacts.
- Track dirty state across edits, imports, response saves, and flow changes.
- Add Save, Do Not Save, and Cancel close prompt.
- Add backup or temp-write behavior to avoid corrupting project files on failed saves.

### Acceptance Criteria

- Project data round trips without loss.
- Secret fields remain redacted in the workspace, console, and saved response artifacts.
- Corrupted file, missing file, permission denied, and unsupported schema errors show recoverable messages.
- Save As handles overwrite confirmation.
- Closing with unsaved changes prompts correctly.

## Sprint 4: REST Service Designer

### Status

Implemented. See `sprint-4-implementation-status.md`.

### Objective

Allow users to define reusable REST calls with validation, auth, variables, and request construction.

### Deliverables

- Service collection explorer.
- Service detail editor.
- Request tabs for Authorization, Headers, Query, Path, Body, and Retry.
- Environment variable support.
- Auth modes for none, bearer token, API key, basic auth, OAuth client credentials, and custom header.
- OpenAPI import placeholder entry point.

### Work Items

- Implement service list create, duplicate, rename, delete, and reorder.
- Implement method, URL, timeout, retry policy, headers, query params, path params, and request body editors.
- Add auth preview that separates generated auth from user-defined headers.
- Implement variable references with validation markers.
- Add JSON body validation and formatting.
- Add request construction unit tests for every method and parameter type.
- Add redaction tests for auth values and secret variables.

### Acceptance Criteria

- Users can define a valid login request and authenticated follow-up request.
- Invalid URL, duplicate headers, malformed JSON, missing auth, and unsupported method states are blocked or clearly flagged.
- Generated request previews never expose secret values.
- Request construction behavior is covered by unit tests.

## Sprint 4A: OpenAPI / Swagger Import

### Objective

Preload REST service definitions from published API documentation.

### Deliverables

- Import wizard for OpenAPI 3.x and Swagger 2.0.
- URL and local JSON/YAML file import.
- Discovered endpoint preview.
- Endpoint, tag, and operation selection.
- Generated Relay Studio service definitions.

### Work Items

- Fetch remote specs and read local spec files.
- Parse JSON and YAML documents.
- Extract base URLs, paths, methods, parameters, request bodies, auth schemes, tags, descriptions, and examples.
- Handle multiple servers and missing server definitions.
- Generate service names from operation id, method/path, or tag grouping.
- Preview conflicts, duplicates, unsupported auth, and unsupported content types.
- Ensure import cancellation leaves the current project unchanged.

### Acceptance Criteria

- Valid OpenAPI 3 JSON/YAML and Swagger 2 JSON/YAML specs import.
- Invalid spec and unreachable URL errors are actionable.
- Bearer, basic, API key, and OAuth security schemes map into auth configuration.
- Duplicate operation names are resolved predictably.
- Import summary shows created, skipped, and warning counts.

## Sprint 5: Single Request Runner

### Status

Implemented. See `sprint-5-implementation-status.md`.

### Objective

Execute individual REST calls and display trustworthy diagnostics.

### Deliverables

- Send Request execution path.
- Response status, timing, headers, pretty JSON, raw body, and error panels.
- Terminal-style execution console.
- Initial live REST single-request suite.

### Work Items

- Implement Rust HTTP execution command with cancellation-ready request lifecycle.
- Resolve variables before sending.
- Inject auth according to selected auth mode.
- Emit console events for variable resolution, connection open, request sent, response received, parse response, success, and error.
- Render response headers, status, timing, formatted JSON, raw body, and parse errors.
- Add sample service definitions for health, login, current user, list records, get record, search records, and create/update record.

### Acceptance Criteria

- `GET /api/health` succeeds without auth.
- `POST /api/auth/login` captures a bearer token without leaking it.
- Authenticated REST requests succeed with a supplied token.
- Failed login, missing bearer token, 401, 403, timeout, malformed JSON, and network errors display clearly.
- Console event ordering is deterministic and covered by tests.

## Sprint 6: Saved Responses

### Status

Implemented. See `sprint-6-implementation-status.md`.

### Objective

Persist response evidence for later inspection and review.

### Deliverables

- Save response as JSON or raw body file.
- Saved response metadata in the project.
- Saved response browser.
- Reload saved response into the response viewer.

### Work Items

- Add Save Response workflow from response dock.
- Persist method, URL, status, timing, captured date, content type, response file path, and redaction metadata.
- Add overwrite confirmation.
- Add warning state for non-JSON responses.
- Add large response handling and basic performance guardrails.
- Add saved response explorer grouping by service or flow.

### Acceptance Criteria

- JSON responses save and reopen correctly.
- Non-JSON responses can be saved with a clear warning.
- Invalid path, read-only destination, and overwrite cases are handled.
- Saved response metadata survives project reopen.
- Saved response files never include project credentials.

## Sprint 7: Visual Flow Builder

### Status

Implemented. See `sprint-7-implementation-status.md`.

### Objective

Model chained REST workflows visually.

### Deliverables

- React Flow canvas.
- REST call nodes.
- Dependency links.
- Success and failure paths.
- Step ordering.
- Flow-level console stream.

### Work Items

- Add flow explorer and flow editor tabs.
- Implement add, delete, connect, and reorder for REST call nodes.
- Display node status for idle, running, success, failed, skipped, and blocked.
- Define success and failure edges.
- Implement topological ordering for step execution.
- Add flow console grouping by flow and step.
- Seed a sample authenticated read flow definition.

### Acceptance Criteria

- Login, current user, list records, and get record can be represented as a flow.
- Missing dependencies block execution before send.
- Success and failure paths are visible.
- Console output groups events by flow and step.
- Flow editor state persists in the project file.

## Sprint 7A: UX Consolidation

### Status

Implemented. See `sprint-7a-implementation-status.md`.

### Objective

Reduce visible workbench clutter and align the shell with common macOS and Windows desktop guidance.

### Deliverables

- Single primary project explorer.
- Compact contextual toolbar.
- Collapsed-by-default inspector.
- Unified response, console, and problems utility dock.
- Resizable explorer, editor, inspector, utility dock, and flow detail panes.
- Updated automated and manual UX regression coverage.

### Work Items

- Remove the permanent activity rail and duplicate navigation choices.
- Move global actions into the command palette or project/sidebar controls.
- Keep the visible toolbar focused on search, environment, save, send/run, and inspector visibility.
- Make inspector visibility explicit and reversible.
- Replace side-by-side response and console panes with a tabbed bottom utility dock.
- Add accessible drag and keyboard resizing for major workspace dividers.
- Fix controlled flow-node dragging so selected nodes stay attached to the pointer while moving.
- Update smoke tests to assert the simplified shell anatomy.

### Acceptance Criteria

- The first screen has one primary navigation surface.
- Search text is not clipped.
- Global commands remain reachable through `Cmd+K`.
- Request tabs show `Send Request`; flow tabs show `Run Flow`.
- Inspector opens on demand and is hidden by default.
- Response, console, and problems remain one click away in the bottom dock.
- Explorer, inspector, bottom utility dock, and flow details can be resized.
- Flow nodes track the pointer during drag and persist their dropped position.
- Coverage remains above 90%.

## Sprint 8: Flow Variables And Mapping

### Status

Implemented. See `sprint-8-implementation-status.md`.

### Objective

Pass values from one REST response into later REST calls.

### Deliverables

- JSONPath extraction.
- Variables panel.
- Header, query, path, and body injection.
- Mapping validation.
- Sample create/update/read/cleanup flow.

### Work Items

- Add mapping editor for source step, JSONPath, variable name, secret flag, and target fields.
- Implement JSONPath evaluation for response bodies.
- Inject variables into headers, query params, path params, and body templates.
- Add preflight validation for missing variables and malformed JSONPath expressions.
- Add cleanup policy for flows that create remote data.
- Build sample record lifecycle flow: login, create record, extract record id, update record, reopen record, cleanup delete.

### Acceptance Criteria

- `$.token`, `$.accessToken`, and `$.id` style mappings work.
- Missing JSONPath results identify the source step and expression.
- Failed upstream nodes block dependent nodes.
- Secret variables are redacted in console, project files, diagnostics, and saved metadata.
- Cleanup deletion runs when configured.

## Sprint 8A: Flow UX Hardening

### Status

Implemented. See `sprint-8a-implementation-status.md`.

### Objective

Make flows the product's clearest differentiator by turning the basic flow variables and mapping functionality into a simple, confidence-building user experience.

### Deliverables

- Simplified step mapping workflow.
- Clear captured-variable display per step.
- Flow run diagnostics that identify the exact failed step, dependency, and mapping.
- Safer cleanup-step affordances.
- Flow templates for common REST workflows.
- Human test script focused on first-time flow usability.

### Work Items

- Audit the flow builder for duplicated information and remove low-value summaries from the work surface.
- Make token capture from login steps easy to configure and easy to verify without exposing secrets.
- Add clear visual treatment for captured values, required inputs, skipped steps, failed mappings, and cleanup steps.
- Improve empty states and first-run guidance for creating a flow from existing requests.
- Add flow templates such as Login -> Authenticated Read and Login -> Create -> Read -> Cleanup.
- Make mapping errors actionable with source step, JSONPath, variable name, and downstream impact.
- Add component and e2e coverage for the primary flow authoring path.

### Acceptance Criteria

- A first-time user can create or understand a simple authenticated flow without documentation.
- A user can tell which step produced a variable and which later step consumes it.
- Failed mappings identify the exact source step and expression.
- Cleanup steps are visibly distinct and do not look like ordinary read steps.
- Flow screens avoid repeating information already visible in the same work area unless it materially improves confidence or error prevention.
- Coverage remains above 90%.

## Sprint 8B: Desktop Density Pass

### Status

Implemented. See `sprint-8b-implementation-status.md`.

### Objective

Increase usable work area by tightening Relay Studio's desktop UI density while preserving readability, accessibility, and the current flow/request workflows.

### Deliverables

- Native-first font stack for macOS, Windows, and Linux.
- Compact design tokens for font size, control height, tab height, tree row height, and panel padding.
- Denser explorer, request composer, request detail form, flow toolbar, inspector, and response dock.
- Updated default pane widths and bottom dock height.
- Regression tests that prove the denser shell still renders without clipping, overlap, or inaccessible controls.

### Work Items

- Replace the global font stack with a native-first stack: `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `Segoe UI`, `system-ui`, and `sans-serif`.
- Replace code/editor fonts with a native monospace stack: `ui-monospace`, `SF Mono`, `Cascadia Mono`, `Consolas`, and `monospace`.
- Add density tokens in `src/styles.css` for base UI text, label text, code text, control height, compact control height, tab height, and tree row height.
- Reduce top command bar height, tab strip height, request composer vertical padding, form input heights, flow toolbar height, and bottom dock default height.
- Reduce default explorer and inspector widths while keeping resize handles and minimum usable widths.
- Tighten flow node card padding and badge styling without making the canvas harder to scan.
- Keep code and JSON viewers readable; reduce chrome and padding before reducing code text below 12px.
- Update screenshot/e2e tests for common desktop sizes including 1180x820 and 1440x900.

### Acceptance Criteria

- More horizontal and vertical work area is available for the request editor and flow canvas at 1440x900.
- Explorer, inspector, response dock, and flow detail panels use less space without clipped labels or overlapping controls.
- Request method, URL, protocol, and send/run actions remain readable and keyboard reachable.
- Flow toolbar actions fit with less horizontal pressure.
- JSON and response bodies remain readable.
- The app continues to feel like a native desktop workbench, not a zoomed-out web dashboard.
- Coverage remains above 90%.

## Sprint 9A: Platform Shell Contract

### Objective

Define the shared shell contract and platform override boundaries before more shell polish lands.

### Deliverables

- Shared shell command contract.
- Platform-adapter boundary for shell chrome.
- Native macOS menu structure definition.
- Windows title bar and command model definition.

### Work Items

- Define shared command IDs, labels, shortcuts, enablement rules, and intended command surfaces.
- Route Save, Save As, Close Tab, Close Window, and project-switch behavior through one dirty-state policy.
- Separate shared workbench content from platform-specific menu and title bar behavior.
- Add macOS `File`, `Edit`, `View`, `Window`, and `Help` menu structure with document actions moved out of the app menu.
- Define Windows title bar drag regions, interactive regions, and command ownership rules.

### Acceptance Criteria

- A single documented source of truth exists for shell commands, shortcuts, and view toggles.
- Request tabs, flow tabs, welcome, and settings each define visible and enabled primary actions.
- macOS document actions are menu-backed rather than app-menu-only.
- Windows title bar ownership, drag regions, and caption-control constraints are explicitly defined.

## Sprint 9B: Platform Navigation And Command Surfaces

### Objective

Simplify navigation and command placement so the workbench feels native and preserves the main editing area.

### Deliverables

- Simplified explorer information architecture.
- State-aware toolbar behavior.
- Reduced inspector/details duplication.
- Platform-specific command-surface adjustments for macOS and Windows.

### Work Items

- Limit explorer content to project structure and related navigation.
- Move Recent Projects out of the primary project tree and move transient status out of navigation.
- Make toolbar actions request-specific, flow-specific, or hidden when not applicable.
- Reduce duplicate summaries between inspector and flow details.
- Align macOS sidebar behavior with document-app expectations.
- Align Windows command surfaces with commanding guidance for primary, secondary, and destructive actions.

### Acceptance Criteria

- Explorer no longer mixes project structure, transient status, and recent-project switching in one surface.
- Flow and request tabs show only relevant primary actions.
- Inspector content changes meaningfully by editor type instead of duplicating visible context.
- Frequent commands live on the correct primary surface; secondary commands move to menus, context menus, or overflow surfaces.

## Sprint 10A: Platform Chrome, Layout, And Writing

### Objective

Make the shell behave like a first-class desktop app on macOS and Windows, with production-quality text and platform chrome.

### Deliverables

- Production-quality settings and error copy.
- Dialog behavior standards.
- Cross-platform context menu standards.
- macOS menu-backed workspace toggles.
- Windows title bar, breakpoint, and appearance support.

### Work Items

- Remove placeholder Settings copy and replace weak desktop text with concise, action-first language.
- Standardize dialog button ordering, focus trap behavior, Escape handling, and focus return.
- Finish app-defined context menus across requests, flows, tabs, mappings, recent projects, and flow edges.
- Add macOS `View` toggles for sidebar, inspector, response dock, and flow details.
- Implement Windows title bar behavior, breakpoint-safe layout behavior, and light/dark/high-contrast support.

### Acceptance Criteria

- Placeholder Settings text is gone.
- Error messages are concise, helpful, and non-blaming.
- Dialog focus, Escape behavior, and action ordering are defined and tested.
- Windows shell behavior is valid at small, medium, and large breakpoint classes.
- High contrast and active/inactive title bar states are visually distinguishable on Windows.

## Sprint 10B: Platform Verification And Audit Closure

### Objective

Make platform-guideline work enforceable with repeatable tests, QA scripts, and bounded audits.

### Deliverables

- Automated platform-shell regression coverage.
- macOS shell QA script.
- Windows shell QA script.
- Windows installer build handoff script for generating test artifacts on a Windows machine.
- Refreshed macOS audit evidence.
- Bounded Windows desktop audit.

### Work Items

- Add regression coverage for dialog keyboard behavior, view-toggle state, dirty-state flows, and main context menus.
- Write macOS QA coverage for menus, settings, save prompts, and view toggles.
- Write Windows QA coverage for title bar, caption controls, breakpoints, contrast, and keyboard behavior.
- Add and run `tools/windows-build-installer.ps1` after pulling the 10B-3 branch on Windows; it must complete `npm ci`, `npm run verify`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `npm run tauri build` before manual QA begins.
- Re-run the macOS HIG audit against the updated desktop app.
- Perform a bounded Windows desktop audit against the updated shell.

### Acceptance Criteria

- Platform-shell regressions are covered where the current harness can support them.
- macOS and Windows shell QA scripts exist and are runnable.
- A Windows tester can pull the branch and run one documented PowerShell script to produce installable Relay Studio artifacts.
- June 30, 2026 macOS high-priority findings are either closed or explicitly deferred with rationale.
- Windows high-priority findings are either closed or converted into tracked backlog items.

### Implementation Status

- 10B-1 platform regression coverage is complete.
- 10B-2 macOS QA and refreshed audit are complete.
- 10B-3 Windows build handoff, human QA script, bounded audit, and evidence index are implemented.
- Final 10B-3 closure requires the packaged-Windows test record and durable breakpoint/high-contrast evidence identified in `audits/windows-2026-07-10/relay-studio-windows-desktop-audit.md`.

## Sprint 11: Role And Error Coverage

### Objective

Prove enterprise security behavior and negative-path diagnostics against real role gates in a configured external REST target.

### Deliverables

- Live REST role-gate acceptance suite.
- Error coverage suite.
- Redaction regression suite.
- Controlled stub for 5xx-style response display.

### Work Items

- Add admin, standard, and restricted credential configuration through local-only test config.
- Verify standard user read and admin denial behavior.
- Verify restricted user read and protected write denial behavior.
- Verify admin user read, write, audit, and settings access.
- Add negative tests for 400, 401, 403, 404, timeout, TLS failure, network failure, invalid JSON body, invalid JSONPath, and missing variable.
- Add redaction assertions for console, saved project state, response metadata, and diagnostics.

### Acceptance Criteria

- Role-gate expectations match the live REST acceptance matrix.
- Error states preserve request context without leaking secrets.
- Live REST tests are gated and never require committed passwords.
- Redaction tests fail on any token, password, API key, client secret, or authorization header leak.

## Sprint 12: Enterprise Hardening

### Objective

Raise reliability, recoverability, and operational diagnostics to enterprise expectations.

### Deliverables

- Typed error model.
- Project recovery backup.
- Import/export validation.
- Structured diagnostics bundle.
- Long-running request cancellation.
- Redaction audit.

### Work Items

- Normalize app errors into typed categories for validation, auth, network, HTTP, filesystem, schema, import, and flow execution.
- Add recovery backup creation before risky project writes.
- Validate project import and export schema.
- Add diagnostics bundle export with redacted logs, app version, platform, project schema version, and recent console events.
- Implement cancellation for individual requests and running flows.
- Add retry behavior tests.
- Add redaction snapshot tests across representative app states.

### Acceptance Criteria

- Interrupted saves do not corrupt the last valid project.
- Cancelled requests and flows stop cleanly and explain what was cancelled.
- Invalid project schemas show recovery guidance.
- Diagnostics bundles are useful and redacted by default.
- Concurrent save attempts are guarded.

## Sprint 13: Coverage And Security Gate

### Objective

Make quality and security gates release-blocking.

### Deliverables

- Enforced 90% coverage threshold.
- Full CI pipeline.
- Dependency audits.
- Static analysis.
- Secret scanning.
- Tauri security checklist.
- Passing live REST acceptance suite.

### Work Items

- Enforce coverage thresholds for TypeScript and Rust where applicable.
- Run type checking, linting, unit tests, component tests, Playwright tests, and Rust tests in CI.
- Add dependency audit and license review.
- Add secret scanning for repository and generated artifacts.
- Review Tauri allowlist, filesystem access, command exposure, CSP, updater settings, and window permissions.
- Run full configured live REST acceptance suite.
- Produce release candidate readiness report.

### Acceptance Criteria

- CI fails below 90% coverage.
- CI fails on high-risk security findings.
- Live REST acceptance passes.
- No unhandled exceptions occur in normal or negative-path tests.
- Release candidate readiness report lists known risks and approved deferrals.

## Sprint 14: Cross-Platform Packaging And Beta

### Objective

Produce installable beta builds for macOS, Windows, and Linux.

### Deliverables

- macOS package.
- Windows package.
- Linux package.
- Platform validation report.
- Beta release notes.

### Work Items

- Configure Tauri packaging for macOS, Windows, and Linux.
- Validate app launch, file dialogs, project open/save, response saving, and close prompts on each platform.
- Run single request and flow smoke tests on each platform.
- Verify platform-specific filesystem paths and permission failures.
- Confirm code signing, notarization, or signing deferrals as appropriate.
- Draft beta release notes with known limitations.

### Acceptance Criteria

- Installers are produced for all three platforms.
- Each platform can create, save, close, reopen, and run a project.
- Single request runner and flow runner work on each platform.
- Saved response behavior is consistent across platforms.
- Beta release notes are ready for stakeholder review.

## Cross-Sprint Backlog

| Area | Backlog Item | Target Sprint |
| --- | --- | --- |
| UX | Command palette commands for common actions | 2-5 |
| UX | Keyboard shortcuts for send, save, command search, and tab navigation | 2-5 |
| UX | Empty, loading, error, and dirty-state visual pass | 2-6 |
| Persistence | Project schema migration framework | 3 |
| Persistence | Recent projects pruning and missing-file handling | 3 |
| Security | Central redaction utility shared by console, diagnostics, and persistence | 3-5 |
| Services | Curl-style request preview | 4-5 |
| Services | Request body examples from OpenAPI import | 4A |
| Runner | Request cancellation surfaced in console | 5, 10 |
| Responses | Diff two saved responses | Post-beta candidate |
| Flows | Flow run summary with pass/fail counts | 7-8 |
| Flows | Configurable cleanup policy | 8 |
| Testing | Stub service for deterministic network and 5xx cases | 5-9 |
| Packaging | Signing/notarization plan | 11-12 |

## Definition Of Done

- Feature is implemented in the app and reachable through the UI.
- Feature follows the Concept 3 IDE-style visual structure.
- Unit and/or component tests cover expected behavior and important failure paths.
- Playwright coverage exists for user-facing workflows with meaningful interaction.
- Errors are typed, actionable, and do not expose secrets.
- Project persistence is covered when feature state is saved.
- Documentation or planning artifacts are updated when behavior, scope, or acceptance changes.
- No committed credentials, tokens, generated secrets, or local-only test data.

## Review Checklist

- Does the sprint sequence produce usable increments, or should any dependency move earlier?
- Are OpenAPI import and manual service editing balanced correctly?
- Are live REST acceptance tests broad enough to prove real-world value?
- Are role-gate and negative-path tests represented early enough?
- Is 90% coverage realistic for the beta scope?
- Are platform packaging, signing, and filesystem risks planned early enough?
- Which post-beta ideas should be explicitly deferred to protect the first release?
