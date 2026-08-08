#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
from pathlib import Path, PurePosixPath

ALLOWED_TIERS = {"placeholder", "premise", "early-context", "approved-excerpt"}
ALLOWED_STATES = {"placeholder", "candidate", "approved", "published", "withdrawn", "superseded"}
PUBLISHABLE_STATES = {"placeholder", "approved", "published"}
ALLOWED_REPLACEMENT = {"current", "withdrawn", "superseded"}
MEDIA_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg", ".pdf"}
TEXT_SUFFIXES = {".html", ".md", ".txt"}
PUBLIC_TEXT_SUFFIXES = {".html", ".md", ".txt", ".json", ".yml", ".yaml", ".css", ".js", ".xml", ".svg"}
CREATOR_CLASSES = {"author-created", "commissioned", "generated", "stock", "public-domain", "historical", "contributor-owned"}
METADATA_REVIEWS = {"stripped", "reviewed-retained"}
PRIVATE_RE = re.compile(r"(?i)ryjen/the-fatherless(?!-marketing)")
SECRET_RES = [
    re.compile(r"BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
]
DRAFT_RE = re.compile(r"(?i)\b(?:TODO|FIXME|DRAFT|INTERNAL ONLY|DO NOT PUBLISH)\b")


class ValidationError(RuntimeError):
    pass


def fail(message: str) -> None:
    raise ValidationError(message)


def require_nonempty_string(value: object, field: str, artifact_id: str) -> None:
    if not isinstance(value, str) or not value.strip():
        fail(f"{field} must be a non-empty string: {artifact_id}")


def load_manifest(root: Path) -> dict:
    try:
        manifest = json.loads((root / "public-manifest.json").read_text())
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"invalid public-manifest.json: {exc}")
    if manifest.get("schema_version") != 1:
        fail("unsupported manifest schema")
    if not isinstance(manifest.get("artifacts"), list):
        fail("manifest artifacts must be a list")
    return manifest


def normalized_repo_path(raw: object) -> PurePosixPath:
    if not isinstance(raw, str) or not raw:
        fail("manifest path must be a non-empty string")
    path = PurePosixPath(raw)
    if path.is_absolute() or path.as_posix() != raw or any(part in {"", ".", ".."} for part in path.parts):
        fail(f"manifest path must be normalized and repository-relative: {raw}")
    if not path.parts or path.parts[0] not in {"src", "staging"}:
        fail(f"manifest path must live under src/ or staging/: {raw}")
    return path


def media_metadata_markers(path: Path) -> list[str]:
    data = path.read_bytes()
    suffix = path.suffix.lower()
    markers: list[str] = []
    if suffix in {".jpg", ".jpeg"} and b"Exif\x00\x00" in data:
        markers.append("EXIF")
    elif suffix == ".png":
        for marker in (b"tEXt", b"zTXt", b"iTXt", b"eXIf"):
            if marker in data:
                markers.append(marker.decode("ascii", errors="ignore"))
    elif suffix == ".webp":
        if b"EXIF" in data:
            markers.append("EXIF")
        if b"XMP " in data:
            markers.append("XMP")
    elif suffix == ".avif":
        if b"Exif" in data:
            markers.append("EXIF")
        if b"xmp" in data.lower():
            markers.append("XMP")
    elif suffix == ".gif" and b"\x21\xfe" in data:
        markers.append("comment-extension")
    elif suffix == ".svg":
        text = data.decode("utf-8", errors="ignore").lower()
        if "<metadata" in text:
            markers.append("metadata-element")
    elif suffix == ".pdf":
        lowered = data.lower()
        for marker in (b"/author", b"/creator", b"/producer", b"/subject", b"/keywords", b"<x:xmpmeta"):
            if marker in lowered:
                markers.append(marker.decode("ascii", errors="ignore"))
    return sorted(set(markers))


def iter_public_text_files(root: Path):
    explicit = [root / "README.md", root / "RIGHTS.md", root / "CONTRIBUTING.md", root / "public-manifest.json"]
    for path in explicit:
        if path.is_file():
            yield path
    for base in (root / "src", root / "docs", root / ".github" / "workflows"):
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.is_file() and path.suffix.lower() in PUBLIC_TEXT_SUFFIXES:
                yield path


