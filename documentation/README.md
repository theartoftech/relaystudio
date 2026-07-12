# Relay Studio Documentation

Relay Studio uses a curated documentation library instead of preserving every historical sprint file. Word documents are authoritative for onboarding, architecture narrative, product handoff, UML guidance, sprint summaries, consolidated QA, and release operations. Markdown remains authoritative for build criteria, engineering policy, design constraints, and operative test procedures.

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

## Governance

- `documentation-traceability.json` records every retained or consolidated historical Markdown source and its destination.
- Historical sprint-specific status and QA detail remains available through Git history.
- Update the retained Markdown directive first when build criteria, policy, design constraints, or operative procedures change; update the related Word explanation in the same change.
- Update Word directly for narrative or stakeholder documentation.
- Validate Word and Visio artifacts with `tools/validate_documentation_artifacts.py`.
- Render and inspect every Word page after a meaningful edit.
