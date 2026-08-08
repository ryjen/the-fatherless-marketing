#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

CONTENT_TYPES = {
    "page",
    "book-summary",
    "character-profile",
    "world-note",
    "great-age-note",
    "excerpt",
    "quotation",
    "news",
    "faq",
    "press",
    "press-asset",
}
DEPLOYABLE_STATES = {"placeholder", "approved", "published"}


class ContentModelError(RuntimeError):
    pass


def fail(message: str) -> None:
    raise ContentModelError(message)


def nonempty(value: object, field: str, artifact_id: str) -> str:
    if not isinstance(value, str) or not value.strip():
        fail(f"{field} must be a non-empty string: {artifact_id}")
    return value.strip()


def validate_canonical(value: object, artifact_id: str) -> str:
    canonical = nonempty(value, "canonical_url", artifact_id)
    if not canonical.startswith("/"):
        fail(f"canonical_url must be root-relative: {artifact_id}")
    if "?" in canonical or "#" in canonical or "//" in canonical[1:]:
        fail(f"canonical_url must not contain query, fragment, or duplicate separators: {artifact_id}")
    if any(part in {".", ".."} for part in canonical.split("/")):
        fail(f"canonical_url must not contain traversal segments: {artifact_id}")
    if re.fullmatch(r"/[A-Za-z0-9._~/-]*", canonical) is None:
        fail(f"canonical_url contains unsupported characters: {artifact_id}")
    return canonical


def validate(root: Path) -> None:
    try:
        manifest = json.loads((root / "public-manifest.json").read_text())
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"invalid public-manifest.json: {exc}")

    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list):
        fail("manifest artifacts must be a list")

    required = {"id", "path", "title", "summary", "content_type", "approval_state", "publication_date", "canonical_url", "replacement_status"}
    seen_canonicals: set[str] = set()

    for artifact in artifacts:
        if not isinstance(artifact, dict):
            fail("manifest artifact must be an object")
        missing = required - artifact.keys()
        if missing:
            fail(f"content metadata missing fields: {sorted(missing)}")

        artifact_id = nonempty(artifact["id"], "id", "artifact")
        nonempty(artifact["title"], "title", artifact_id)
        nonempty(artifact["summary"], "summary", artifact_id)

        content_type = artifact["content_type"]
        if content_type not in CONTENT_TYPES:
            fail(f"unsupported public content_type: {artifact_id}/{content_type}")

        path = nonempty(artifact["path"], "path", artifact_id)
        state = artifact["approval_state"]
        deployable = path.startswith("src/") and state in DEPLOYABLE_STATES and artifact["replacement_status"] == "current"

        publication_date = artifact["publication_date"]
        if state == "published":
            if not isinstance(publication_date, str):
                fail(f"published artifact requires publication_date: {artifact_id}")
            try:
                date.fromisoformat(publication_date)
            except ValueError:
                fail(f"publication_date must use YYYY-MM-DD: {artifact_id}")
        elif publication_date is not None:
            fail(f"publication_date must be null until published: {artifact_id}")

        canonical = artifact["canonical_url"]
        if deployable:
            canonical = validate_canonical(canonical, artifact_id)
            if canonical in seen_canonicals:
                fail(f"duplicate canonical_url: {canonical}")
            seen_canonicals.add(canonical)
        elif canonical is not None:
            fail(f"non-deployable artifact must not claim canonical_url: {artifact_id}")

        if content_type in {"excerpt", "quotation"} and artifact.get("spoiler_tier") != "approved-excerpt":
            fail(f"{content_type} requires approved-excerpt spoiler tier: {artifact_id}")

    print("Public content model validation passed.")


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    try:
        validate(root)
    except ContentModelError as exc:
        print(f"content model validation failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
