#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'src' / 'styles' / 'home.v2.css'
text = path.read_text()

anchor = ".home-hero__panel {\n  width: min(78rem, 100%);\n  max-width: 78rem;\n  margin: auto;\n  padding: clamp(1rem, 3vw, 2.25rem);\n  border: 0;\n  background: transparent;\n  box-shadow: none;\n  text-align: center;\n}\n"
replacement = anchor + "\nbody.home-page[data-theme='original'] .home-hero__panel {\n  border: 0;\n  background: transparent;\n  box-shadow: none;\n}\n"
if anchor not in text:
    raise SystemExit('hero panel anchor not found')
text = text.replace(anchor, replacement, 1)

old_mobile = "  .home-hero__panel h1 {\n    font-size: clamp(3.2rem, 17vw, 5.5rem);\n    line-height: 0.9;\n  }"
new_mobile = "  .home-hero__panel h1 {\n    font-size: clamp(2.8rem, 14vw, 4rem);\n    line-height: 0.92;\n    overflow-wrap: normal;\n    word-break: normal;\n  }"
if old_mobile not in text:
    raise SystemExit('mobile title anchor not found')
text = text.replace(old_mobile, new_mobile, 1)

path.write_text(text)
