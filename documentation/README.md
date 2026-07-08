# Relay Studio Planning Package

This folder contains the first implementation slice for Relay Studio: reviewable design and testing artifacts before product code is scaffolded.

## Files

- [build-phase-plan.md](build-phase-plan.md): 2-week sprint breakdown from mockups through cross-platform beta, including OpenAPI/Swagger import and Sprint 8B desktop density polish.
- [current-human-test-script.md](current-human-test-script.md): consolidated human QA script for the current uncommitted app state.
- [detailed-sprint-plan.md](detailed-sprint-plan.md): review-ready sprint plan with objectives, deliverables, work items, acceptance criteria, dependencies, and quality gates.
- [live-rest-local-config.example.json](live-rest-local-config.example.json): example local-only config for the gated live REST acceptance suite.
- [platform-guidelines-compliance-backlog.md](platform-guidelines-compliance-backlog.md): concrete shared, macOS, and Windows backlog for meeting platform design guidelines with phased acceptance criteria.
- [sprint-0-decision-record.md](sprint-0-decision-record.md): concluded Sprint 0 decision record approving the provided reference screenshots as the product direction.
- [sprint-1-ux-blueprint.md](sprint-1-ux-blueprint.md): implemented Sprint 1 blueprint with shell anatomy, navigation, command placement, screen inventory, import flow, and test strategy.
- [product-terminology-glossary.md](product-terminology-glossary.md): stable product terms for UI, docs, code naming, and tests.
- [sample-test-project-definition.md](sample-test-project-definition.md): neutral sample acceptance project structure, services, environments, variables, and flows.
- [secret-redaction-policy.md](secret-redaction-policy.md): redaction rules and test expectations for credentials and secret-bearing data.
- [sprint-2-acceptance-checklist.md](sprint-2-acceptance-checklist.md): explicit exit checklist for the desktop foundation scaffold.
- [sprint-2-implementation-status.md](sprint-2-implementation-status.md): delivered Sprint 2 scaffold, verification results, QA evidence, and known deferred gaps.
- [sprint-3-implementation-status.md](sprint-3-implementation-status.md): delivered Sprint 3 project persistence, dirty-state, and verification results.
- [sprint-4-implementation-status.md](sprint-4-implementation-status.md): delivered Sprint 4 REST service designer, request validation, and 90% coverage gate.
- [sprint-5-implementation-status.md](sprint-5-implementation-status.md): delivered Sprint 5 single request runner, native HTTP execution, response dock, console diagnostics, and verification results.
- [sprint-6-implementation-status.md](sprint-6-implementation-status.md): delivered Sprint 6 saved responses, redacted response artifacts, native/browser file persistence, reload workflow, and coverage results.
- [sprint-7-implementation-status.md](sprint-7-implementation-status.md): delivered Sprint 7 visual flow builder, React Flow canvas, flow ordering, dependency validation, branch paths, console grouping, and coverage results.
- [sprint-7a-implementation-status.md](sprint-7a-implementation-status.md): delivered Sprint 7A UX consolidation, including simplified navigation, contextual toolbar, optional inspector, and tabbed utility dock.
- [sprint-8-implementation-status.md](sprint-8-implementation-status.md): delivered Sprint 8 flow variables, JSONPath response mappings, runtime injection, and lifecycle flow coverage.
- [sprint-8a-implementation-status.md](sprint-8a-implementation-status.md): delivered Sprint 8A flow UX hardening, templates, variable capture/consumption display, and cleanup-step affordances.
- [sprint-8a-user-test-script.md](sprint-8a-user-test-script.md): human QA script for first-time flow authoring and debugging.
- [sprint-8b-implementation-status.md](sprint-8b-implementation-status.md): delivered Sprint 8B desktop density pass, compact shell sizing, native fonts, and density regression coverage.
- [sprint-9a-implementation-status.md](sprint-9a-implementation-status.md): delivered Sprint 9A platform shell contract, shared command model, native menu wiring, and shell verification evidence.
- [sprint-9b-implementation-status.md](sprint-9b-implementation-status.md): delivered Sprint 9B platform navigation and command surfaces, including simplified Explorer ownership, command-surface Recent Projects, status bar messaging, contextual inspector content, and verification evidence.
- [sprint-10b-1-user-test-script.md](sprint-10b-1-user-test-script.md): human QA script for Sprint 10B-1 platform regression coverage, including command palette focus, native view toggles, dirty close flows, and context-menu dismissal.
- [sprint-10b-2-macos-qa-script.md](sprint-10b-2-macos-qa-script.md): human QA script for Sprint 10B-2 macOS menu, Settings, dirty close, command parity, and audit evidence validation.
- [visual-target.md](visual-target.md): selected Concept 3 visual direction and implementation guardrails.
- [live-rest-acceptance-test-matrix.md](live-rest-acceptance-test-matrix.md): configurable live REST acceptance suite.
- [mockups/index.html](mockups/index.html): static full-app mockup set.
- [mockups/mockups.css](mockups/mockups.css): Cowboys-inspired visual styling for the mockups.

## Review Order

1. Open the static mockups and review screen intent.
2. Review the Sprint 0 decision record and selected visual target so implementation stays aligned to the approved screenshots and Concept 3.
3. Review the Sprint 1 UX blueprint, terminology glossary, redaction policy, and sample test project definition.
4. Review the detailed sprint plan for scope, sequencing, dependencies, and release gates.
5. Review the live REST acceptance matrix for endpoint and role coverage.
6. Use the Sprint 2 acceptance checklist before scaffolding the desktop app.