def validate_public_text(root: Path) -> None:
    for path in iter_public_text_files(root):
        text = path.read_text(errors="ignore")
        if PRIVATE_RE.search(text):
            fail(f"private repository identifier detected: {path.relative_to(root)}")
        for pattern in SECRET_RES:
            if pattern.search(text):
                fail(f"secret-like material detected: {path.relative_to(root)}")
    src = root / "src"
    if src.exists():
        for path in src.rglob("*"):
            if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES:
                if DRAFT_RE.search(path.read_text(errors="ignore")):
                    fail(f"draft marker detected in public source: {path.relative_to(root)}")


def validate_manifest(root: Path) -> tuple[dict, dict[str, dict]]:
    manifest = load_manifest(root)
    seen_ids: set[str] = set()
    entries_by_path: dict[str, dict] = {}
    required = {"id", "path", "content_type", "spoiler_tier", "approval_state", "rights_status", "provenance_class", "checksum_sha256", "replacement_status"}

    for artifact in manifest["artifacts"]:
        if not isinstance(artifact, dict):
            fail("manifest artifact must be an object")
        missing = required - artifact.keys()
        if missing:
            fail(f"manifest entry missing fields: {sorted(missing)}")
        artifact_id = artifact["id"]
        if not isinstance(artifact_id, str) or not artifact_id or artifact_id in seen_ids:
            fail(f"invalid or duplicate artifact id: {artifact_id}")
        seen_ids.add(artifact_id)
        require_nonempty_string(artifact["content_type"], "content_type", artifact_id)
        require_nonempty_string(artifact["rights_status"], "rights_status", artifact_id)
        require_nonempty_string(artifact["provenance_class"], "provenance_class", artifact_id)

        if artifact["spoiler_tier"] not in ALLOWED_TIERS:
            fail(f"publicly forbidden spoiler tier: {artifact['spoiler_tier']}")
        if artifact["approval_state"] not in ALLOWED_STATES:
            fail(f"invalid approval state: {artifact['approval_state']}")
        if artifact["replacement_status"] not in ALLOWED_REPLACEMENT:
            fail(f"invalid replacement status: {artifact['replacement_status']}")

        state = artifact["approval_state"]
        replacement = artifact["replacement_status"]
        expected_replacement = "withdrawn" if state == "withdrawn" else "superseded" if state == "superseded" else "current"
        if replacement != expected_replacement:
            fail(f"approval/replacement state mismatch for {artifact_id}: {state}/{replacement}")

        repo_path = normalized_repo_path(artifact["path"])
        raw_path = repo_path.as_posix()
        if raw_path in entries_by_path:
            fail(f"duplicate manifest path: {raw_path}")
        entries_by_path[raw_path] = artifact
        disk_path = root / raw_path
        if not disk_path.is_file():
            fail(f"manifest path missing: {raw_path}")

        in_src = repo_path.parts[0] == "src"
        if in_src and state not in PUBLISHABLE_STATES:
            fail(f"non-publishable artifact must not live under src/: {raw_path}")
        if state == "candidate" and in_src:
            fail(f"candidate artifact must not be build-visible: {raw_path}")

        checksum = artifact["checksum_sha256"]
        if state in {"approved", "published"}:
            if not isinstance(checksum, str) or re.fullmatch(r"[0-9a-f]{64}", checksum) is None:
                fail(f"approved artifact requires sha256: {artifact_id}")
            actual = hashlib.sha256(disk_path.read_bytes()).hexdigest()
            if checksum != actual:
                fail(f"checksum mismatch for {artifact_id}")
        elif checksum is not None and (not isinstance(checksum, str) or re.fullmatch(r"[0-9a-f]{64}", checksum) is None):
            fail(f"invalid sha256 for {artifact_id}")

        if disk_path.suffix.lower() in MEDIA_SUFFIXES:
            media_required = {"creator_class", "rights_basis", "attribution_required", "metadata_review"}
            media_missing = media_required - artifact.keys()
            if media_missing:
                fail(f"media provenance fields missing for {artifact_id}: {sorted(media_missing)}")
            if artifact["creator_class"] not in CREATOR_CLASSES:
                fail(f"invalid creator_class: {artifact_id}")
            require_nonempty_string(artifact["rights_basis"], "rights_basis", artifact_id)
            if not isinstance(artifact["attribution_required"], bool):
                fail(f"attribution_required must be boolean: {artifact_id}")
            if artifact["attribution_required"]:
                require_nonempty_string(artifact.get("attribution_text"), "attribution_text", artifact_id)
            if artifact["metadata_review"] not in METADATA_REVIEWS:
                fail(f"invalid metadata_review: {artifact_id}")
            if artifact["metadata_review"] == "reviewed-retained":
                require_nonempty_string(artifact.get("metadata_retention_reason"), "metadata_retention_reason", artifact_id)
            else:
                markers = media_metadata_markers(disk_path)
                if markers:
                    fail(f"embedded metadata present despite stripped status for {artifact_id}: {', '.join(markers)}")

        serialized = json.dumps(artifact).lower()
        if PRIVATE_RE.search(serialized):
            fail(f"private repository reference detected in {artifact_id}")
        for forbidden in ("private_issue", "private_path", "private_revision"):
            if forbidden in serialized:
                fail(f"private provenance field/reference detected in {artifact_id}")

    src = root / "src"
    if src.exists():
        for path in src.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            if rel not in entries_by_path:
                fail(f"unmanifested deployable source: {rel}")
            if path.suffix.lower() in TEXT_SUFFIXES:
                words = re.findall(r"\b[\w’'-]+\b", path.read_text(errors="ignore"))
                if len(words) >= 8000:
                    entry = entries_by_path[rel]
                    if entry["spoiler_tier"] != "approved-excerpt" or entry["approval_state"] not in {"approved", "published"}:
                        fail(f"suspicious manuscript-scale text import: {rel} ({len(words)} words)")

    validate_public_text(root)
    return manifest, entries_by_path


