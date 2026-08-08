import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "publication.py"
spec = importlib.util.spec_from_file_location("publication", MODULE_PATH)
publication = importlib.util.module_from_spec(spec)
if spec.loader is None:
    raise RuntimeError("could not load publication module")
spec.loader.exec_module(publication)


class PublicationBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "src").mkdir()
        (self.root / "staging").mkdir()
        self.index = self.root / "src" / "index.html"
        self.index.write_text('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Test</title></head><body><h1>Test</h1></body></html>')

    def tearDown(self):
        self.tmp.cleanup()

    def artifact(self, path="src/index.html", **overrides):
        entry = {
            "id": path.replace("/", "-"),
            "path": path,
            "content_type": "page",
            "spoiler_tier": "placeholder",
            "approval_state": "placeholder",
            "rights_status": "repository-authored",
            "provenance_class": "public-native",
            "checksum_sha256": None,
            "replacement_status": "current",
        }
        entry.update(overrides)
        return entry

    def manifest(self, entries):
        (self.root / "public-manifest.json").write_text(json.dumps({"schema_version": 1, "artifacts": entries}))

    def assert_invalid(self, message_part):
        with self.assertRaises(publication.ValidationError) as ctx:
            publication.validate_manifest(self.root)
        self.assertIn(message_part, str(ctx.exception))

    def test_unmanifested_src_file_is_rejected(self):
        (self.root / "src" / "leak.html").write_text("<p>unreviewed</p>")
        self.manifest([self.artifact()])
        self.assert_invalid("unmanifested deployable source")

    def test_withdrawn_artifact_cannot_remain_in_src(self):
        self.manifest([self.artifact(approval_state="withdrawn", replacement_status="withdrawn")])
        self.assert_invalid("non-publishable artifact must not live under src")

    def test_state_replacement_mismatch_is_rejected(self):
        self.manifest([self.artifact(approval_state="withdrawn", replacement_status="current")])
        self.assert_invalid("approval/replacement state mismatch")

    def test_path_traversal_is_rejected(self):
        outside = self.root / "outside.txt"
        outside.write_text("x")
        self.manifest([self.artifact(path="src/../outside.txt")])
        self.assert_invalid("normalized and repository-relative")

    def test_attribution_text_is_required_when_attribution_is_required(self):
        image = self.root / "src" / "image.jpg"
        image.write_bytes(b"plain-jpeg-like-data")
        self.manifest([
            self.artifact(),
            self.artifact(
                path="src/image.jpg",
                id="image",
                content_type="image",
                creator_class="stock",
                rights_basis="licensed",
                attribution_required=True,
                metadata_review="stripped",
            ),
        ])
        self.assert_invalid("attribution_text")

    def test_retained_metadata_requires_reason(self):
        image = self.root / "src" / "image.jpg"
        image.write_bytes(b"Exif\x00\x00retained")
        self.manifest([
            self.artifact(),
            self.artifact(
                path="src/image.jpg",
                id="image",
                content_type="image",
                creator_class="author-created",
                rights_basis="author-owned",
                attribution_required=False,
                metadata_review="reviewed-retained",
            ),
        ])
        self.assert_invalid("metadata_retention_reason")

    def test_stripped_jpeg_metadata_is_rejected(self):
        image = self.root / "src" / "image.jpg"
        image.write_bytes(b"Exif\x00\x00should-have-been-stripped")
        self.manifest([
            self.artifact(),
            self.artifact(
                path="src/image.jpg",
                id="image",
                content_type="image",
                creator_class="author-created",
                rights_basis="author-owned",
                attribution_required=False,
                metadata_review="stripped",
            ),
        ])
        self.assert_invalid("embedded metadata present despite stripped status")

    def test_private_repository_reference_is_rejected(self):
        self.index.write_text("See github.com/ryjen/the-fatherless/issues/1")
        self.manifest([self.artifact()])
        self.assert_invalid("private repository identifier")

    def test_large_text_requires_approved_excerpt(self):
        prose = self.root / "src" / "chapter.txt"
        prose.write_text("word " * 8000)
        self.manifest([self.artifact(), self.artifact(path="src/chapter.txt", id="chapter", content_type="text")])
        self.assert_invalid("suspicious manuscript-scale text import")

    def test_approved_artifact_requires_matching_checksum(self):
        self.manifest([self.artifact(approval_state="approved", checksum_sha256="0" * 64)])
        self.assert_invalid("checksum mismatch")

    def test_build_copies_only_manifest_backed_publishable_src(self):
        candidate = self.root / "staging" / "candidate.txt"
        candidate.write_text("candidate")
        self.manifest([
            self.artifact(),
            self.artifact(path="staging/candidate.txt", id="candidate", content_type="text", approval_state="candidate"),
        ])
        publication.build(self.root)
        self.assertTrue((self.root / "dist" / "index.html").is_file())
        self.assertFalse((self.root / "dist" / "candidate.txt").exists())
        publication.validate_dist(self.root)

    def test_valid_approved_artifact_passes(self):
        digest = hashlib.sha256(self.index.read_bytes()).hexdigest()
        self.manifest([self.artifact(approval_state="approved", checksum_sha256=digest)])
        publication.build(self.root)
        publication.validate_dist(self.root)


if __name__ == "__main__":
    unittest.main()
