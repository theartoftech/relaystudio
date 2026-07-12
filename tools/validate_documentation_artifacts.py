#!/usr/bin/env python3
"""Validate Relay Studio Sprint 15 Word and Visio documentation artifacts."""

from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
DOC_ROOT = ROOT / "documentation"
WORD_DIR = DOC_ROOT / "word"
VISIO_DIR = DOC_ROOT / "uml" / "visio"
TRACEABILITY_PATH = DOC_ROOT / "documentation-traceability.json"

EXPECTED_WORD = {
    "Relay-Studio-Developer-Onboarding-and-Debugging-Guide.docx",
    "Relay-Studio-Technical-Architecture-and-Product-Handoff.docx",
    "Relay-Studio-UML-Guide.docx",
    "Relay-Studio-Sprint-Portfolio.docx",
    "Relay-Studio-Test-and-QA-Manual.docx",
    "Relay-Studio-Security-Platform-and-Release-Manual.docx",
}

EXPECTED_VISIO = {
    "Relay-Studio-UML-Atlas.vsdx",
    "class-diagram.vsdx",
    "object-diagram.vsdx",
    "component-diagram.vsdx",
    "deployment-diagram.vsdx",
    "package-diagram.vsdx",
    "profile-diagram.vsdx",
    "composite-structure-diagram.vsdx",
    "use-case-diagram.vsdx",
    "activity-diagram.vsdx",
    "state-machine-diagram.vsdx",
    "sequence-diagram.vsdx",
    "communication-diagram.vsdx",
    "interaction-overview-diagram.vsdx",
    "timing-diagram.vsdx",
}

REQUIRED_VISIO_PARTS = {
    "[Content_Types].xml",
    "_rels/.rels",
    "docProps/core.xml",
    "docProps/app.xml",
    "visio/document.xml",
    "visio/_rels/document.xml.rels",
    "visio/pages/pages.xml",
    "visio/pages/_rels/pages.xml.rels",
    "visio/masters/masters.xml",
}

FORBIDDEN_PATTERNS = (
    re.compile(r"(?i)bearer\s+[A-Za-z0-9._~+/=-]{16,}"),
    re.compile(r"(?i)(password|client_secret|api[_-]?key)\s*[:=]\s*[^\s<]{8,}"),
)


def fail(message: str) -> None:
    raise AssertionError(message)


def parse_xml(data: bytes, source: str) -> ElementTree.Element:
    try:
        return ElementTree.fromstring(data)
    except ElementTree.ParseError as error:
        fail(f"Malformed XML in {source}: {error}")


