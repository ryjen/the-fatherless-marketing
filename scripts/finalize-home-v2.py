#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "public-manifest.json"
HOME = ROOT / "src" / "index.html"
OLD_STYLE = ROOT / "src" / "styles" / "home.v1.css"
NEW_STYLE = ROOT / "src" / "styles" / "home.v2.css"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    if not NEW_STYLE.is_file():
        raise SystemExit("missing home.v2.css")

    manifest = json.loads(MANIFEST.read_text())
    saw_home = False
    saw_style = False

    for artifact in manifest["artifacts"]:
        if artifact["id"] == "site-placeholder-home":
            artifact["checksum_sha256"] = sha256(HOME)
            saw_home = True
        elif artifact["id"] == "style-home-v1":
            artifact.update({
                "id": "style-home-v2",
                "path": "src/styles/home.v2.css",
                "title": "Homepage cinematic composition v2",
                "summary": "Screen-first homepage hierarchy with integrated navigation, centered cinematic hero, compact trilogy panels, and an intentional recurring-question section.",
                "canonical_url": "/styles/home.v2.css",
                "replacement_status": "current",
            })
            saw_style = True

    if not saw_home or not saw_style:
        raise SystemExit(f"manifest update incomplete: home={saw_home} style={saw_style}")

    OLD_STYLE.unlink(missing_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

    print(f"homepage sha256={sha256(HOME)}")
    print(f"home.v2.css sha256={sha256(NEW_STYLE)}")


if __name__ == "__main__":
    main()
