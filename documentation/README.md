# Relay Studio Planning Package

This folder contains the first implementation slice for Relay Studio: reviewable design and testing artifacts before product code is scaffolded.

## Files

- [build-phase-plan.md](build-phase-plan.md): 2-week sprint breakdown from mockups through cross-platform beta, including OpenAPI/Swagger import.
- [detailed-sprint-plan.md](detailed-sprint-plan.md): review-ready sprint plan with objectives, deliverables, work items, acceptance criteria, dependencies, and quality gates.
- [sprint-0-decision-record.md](sprint-0-decision-record.md): concluded Sprint 0 decision record approving the provided reference screenshots as the product direction.
- [sprint-1-ux-blueprint.md](sprint-1-ux-blueprint.md): implemented Sprint 1 blueprint with shell anatomy, navigation, command placement, screen inventory, import flow, and test strategy.
- [product-terminology-glossary.md](product-terminology-glossary.md): stable product terms for UI, docs, code naming, and tests.
- [sample-test-project-definition.md](sample-test-project-definition.md): neutral sample acceptance project structure, services, environments, variables, and flows.
- [secret-redaction-policy.md](secret-redaction-policy.md): redaction rules and test expectations for credentials and secret-bearing data.
- [sprint-2-acceptance-checklist.md](sprint-2-acceptance-checklist.md): explicit exit checklist for the desktop foundation scaffold.
- [sprint-2-implementation-status.md](sprint-2-implementation-status.md): delivered Sprint 2 scaffold, verification results, QA evidence, and known deferred gaps.
- [sprint-3-implementation-status.md](sprint-3-implementation-status.md): delivered Sprint 3 project persistence, encryption, dirty-state, and verification results.
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