def validate_word(path: Path) -> None:
    if path.stat().st_size < 10_000:
        fail(f"Word document is unexpectedly small: {path}")
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        for required in ("[Content_Types].xml", "_rels/.rels", "word/document.xml", "docProps/core.xml"):
            if required not in names:
                fail(f"Missing {required} in {path.name}")
        document_xml = archive.read("word/document.xml")
        root = parse_xml(document_xml, f"{path.name}/word/document.xml")
        headings = [node for node in root.iter() if node.tag.endswith("}pStyle") and node.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val", "").startswith("Heading")]
        if len(headings) < 5:
            fail(f"Expected at least five structured headings in {path.name}")
        text = document_xml.decode("utf-8", errors="ignore")
        if "TODO" in text or "PLACEHOLDER" in text:
            fail(f"Placeholder text remains in {path.name}")
        for pattern in FORBIDDEN_PATTERNS:
            if pattern.search(text):
                fail(f"Potential secret-like value in {path.name}: {pattern.pattern}")


def relationship_targets(archive: zipfile.ZipFile, name: str) -> list[str]:
    root = parse_xml(archive.read(name), f"{archive.filename}/{name}")
    targets: list[str] = []
    for relationship in root:
        if relationship.attrib.get("TargetMode") == "External":
            fail(f"External relationship is not allowed in {archive.filename}: {relationship.attrib.get('Target')}")
        target = relationship.attrib.get("Target")
        if target:
            targets.append(target)
    return targets


def validate_visio(path: Path, expected_pages: int) -> None:
    if path.stat().st_size < 3_000:
        fail(f"Visio document is unexpectedly small: {path}")
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        missing = REQUIRED_VISIO_PARTS - names
        if missing:
            fail(f"Missing required VSDX parts in {path.name}: {sorted(missing)}")
        for name in names:
            if name.endswith((".xml", ".rels")):
                parse_xml(archive.read(name), f"{path.name}/{name}")
        relationship_targets(archive, "_rels/.rels")
        relationship_targets(archive, "visio/_rels/document.xml.rels")
        page_targets = relationship_targets(archive, "visio/pages/_rels/pages.xml.rels")
        if len(page_targets) != expected_pages:
            fail(f"Expected {expected_pages} page relationships in {path.name}, found {len(page_targets)}")
        page_files = sorted(name for name in names if re.fullmatch(r"visio/pages/page\d+\.xml", name))
        if len(page_files) != expected_pages:
            fail(f"Expected {expected_pages} page parts in {path.name}, found {len(page_files)}")
        for page_file in page_files:
            data = archive.read(page_file)
            root = parse_xml(data, f"{path.name}/{page_file}")
            shapes = [node for node in root.iter() if node.tag.endswith("}Shape")]
            connects = [node for node in root.iter() if node.tag.endswith("}Connect")]
            if len(shapes) < 3:
                fail(f"Expected editable native shapes in {path.name}/{page_file}")
            if len(connects) < 2:
                fail(f"Expected native connectors in {path.name}/{page_file}")
            ids = [shape.attrib.get("ID") for shape in shapes]
            if len(ids) != len(set(ids)):
                fail(f"Duplicate shape IDs in {path.name}/{page_file}")
            text = data.decode("utf-8", errors="ignore")
            for pattern in FORBIDDEN_PATTERNS:
                if pattern.search(text):
                    fail(f"Potential secret-like value in {path.name}/{page_file}")


def validate_traceability() -> None:
    manifest = json.loads(TRACEABILITY_PATH.read_text(encoding="utf-8"))
    entries = manifest.get("entries")
    if not isinstance(entries, list) or len(entries) < 40:
        fail("Traceability manifest does not cover the historical documentation set")
    sources = [entry.get("source") for entry in entries]
    if len(sources) != len(set(sources)):
        fail("Traceability manifest contains duplicate source entries")
    for entry in entries:
        if entry.get("action") not in {"retain", "consolidate-remove"}:
            fail(f"Invalid traceability action: {entry}")
        if not entry.get("destination"):
            fail(f"Missing traceability destination: {entry}")


def main() -> int:
    actual_word = {path.name for path in WORD_DIR.glob("*.docx")}
    actual_visio = {path.name for path in VISIO_DIR.glob("*.vsdx")}
    if actual_word != EXPECTED_WORD:
        fail(f"Word artifact set mismatch: missing={sorted(EXPECTED_WORD-actual_word)} extra={sorted(actual_word-EXPECTED_WORD)}")
    if actual_visio != EXPECTED_VISIO:
        fail(f"Visio artifact set mismatch: missing={sorted(EXPECTED_VISIO-actual_visio)} extra={sorted(actual_visio-EXPECTED_VISIO)}")
    for filename in sorted(EXPECTED_WORD):
        validate_word(WORD_DIR / filename)
    for filename in sorted(EXPECTED_VISIO):
        validate_visio(VISIO_DIR / filename, 14 if filename == "Relay-Studio-UML-Atlas.vsdx" else 1)
    validate_traceability()
    print(f"Validated {len(EXPECTED_WORD)} Word documents, {len(EXPECTED_VISIO)} Visio documents, and the traceability manifest.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (AssertionError, OSError, zipfile.BadZipFile, json.JSONDecodeError) as error:
        print(f"Documentation validation failed: {error}", file=sys.stderr)
        sys.exit(1)
