#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://fatherless.ryanjennin.gs"
MANIFEST = ROOT / "public-manifest.json"

PAGES = {
    "src/index.html": ("/", "/media/heroes/fatherless-original-hero.webp", "website"),
    "src/books/index.html": ("/books/", "/media/heroes/fatherless-original-hero.webp", "website"),
    "src/books/prequel/index.html": ("/books/prequel/", "/media/heroes/age-of-embers-hero.webp", "website"),
    "src/books/the-fatherless/index.html": ("/books/the-fatherless/", "/media/heroes/fatherless-original-hero.webp", "website"),
    "src/books/sequel/index.html": ("/books/sequel/", "/media/heroes/neurion-hero.webp", "website"),
    "src/characters/index.html": ("/characters/", "/media/heroes/fatherless-original-hero.webp", "website"),
    "src/world/index.html": ("/world/", "/media/heroes/fatherless-original-hero.webp", "website"),
    "src/news/index.html": ("/news/", "/media/heroes/fatherless-original-hero.webp", "website"),
    "src/news/2026-08-08-public-trilogy-site/index.html": ("/news/2026-08-08-public-trilogy-site/", "/media/heroes/fatherless-original-hero.webp", "article"),
    "src/press/index.html": ("/press/", "/media/heroes/fatherless-original-hero.webp", "website"),
    "src/about/index.html": ("/about/", "/media/heroes/fatherless-original-hero.webp", "website"),
}

PLACEHOLDERS = {"src/characters/index.html", "src/world/index.html"}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extract(pattern: str, text: str, path: str) -> str:
    match = re.search(pattern, text, flags=re.I | re.S)
    if not match:
        raise SystemExit(f"metadata pattern missing in {path}: {pattern}")
    return match.group(1).strip()


def inject_metadata(relpath: str, canonical: str, image: str, og_type: str) -> None:
    path = ROOT / relpath
    text = path.read_text()
    if 'rel="canonical"' in text:
        return
    title = extract(r"<title>(.*?)</title>", text, relpath)
    description = extract(r'<meta\s+name="description"\s+content="([^"]*)"\s*/?>', text, relpath)
    meta_match = re.search(r'<meta\s+name="description"\s+content="[^"]*"\s*/?>', text, flags=re.I)
    assert meta_match

    url = ORIGIN + canonical
    image_url = ORIGIN + image
    esc_title = html.escape(title, quote=True)
    esc_desc = html.escape(description, quote=True)
    lines = [
        f'<link rel="canonical" href="{url}">',
        f'<link rel="alternate" type="application/atom+xml" title="The Fatherless · News" href="{ORIGIN}/feed.xml">',
        f'<meta property="og:type" content="{og_type}">',
        f'<meta property="og:title" content="{esc_title}">',
        f'<meta property="og:description" content="{esc_desc}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{image_url}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{esc_title}">',
        f'<meta name="twitter:description" content="{esc_desc}">',
        f'<meta name="twitter:image" content="{image_url}">',
    ]
    if relpath in PLACEHOLDERS:
        lines.insert(1, '<meta name="robots" content="noindex,follow">')
    if og_type == "article":
        lines.append('<meta property="article:published_time" content="2026-08-08">')

    block = "\n  " + "\n  ".join(lines)
    text = text[:meta_match.end()] + block + text[meta_match.end():]

    if relpath == "src/index.html":
        structured = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "The Fatherless",
            "url": ORIGIN + "/",
            "description": description,
            "creator": {"@type": "Person", "name": "Ryan Jennings"},
        }
        script = '<script type="application/ld+json">' + json.dumps(structured, ensure_ascii=False) + '</script>'
        text = text.replace("</head>", f"  {script}\n</head>", 1)

    path.write_text(text)


