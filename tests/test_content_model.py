import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "content_model.py"
spec = importlib.util.spec_from_file_location("content_model", MODULE_PATH)
content_model = importlib.util.module_from_spec(spec)
if spec.loader is None:
    raise RuntimeError("could not load content model module")
spec.loader.exec_module(content_model)


class ContentModelTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def artifact(self, **overrides):
        entry = {
            "id": "home",
            "path": "src/index.html",
            "title": "Home",
            "summary": "Public home page.",
            "content_type": "page",
            "spoiler_tier": "placeholder",
            "approval_state": "placeholder",
            "rights_status": "repository-authored",
            "provenance_class": "public-native",
            "publication_date": None,
            "canonical_url": "/",
            "checksum_sha256": None,
            "replacement_status": "current",
        }
        entry.update(overrides)
        return entry

    def manifest(self, entries):
        (self.root / "public-manifest.json").write_text(json.dumps({"schema_version": 1, "artifacts": entries}))

    def assert_invalid(self, message):
        with self.assertRaises(content_model.ContentModelError) as ctx:
            content_model.validate(self.root)
        self.assertIn(message, str(ctx.exception))

    def test_valid_placeholder_page(self):
        self.manifest([self.artifact()])
        content_model.validate(self.root)

    def test_missing_reader_metadata_rejected(self):
        entry = self.artifact()
        del entry["summary"]
        self.manifest([entry])
        self.assert_invalid("content metadata missing fields")

    def test_duplicate_canonical_rejected(self):
        second = self.artifact(id="about", path="src/about.html", title="About")
        self.manifest([self.artifact(), second])
        self.assert_invalid("duplicate canonical_url")

    def test_published_requires_iso_date(self):
        self.manifest([self.artifact(approval_state="published", publication_date="soon")])
        self.assert_invalid("publication_date must use YYYY-MM-DD")

    def test_unpublished_must_not_claim_publication_date(self):
        self.manifest([self.artifact(publication_date="2026-08-08")])
        self.assert_invalid("publication_date must be null until published")

    def test_candidate_must_not_claim_canonical(self):
        self.manifest([self.artifact(path="staging/candidate.md", approval_state="candidate")])
        self.assert_invalid("non-deployable artifact must not claim canonical_url")

    def test_excerpt_requires_excerpt_spoiler_tier(self):
        self.manifest([self.artifact(content_type="excerpt", spoiler_tier="premise")])
        self.assert_invalid("excerpt requires approved-excerpt")

    def test_unsupported_content_type_rejected(self):
        self.manifest([self.artifact(content_type="private-canon")])
        self.assert_invalid("unsupported public content_type")

    def test_canonical_query_rejected(self):
        self.manifest([self.artifact(canonical_url="/?draft=1")])
        self.assert_invalid("canonical_url must not contain query")

    def test_reader_url_extension_rejected(self):
        self.manifest([self.artifact(canonical_url="/books/page.html")])
        self.assert_invalid("reader canonical_url must be lowercase")

    def test_reader_url_uppercase_rejected(self):
        self.manifest([self.artifact(canonical_url="/Books/")])
        self.assert_invalid("reader canonical_url must be lowercase")

    def test_press_asset_file_url_allowed(self):
        self.manifest([self.artifact(content_type="press-asset", canonical_url="/press/cover-v1.jpg")])
        content_model.validate(self.root)


if __name__ == "__main__":
    unittest.main()
