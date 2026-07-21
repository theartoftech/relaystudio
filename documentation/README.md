# Relay Studio Documentation

Relay Studio uses a curated documentation library instead of preserving every historical sprint file. Word documents are authoritative for onboarding, architecture narrative, product handoff, UML guidance, sprint summaries, consolidated QA, and release operations. Markdown remains authoritative for build criteria, engineering policy, design constraints, and operative test procedures.

The library reflects completed Sprint 17 native multipart file workflows and completed Sprints 18A-18D review/remediation work, with Sprint 18E delivery hardening remaining. Relay Studio now keeps redirects on the reviewed origin, requires review before retrieving a Swagger UI secondary destination, bounds imported and compared documents, enforces response/project resource limits, evaluates flow branches by predecessor outcome, removes persisted multipart file authority, binds file approval to the current session and destination origin, rejects disguised response files, deeply validates project state, and applies canonical redaction across persistence and output boundaries.

## Word Library

- [Developer Onboarding and Debugging Guide](word/Relay-Studio-Developer-Onboarding-and-Debugging-Guide.docx)
- [Technical Architecture and Product Handoff](word/Relay-Studio-Technical-Architecture-and-Product-Handoff.docx)
- [UML Guide](word/Relay-Studio-UML-Guide.docx)
- [Sprint Portfolio](word/Relay-Studio-Sprint-Portfolio.docx)
- [Test and QA Manual](word/Relay-Studio-Test-and-QA-Manual.docx)
- [Security, Platform, and Release Manual](word/Relay-Studio-Security-Platform-and-Release-Manual.docx)

## Visio UML

- [Relay Studio UML Atlas](uml/visio/Relay-Studio-UML-Atlas.vsdx): editable 14-page Visio atlas.
- `uml/visio/*-diagram.vsdx`: fourteen individual editable Visio diagrams.
- `uml/previews/*.png`: reviewed previews embedded in the Word UML guide.

## Authoritative Markdown Directives

- [Detailed Sprint Plan](detailed-sprint-plan.md)
- [Build Phase Plan](build-phase-plan.md)
- [Product Terminology](product-terminology-glossary.md)
- [Secret Redaction Policy](secret-redaction-policy.md)
- [Tauri Security Checklist](tauri-security-checklist.md)
- [Platform Guidelines Backlog](platform-guidelines-compliance-backlog.md)
- [Live REST Acceptance Matrix](live-rest-acceptance-test-matrix.md)
- [Sample Test Project](sample-test-project-definition.md)
- [Visual Target](visual-target.md)
- [UX Blueprint](sprint-1-ux-blueprint.md)
- [Current Human Test Script](current-human-test-script.md)
- [Packaged Windows QA Script](sprint-10b-3-windows-qa-script.md)

## Sprint 18 Review Records

- [Sprint 18A Review Baseline and Finding Validation](reviews/sprint-18a/review-report.md)
- [Sprint 18A Remediation Register](reviews/sprint-18a/remediation-register.md)
- [Sprint 18B Network and Import Boundary Closure](reviews/sprint-18b/closure-report.md)
- [Sprint 18C Local File, Persistence, and Redaction Closure](reviews/sprint-18c/closure-report.md)
- [Sprint 18D Execution Integrity and Resource Bounds Closure](reviews/sprint-18d/closure-report.md)

## Governance

- `documentation-traceability.json` records every retained or consolidated historical Markdown source and its destination.
- Historical sprint-specific status and QA detail remains available through Git history.
- Update the retained Markdown directive first when build criteria, policy, design constraints, or operative procedures change; update the related Word explanation in the same change.
- Update Word directly for narrative or stakeholder documentation.
- Validate Word and Visio artifacts with `tools/validate_documentation_artifacts.py`.
- Render and inspect every Word page after a meaningful edit.
