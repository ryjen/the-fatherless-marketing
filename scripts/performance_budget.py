#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


class BudgetError(RuntimeError):
    pass


class ResourceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.resources: set[str] = set()
        self.external: set[str] = set()
        self.blocking_scripts = 0
        self.stylesheets: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key.lower(): value or "" for key, value in attrs}
        urls: list[str] = []
        if tag == "link" and "stylesheet" in data.get("rel", "").lower().split():
            href = data.get("href", "")
            if href:
                urls.append(href)
                self.stylesheets.append(href)
        elif tag == "script" and data.get("src"):
            urls.append(data["src"])
            if "defer" not in data and "async" not in data and data.get("type", "").lower() != "module":
                self.blocking_scripts += 1
        elif tag in {"img", "source", "video", "audio"}:
            for field in ("src", "poster"):
                if data.get(field):
                    urls.append(data[field])
            for candidate in data.get("srcset", "").split(","):
                url = candidate.strip().split(" ", 1)[0]
                if url:
                    urls.append(url)

        for url in urls:
            self.resources.add(url)
            parsed = urlsplit(url)
            if parsed.scheme in {"http", "https"} or parsed.netloc or url.startswith("//"):
                self.external.add(url)


def fail(message: str) -> None:
    raise BudgetError(message)


def validate(root: Path) -> None:
    budget = json.loads((root / "performance-budget.json").read_text())
    dist = root / "dist"
    if not dist.is_dir():
        fail("missing dist/; build before checking performance budgets")

    css_files = list((dist / "styles").glob("*.css")) if (dist / "styles").exists() else []
    css_bytes = sum(path.stat().st_size for path in css_files)
    if css_bytes > budget["max_css_bytes"]:
        fail(f"CSS budget exceeded: {css_bytes} > {budget['max_css_bytes']}")

    html_files = sorted(dist.rglob("*.html"))
    if not html_files:
        fail("no built HTML pages found")

    for path in html_files:
        size = path.stat().st_size
        rel = path.relative_to(dist)
        if size > budget["max_html_bytes"]:
            fail(f"HTML budget exceeded for {rel}: {size} > {budget['max_html_bytes']}")

        parser = ResourceParser()
        parser.feed(path.read_text(errors="ignore"))
        if len(parser.resources) > budget["max_initial_requests"]:
            fail(f"request budget exceeded for {rel}: {len(parser.resources)} > {budget['max_initial_requests']}")
        if len(parser.external) > budget["max_external_requests"]:
            fail(f"external request budget exceeded for {rel}: {sorted(parser.external)}")
        if parser.blocking_scripts > budget["max_render_blocking_scripts"]:
            fail(f"render-blocking script budget exceeded for {rel}: {parser.blocking_scripts}")

        for href in parser.stylesheets:
            filename = Path(urlsplit(href).path).name
            if re.fullmatch(r"[a-z0-9-]+\.v\d+\.css", filename) is None:
                fail(f"stylesheet is not cache-versioned on {rel}: {href}")

    print(f"Performance budgets passed for {len(html_files)} HTML page(s); CSS={css_bytes} bytes.")


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    try:
        validate(root)
    except (BudgetError, OSError, KeyError, json.JSONDecodeError) as exc:
        print(f"performance budget failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
