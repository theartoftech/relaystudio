# Relay Studio Visual Target

## Selected Direction

The approved visual target is **Concept 3: Developer IDE Console** from the three generated design directions.

Sprint 0 is concluded and the approved reference screenshots define the target look and interaction model. Sprint 7A refines that direction to reduce clutter while preserving the desktop IDE feel. The current coded mockup at `mockups/index.html` remains a historical working reference; the Sprint Portfolio preserves the decision summary while Git history retains the original Sprint 0 record.

## Design Intent

Relay Studio should feel like a modern desktop developer tool, closer to an IDE or native API workbench than a web dashboard.

Use these structural patterns:

- Single project/request explorer with grouped service collections, flows, saved responses, and imported API docs.
- Tabbed editor workspace for open requests, flows, and saved response files.
- Split request editor with Authorization, Headers, Query, Path, Body, and Retry tabs.
- Optional right-side inspector for variables, auth preview, flow context, and project safety settings.
- Tabbed bottom utility dock for response viewer, terminal-style execution console, and problems.
- Command search / command palette affordance for power users.
- OpenAPI/Swagger import as a first-class onboarding and project-growth workflow.
- Desktop command surface for project, execution, response, environment, and settings actions.

## Visual Rules

- Keep the Dallas Cowboys-inspired palette: navy, royal blue, silver, white, and cool grays.
- Use navy for application chrome and primary navigation.
- Use royal blue for primary actions, selected tabs, and active states.
- Use silver/cool gray for split-pane dividers, table lines, and inactive surfaces.
- Use red only for specific, recoverable errors.
- Use compact desktop typography: 13-15px UI text, tight captions, and modest screen titles.
- Use a monospace font only for request bodies, variables, JSON, headers, and console output.
- Prefer split panes, row separators, docked panels, tabs, inspectors, and command bars over web-style cards.
- Preserve IDE-style density without showing every surface at once: project context, request editing, response evidence, console transparency, and contextual inspection must be one click away on desktop viewports.
- Do not use landing-page layouts, oversized hero typography, decorative gradients, or generic SaaS dashboard composition.

## Microcopy Direction

Primary actions:

- `Import API Docs`
- `Preview Services`
- `Send Request`
- `Run Flow`
- `Save Response`
- `Save Project`

Empty states:

- `Paste an OpenAPI URL or drop a Swagger file to preload services.`
- `No services yet. Import API docs or add your first request.`
- `No response yet. Send the request to inspect status, headers, timing, and body.`
- `No flow steps yet. Add a request step, then map values from prior responses.`

## Implementation Guardrails

- Treat the generated Concept 3 image and the coded `mockups/index.html` as the baseline during Sprint 2 UI scaffolding.
- Treat the Sprint 0 reference screenshots as the approved visual target for density and interaction feel, with Sprint 7A as the current shell anatomy baseline.
- Any later visual change should preserve the IDE-style structure unless explicitly redesigned.
- The app should read as a native desktop app on macOS, Windows, and Linux, even when implemented with web technology inside Tauri.
