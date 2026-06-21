# Sprint 0 Decision Record

## Status

Sprint 0 is concluded and approved.

## Decision

The approved direction for Relay Studio is a desktop IDE-style REST client matching the provided Sprint 0 reference screenshots. These screenshots are now treated as the primary visual and interaction reference for Sprint 1 blueprint work and Sprint 2 implementation scaffolding.

## Approved Visual Characteristics

- Desktop-native workbench feel, not a web dashboard or marketing-style app.
- Navy application chrome with royal blue active states and cool gray/silver pane structure.
- Dense information layout with multiple productive panes visible at once.
- Left project explorer with grouped services, flows, environments, variables, vault, and saved responses.
- Tabbed editor surface for welcome screens, requests, saved responses, and flows.
- Request composer with method selector, URL input, protocol/options controls, and clear Send Request action.
- Request editor tabs for Authorization, Headers, Query Params, Path Params, Body, Retry, Tests, Settings, and script-related surfaces.
- Right inspector or properties panel for authorization, variables, request metadata, environment state, and flow context.
- Docked response viewer with status, timing, payload size, saved response controls, pretty/raw/preview/schema views, and comparison support where appropriate.
- Docked execution console or timeline showing ordered request events, timestamps, errors, and exportable logs.
- Explicit environment selector in the top chrome or ribbon.
- Visible secret redaction in generated headers, response views, console output, and saved/exported artifacts.

## Reference Screenshot Notes

### Reference 1: Full IDE Workbench

- Strongest reference for the complete pane model.
- Shows activity rail, explorer, tab strip, request editor, inspector, response compare, and console in a single dense workbench.
- Keep this as the default target for the core desktop layout.

### Reference 2: Windows Ribbon Variant

- Useful reference for Windows-native command grouping.
- Shows how file/project, execute, response, environment, and settings commands can be exposed in a broad desktop ribbon.
- Treat as an optional platform or mode reference, not the required baseline for every platform.

### Reference 3: Focused macOS Workbench

- Strong reference for a calmer macOS-native layout.
- Shows a left project sidebar, central request editor, right authorization inspector, lower response panel, and console timeline.
- Treat as the density and spacing reference for the main implementation when a ribbon is not present.

## Sprint 1 Implications

- Create a screen inventory from these references before implementation begins.
- Define the canonical shell anatomy: activity/sidebar, project explorer, tab strip, editor, inspector, response dock, and console.
- Decide whether the Windows ribbon is a platform-specific shell option or a future enhancement.
- Define exact command placement for New Project, Import API Docs, Open Project, Save Project, Send Request, Run Flow, Stop, Save Response, Export Response, History, Environment, Manage Environments, and Settings.
- Convert visible reference states into acceptance criteria for Sprint 2 UI scaffolding.

## Sprint 2 Implementation Guardrail

The first scaffolded app should immediately read as Relay Studio from these screenshots: project explorer on the left, request editor in the center, inspector on the right, response and console docks below, and a desktop-native command surface above.
