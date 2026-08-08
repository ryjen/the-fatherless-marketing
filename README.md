# The Fatherless — Public Site

Public, reader-facing repository for *The Fatherless* trilogy.

This repository contains only material intentionally approved for public release. Canonical manuscripts, drafts, story foundations, editorial notes, private publishing records, and unreleased creative assets do not belong here.

## Repository boundary

- Public website source, approved excerpts, approved artwork, press material, release information, and deployment configuration live here.
- Private authoring and canon development remain outside this repository.
- This repository must build and deploy without access to any private repository, private token, or cross-repository secret.
- Public history must remain clean: do not mirror, subtree, or transplant private Git history.

## Development

The site is static HTML/CSS with a manifest-authoritative publication boundary. Python performs source/build validation; Node dependencies are development-only tooling for responsive-media generation and Chromium smoke tests.

```sh
sh scripts/build.sh
sh scripts/validate.sh
```

For the complete visual validation suite:

```sh
npm install --no-package-lock --no-audit --no-fund
node tests/test-responsive-media.mjs
npx playwright install chromium
# serve dist/ and run tests/browser-smoke.spec.js with SITE_BASE_URL set to the served base path
```

Generated output is written to `dist/` and must be reproducible from committed public source files. See `docs/visual-system.md` for visual, accessibility, media, cache, and performance conventions.

## Deployment

CI validates every pull request and push to `main`. Production Pages/custom-domain activation is intentionally deferred until the public-content policy and cutover checklist are satisfied. See `docs/deployment.md`.

## Rights

Repository code is covered by `LICENSE`. Story text, excerpts, artwork, logos, names, and other creative assets are governed separately by `RIGHTS.md` unless an individual asset states otherwise.
