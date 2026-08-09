#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STAGING = ROOT / "staging" / "raster-seed"
HEROES = ROOT / "src" / "media" / "heroes"

ASSETS = {
    "age-of-embers": "v2-age.part-*.b64",
    "fatherless-original": "v2-original.part-*.b64",
    "neurion": "v2-neurion.part-*.b64",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def materialize() -> None:
    HEROES.mkdir(parents=True, exist_ok=True)
    for name, pattern in ASSETS.items():
        parts = sorted(STAGING.glob(pattern))
        if not parts:
            raise SystemExit(f"missing raster seed parts for {name}: {pattern}")
        encoded = "".join(part.read_text().strip() for part in parts)
        data = base64.b64decode(encoded, validate=True)
        if not (data.startswith(b"RIFF") and data[8:12] == b"WEBP"):
            raise SystemExit(f"decoded asset is not WebP: {name}")
        if b"EXIF" in data or b"XMP " in data:
            raise SystemExit(f"embedded metadata marker found: {name}")
        (HEROES / f"{name}.webp").write_bytes(data)


def replace(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old}")
    path.write_text(text.replace(old, new))


def update_pages() -> None:
    home = ROOT / "src" / "index.html"
    replace(home, 'media/heroes/fatherless-original-hero.svg" width="1440" height="810"', 'media/heroes/fatherless-original.webp" width="1200" height="675"')
    replace(home, 'media/heroes/age-of-embers-hero.svg" width="1440" height="810"', 'media/heroes/age-of-embers.webp" width="1200" height="675"')
    replace(home, 'media/heroes/neurion-hero.svg" width="1440" height="810"', 'media/heroes/neurion.webp" width="1200" height="675"')
    replace(
        home,
        '<div><span class="thread-kicker">One fish.</span><span>Survival becomes stewardship.</span></div>\n'
        '      <div><span class="thread-kicker">One question.</span><span>Power changes form. Legitimacy still has to be earned.</span></div>\n'
        '      <div><span class="thread-kicker">Many fish.</span><span>Plurality requires consent, not a new master.</span></div>',
        '<div><span class="thread-kicker">Who gets to survive?</span><span>Age of Embers · survival becomes stewardship.</span></div>\n'
        '      <div><span class="thread-kicker">Who gets to rule?</span><span>The Fatherless · authority must justify itself.</span></div>\n'
        '      <div><span class="thread-kicker">Who gets to be a person?</span><span>Neurion · personhood cannot depend on ownership.</span></div>',
    )

    prequel = ROOT / "src" / "books" / "prequel" / "index.html"
    replace(prequel, '../../media/heroes/age-of-embers-hero.svg" width="2400" height="1350"', '../../media/heroes/age-of-embers.webp" width="1200" height="675"')

    original = ROOT / "src" / "books" / "the-fatherless" / "index.html"
    replace(original, '../../media/heroes/fatherless-original-hero.svg" width="2400" height="1350"', '../../media/heroes/fatherless-original.webp" width="1200" height="675"')
    replace(original, "people living under Roman power", "people living under Aurelian power")

    sequel = ROOT / "src" / "books" / "sequel" / "index.html"
    replace(sequel, '../../media/heroes/neurion-hero.svg" width="2400" height="1350"', '../../media/heroes/neurion.webp" width="1200" height="675"')


def update_provenance() -> None:
    (ROOT / "docs" / "image-provenance.md").write_text(
        """# Hero image provenance

The production hero artwork is project-generated raster imagery created specifically for the marketing site. It does not incorporate stock photography, private authoring files, manuscript imagery, logos, or third-party source assets.

| Asset | Creator class | Rights basis | Metadata | Public use |
| --- | --- | --- | --- | --- |
| `age-of-embers.webp` | generated | Project-generated original artwork approved for this public release | stripped | prequel hero and trilogy card |
| `fatherless-original.webp` | generated | Project-generated original artwork approved for this public release | stripped | homepage landing hero, original hero, and trilogy card |
| `neurion.webp` | generated | Project-generated original artwork approved for this public release | stripped | sequel hero and trilogy card |

## Production decision

The approved public assets are compact 1200 × 675 WebP files. They avoid shipping the larger source JPEGs while retaining sufficient resolution for the current desktop hero crops. Additional derivative sizes are not required for this release because the encoded assets remain small.

The source-generation prompts and canon-sensitive art reasoning remain outside the deployable public artifact set. Only reviewed public image bytes, public-safe alt text, and public provenance records are published here.

## Review

The three production images were reviewed against the public image-direction brief:

- no devotional or Christianity-coded central figure;
- no sepia/parchment/brown historical treatment;
- no sacred halo or saviour portrait treatment;
- no generic caveman portrait or ritual-fire poster;
- no glowing robot saviour, Matrix code, or single central AI deity;
- no baked-in text, logos, private identifiers, or hidden story mechanics;
- descriptive `alt` text is supplied by page markup rather than embedded in the artwork.
"""
    )


def update_manifest() -> None:
    path = ROOT / "public-manifest.json"
    manifest = json.loads(path.read_text())
    page_paths = {
        "src/index.html",
        "src/books/prequel/index.html",
        "src/books/the-fatherless/index.html",
        "src/books/sequel/index.html",
    }
    new_artifacts = []
    for artifact in manifest["artifacts"]:
        if artifact["id"] == "hero-trilogy-overview":
            continue
        if artifact["path"] in page_paths:
            artifact["checksum_sha256"] = sha256(ROOT / artifact["path"])
        if artifact["id"] == "hero-age-of-embers":
            artifact.update({
                "path": "src/media/heroes/age-of-embers.webp",
                "summary": "Project-generated cinematic raster artwork of glacial migration beneath a low sun and red sky-fire.",
                "canonical_url": "/media/heroes/age-of-embers.webp",
                "checksum_sha256": sha256(HEROES / "age-of-embers.webp"),
            })
        elif artifact["id"] == "hero-original":
            artifact.update({
                "path": "src/media/heroes/fatherless-original.webp",
                "summary": "Project-generated cinematic raster artwork emphasizing monumental civic authority and human vulnerability.",
                "canonical_url": "/media/heroes/fatherless-original.webp",
                "checksum_sha256": sha256(HEROES / "fatherless-original.webp"),
            })
        elif artifact["id"] == "hero-neurion":
            artifact.update({
                "path": "src/media/heroes/neurion.webp",
                "summary": "Project-generated cinematic raster artwork of a networked future city with distributed signals and plural agency.",
                "canonical_url": "/media/heroes/neurion.webp",
                "checksum_sha256": sha256(HEROES / "neurion.webp"),
            })
        new_artifacts.append(artifact)
    manifest["artifacts"] = new_artifacts
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


def cleanup_obsolete() -> None:
    for name in [
        "trilogy-overview-hero.svg",
        "age-of-embers-hero.svg",
        "fatherless-original-hero.svg",
        "neurion-hero.svg",
    ]:
        (HEROES / name).unlink(missing_ok=True)
    shutil.rmtree(STAGING, ignore_errors=True)


def main() -> None:
    materialize()
    update_pages()
    update_provenance()
    cleanup_obsolete()
    update_manifest()
    for name in ASSETS:
        asset = HEROES / f"{name}.webp"
        print(f"{asset.relative_to(ROOT)} {asset.stat().st_size} bytes sha256={sha256(asset)}")


if __name__ == "__main__":
    main()
