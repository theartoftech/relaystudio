import io
import unittest
import zipfile

from tools.validate_documentation_artifacts import relationship_targets, scan_text_parts


class DocumentationArtifactSecurityTests(unittest.TestCase):
    def test_scans_custom_xml_parts_for_secret_canaries(self) -> None:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("customXml/item1.xml", "<root>Bearer synthetic-token-value</root>")
        with zipfile.ZipFile(io.BytesIO(buffer.getvalue())) as archive:
            with self.assertRaises(AssertionError):
                scan_text_parts(archive, "fixture.docx")

    def test_rejects_external_relationships_in_any_relationship_part(self) -> None:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr(
                "word/_rels/header1.xml.rels",
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                '<Relationship Id="rId1" Type="https://example.invalid/external" '
                'Target="https://example.invalid" TargetMode="External"/></Relationships>'
            )
        with zipfile.ZipFile(io.BytesIO(buffer.getvalue())) as archive:
            with self.assertRaises(AssertionError):
                relationship_targets(archive, "word/_rels/header1.xml.rels")


if __name__ == "__main__":
    unittest.main()
