#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGING = ROOT / "staging" / "raster-seed"
HEROES = ROOT / "src" / "media" / "heroes"

ASSETS = {
    "age-of-embers-hero": ("v2-age.part-*.b64", "79bd99658981ea7130c8a0a5ce966ee4bd7e2523260fe7e49bebf5faeb0d9d65"),
    "fatherless-original-hero": ("v2-original.part-*.b64", "553e58306661c76dcca6721ceaef21eda8b0e544ccd657528e72118917c93f73"),
    "neurion-hero": ("v2-neurion.part-*.b64", "c8ae4b7026e6eff0521d7e589d4d2411884d685fd59dc4b23e08057439316428"),
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def clean_text(path: Path) -> str:
    return re.sub(r"\s+", "", path.read_text())


def padded(text: str) -> str:
    return text + "=" * ((-len(text)) % 4)


def decode_asset(name: str, pattern: str, expected: str) -> bytes:
    parts = sorted(STAGING.glob(pattern))
    if not parts:
        raise SystemExit(f"missing seed parts for {name}: {pattern}")
    texts = [clean_text(part) for part in parts]
    candidates: list[tuple[str, bytes]] = []
    joined = "".join(texts)
    try:
        candidates.append(("joined", base64.b64decode(padded(joined), validate=False)))
    except Exception:
        pass
    try:
        candidates.append(("per-part", b"".join(base64.b64decode(padded(text), validate=False) for text in texts)))
    except Exception:
        pass
    try:
        no_internal_padding = "".join(text.rstrip("=") for text in texts)
        candidates.append(("strip-internal-padding", base64.b64decode(padded(no_internal_padding), validate=False)))
    except Exception:
        pass
    seen = []
    for mode, data in candidates:
        actual = digest(data)
        seen.append(f"{mode}={actual}:{len(data)}")
        if actual == expected:
            if not (data.startswith(b"RIFF") and data[8:12] == b"WEBP"):
                raise SystemExit(f"hash matched but {name} is not WebP")
            if b"EXIF" in data or b"XMP " in data:
                raise SystemExit(f"embedded metadata marker found in {name}")
            print(f"{name}: {mode}, {len(data)} bytes, sha256={actual}")
            return data
    raise SystemExit(f"could not reconstruct {name}; expected={expected}; candidates={'; '.join(seen)}")


def replace(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old}")
    path.write_text(text.replace(old, new))


def sha256_file(path: Path) -> str:
    return digest(path.read_bytes())


def update_pages() -> None:
    home = ROOT / "src" / "index.html"
    replace(home, 'media/heroes/fatherless-original-hero.svg" width="1440" height="810"', 'media/heroes/fatherless-original-hero.webp" width="1200" height="675"')
    replace(home, 'media/heroes/age-of-embers-hero.svg" width="1440" height="810"', 'media/heroes/age-of-embers-hero.webp" width="1200" height="675"')
    replace(home, 'media/heroes/neurion-hero.svg" width="1440" height="810"', 'media/heroes/neurion-hero.webp" width="1200" height="675"')

    prequel = ROOT / "src" / "books" / "prequel" / "index.html"
    replace(prequel, '../../media/heroes/age-of-embers-hero.svg" width="2400" height="1350"', '../../media/heroes/age-of-embers-hero.webp" width="1200" height="675"')

    original = ROOT / "src" / "books" / "the-fatherless" / "index.html"
    replace(original, '../../media/heroes/fatherless-original-hero.svg" width="2400" height="1350"', '../../media/heroes/fatherless-original-hero.webp" width="1200" height="675"')
    original.write_text(original.read_text().replace("people living under Roman power", "people living under the Republic's power"))

    sequel = ROOT / "src" / "books" / "sequel" / "index.html"
    replace(sequel, '../../media/heroes/neurion-hero.svg" width="2400" height="1350"', '../../media/heroes/neurion-hero.webp" width="1200" height="675"')


def update_provenance() -> None:
    (ROOT / "docs" / "image-provenance.md").write_text("""# Hero image provenance

The production hero artwork is project-generated raster imagery created specifically for the marketing site. It does not incorporate stock photography, private authoring files, manuscript imagery, logos, or third-party source assets.

| Asset | Creator class | Rights basis | Metadata | Public use |
| --- | --- | --- | --- | --- |
| `age-of-embers-hero.webp` | generated | Project-generated original artwork approved for this public release | stripped | prequel hero and trilogy card |
| `fatherless-original-hero.webp` | generated | Project-generated original artwork approved for this public release | stripped | homepage landing hero, original hero, and trilogy card |
| `neurion-hero.webp` | generated | Project-generated original artwork approved for this public release | stripped | sequel hero and trilogy card |

## Production decision

The approved public assets are compact 1200 x 675 WebP files. They preserve the cinematic environmental compositions while keeping the three production files small enough that an additional derivative matrix is not required for this release.

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
""")


def update_manifest() -> None:
    path = ROOT / "public-manifest.json"
    manifest = json.loads(path.read_text())
    page_paths = {
        "src/index.html",
        "src/books/prequel/index.html",
        "src/books/the-fatherless/index.html",
        "src/books/sequel/index.html",
    }
    output = []
    for artifact in manifest["artifacts"]:
        if artifact["id"] == "hero-trilogy-overview":
            continue
        if artifact["path"] in page_paths:
            artifact["checksum_sha256"] = sha256_file(ROOT / artifact["path"])
        if artifact["id"] == "hero-age-of-embers":
            artifact.update({
                "path": "src/media/heroes/age-of-embers-hero.webp",
                "summary": "Project-generated cinematic raster artwork of glacial migration beneath a low sun and red sky-fire.",
                "canonical_url": "/media/heroes/age-of-embers-hero.webp",
                "checksum_sha256": sha256_file(HEROES / "age-of-embers-hero.webp"),
            })
        elif artifact["id"] == "hero-original":
            artifact.update({
                "path": "src/media/heroes/fatherless-original-hero.webp",
                "summary": "Project-generated cinematic raster artwork emphasizing monumental civic authority and human vulnerability.",
                "canonical_url": "/media/heroes/fatherless-original-hero.webp",
                "checksum_sha256": sha256_file(HEROES / "fatherless-original-hero.webp"),
            })
        elif artifact["id"] == "hero-neurion":
            artifact.update({
                "path": "src/media/heroes/neurion-hero.webp",
                "summary": "Project-generated cinematic raster artwork of a networked future city with distributed signals and plural agency.",
                "canonical_url": "/media/heroes/neurion-hero.webp",
                "checksum_sha256": sha256_file(HEROES / "neurion-hero.webp"),
            })
        output.append(artifact)
    manifest["artifacts"] = output
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


def add_regression_test() -> None:
    test = ROOT / "tests" / "test_production_hero_media.py"
    test.write_text("""import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ProductionHeroMediaTests(unittest.TestCase):
    def test_public_pages_use_raster_heroes(self):
        pages = [
            ROOT / 'src' / 'index.html',
            ROOT / 'src' / 'books' / 'prequel' / 'index.html',
            ROOT / 'src' / 'books' / 'the-fatherless' / 'index.html',
            ROOT / 'src' / 'books' / 'sequel' / 'index.html',
        ]
        combined = chr(10).join(page.read_text() for page in pages)
        self.assertNotIn('-hero.svg', combined)
        for name in ('age-of-embers-hero.webp', 'fatherless-original-hero.webp', 'neurion-hero.webp'):
            self.assertIn(name, combined)
            self.assertTrue((ROOT / 'src' / 'media' / 'heroes' / name).is_file())

    def test_retired_seed_and_vector_assets_are_absent(self):
        self.assertFalse((ROOT / 'staging' / 'raster-seed').exists())
        for name in ('trilogy-overview-hero.svg', 'age-of-embers-hero.svg', 'fatherless-original-hero.svg', 'neurion-hero.svg'):
            self.assertFalse((ROOT / 'src' / 'media' / 'heroes' / name).exists())


if __name__ == '__main__':
    unittest.main()
""")


def cleanup() -> None:
    for name in (
        "trilogy-overview-hero.svg",
        "age-of-embers-hero.svg",
        "fatherless-original-hero.svg",
        "neurion-hero.svg",
    ):
        (HEROES / name).unlink(missing_ok=True)
    shutil.rmtree(STAGING, ignore_errors=True)


def main() -> None:
    HEROES.mkdir(parents=True, exist_ok=True)
    for name, (pattern, expected) in ASSETS.items():
        data = decode_asset(name, pattern, expected)
        (HEROES / f"{name}.webp").write_bytes(data)
    update_pages()
    update_provenance()
    cleanup()
    update_manifest()
    add_regression_test()


if __name__ == "__main__":
    main()