def artifact(*, id: str, path: str, title: str, summary: str, content_type: str, canonical: str,
             state: str = "approved", spoiler: str = "premise", publication_date=None) -> dict:
    return {
        "id": id,
        "path": path,
        "title": title,
        "summary": summary,
        "content_type": content_type,
        "spoiler_tier": spoiler,
        "approval_state": state,
        "rights_status": "repository-authored",
        "provenance_class": "public-native",
        "publication_date": publication_date,
        "canonical_url": canonical,
        "checksum_sha256": sha(ROOT / path),
        "replacement_status": "current",
    }


def main() -> None:
    for relpath, (canonical, image, og_type) in PAGES.items():
        inject_metadata(relpath, canonical, image, og_type)

    manifest = json.loads(MANIFEST.read_text())
    artifacts = manifest["artifacts"]
    by_id = {item["id"]: item for item in artifacts}

    # Promote real editorial surfaces from placeholder state.
    for item_id, summary in {
        "site-placeholder-news": "Dated public development, release, excerpt, appearance, and media updates for the trilogy.",
        "site-placeholder-about": "Public overview of the trilogy, its creator, and the boundary between released and private material.",
    }.items():
        item = by_id[item_id]
        item["approval_state"] = "approved"
        item["spoiler_tier"] = "premise"
        item["summary"] = summary
        item["checksum_sha256"] = sha(ROOT / item["path"])

    # Refresh checksums for already approved pages after metadata injection.
    for item in artifacts:
        if item["path"] in PAGES and item["approval_state"] in {"approved", "published"}:
            item["checksum_sha256"] = sha(ROOT / item["path"])

    new_items = [
        artifact(id="press-industry", path="src/press/index.html", title="Press & Industry", summary="Approved public press positioning, creator information, and downloadable trilogy hero artwork.", content_type="press", canonical="/press/"),
        artifact(id="news-public-trilogy-site", path="src/news/2026-08-08-public-trilogy-site/index.html", title="The trilogy has a public home", summary="Public update announcing the trilogy website presentation without making a publication-date claim.", content_type="news", canonical="/news/2026-08-08-public-trilogy-site/", state="published", publication_date="2026-08-08"),
        artifact(id="style-editorial-v1", path="src/styles/editorial.v1.css", title="Editorial surfaces v1", summary="Shared responsive styles for press, news, about, and public editorial pages.", content_type="site-asset", canonical="/styles/editorial.v1.css"),
        artifact(id="feed-atom", path="src/feed.xml", title="The Fatherless Atom feed", summary="Machine-readable public update feed for readers who do not use a newsletter provider.", content_type="site-asset", canonical="/feed.xml"),
        artifact(id="robots-policy", path="src/robots.txt", title="Robots policy", summary="Public crawler policy and sitemap discovery pointer.", content_type="site-asset", canonical="/robots.txt"),
    ]
    existing_ids = set(by_id)
    artifacts.extend(item for item in new_items if item["id"] not in existing_ids)

    # Generate sitemap only from approved/published reader-facing artifacts.
    reader_types = {"page", "book-summary", "character-profile", "world-note", "great-age-note", "excerpt", "quotation", "news", "faq", "press"}
    urls = []
    for item in artifacts:
        if item["content_type"] in reader_types and item["approval_state"] in {"approved", "published"} and item["replacement_status"] == "current":
            canonical = item.get("canonical_url")
            if canonical:
                urls.append(ORIGIN + canonical)
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sitemap.extend(f"  <url><loc>{html.escape(url)}</loc></url>" for url in sorted(set(urls)))
    sitemap.append('</urlset>')
    (ROOT / "src" / "sitemap.xml").write_text("\n".join(sitemap) + "\n")

    sitemap_item = artifact(id="sitemap", path="src/sitemap.xml", title="Public sitemap", summary="Sitemap containing only approved or published reader-facing public artifacts.", content_type="site-asset", canonical="/sitemap.xml")
    if sitemap_item["id"] not in existing_ids:
        artifacts.append(sitemap_item)

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"finalized {len(PAGES)} HTML pages; sitemap URLs={len(set(urls))}; artifacts={len(artifacts)}")


if __name__ == "__main__":
    main()