def publishable_paths(root: Path) -> list[Path]:
    _, entries = validate_manifest(root)
    return sorted(Path(raw) for raw, artifact in entries.items() if raw.startswith("src/") and artifact["approval_state"] in PUBLISHABLE_STATES)


def build(root: Path) -> None:
    paths = publishable_paths(root)
    dist = root / "dist"
    shutil.rmtree(dist, ignore_errors=True)
    dist.mkdir(parents=True, exist_ok=True)
    for source_rel in paths:
        target = dist / Path(*source_rel.parts[1:])
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / source_rel, target)
    print(f"Built dist/ from {len(paths)} manifest-backed artifact(s).")


def validate_dist(root: Path) -> None:
    expected = {Path(*path.parts[1:]).as_posix(): root / path for path in publishable_paths(root)}
    dist = root / "dist"
    if not dist.is_dir():
        fail("missing dist/")
    actual = {path.relative_to(dist).as_posix(): path for path in dist.rglob("*") if path.is_file()}
    if set(actual) != set(expected):
        fail(f"dist contents differ from manifest: expected={sorted(expected)} actual={sorted(actual)}")
    for rel, source in expected.items():
        if actual[rel].read_bytes() != source.read_bytes():
            fail(f"dist artifact differs from source: {rel}")

    index = dist / "index.html"
    if not index.is_file():
        fail("missing dist/index.html")
    html = index.read_text(errors="ignore")
    if re.search(r"<html[^>]*\blang=", html, re.I) is None:
        fail("index.html missing lang attribute")
    if re.search(r"<meta[^>]*name=[\"']viewport[\"']", html, re.I) is None:
        fail("index.html missing viewport metadata")
    if re.search(r"<title>[^<]+</title>", html, re.I) is None:
        fail("index.html missing non-empty title")
    if len(re.findall(r"<h1(?:\s[^>]*)?>", html, re.I)) != 1:
        fail("index.html must contain exactly one h1")
    print("Manifest and publication-boundary validation passed.")


def main(argv: list[str]) -> int:
    root = Path(__file__).resolve().parent.parent
    command = argv[1] if len(argv) > 1 else "validate"
    try:
        if command == "build":
            build(root)
        elif command == "source":
            validate_manifest(root)
            print("Source publication boundary passed.")
        elif command == "validate":
            validate_dist(root)
        else:
            fail(f"unknown command: {command}")
    except ValidationError as exc:
        print(f"publication validation failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
