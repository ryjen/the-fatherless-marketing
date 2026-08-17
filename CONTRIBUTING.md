# Contributing

This repository is a public publication surface. Do not use it for drafting, canon development, editorial notes, research, private publishing records, or unreleased creative material.

## Publication boundary

- Every file under `src/` is deployable and must have exactly one entry in `public-manifest.json`.
- `src/` may contain only `placeholder`, `approved`, or `published` artifacts whose replacement status is `current`.
- Candidate, withdrawn, and superseded material must not live under `src/`; use `staging/` when a public-repository staging record is appropriate.
- The build is manifest-driven. Unmanifested files are rejected rather than copied to `dist/`.

## Before opening a pull request

- Confirm every public artifact has a manifest entry.
- Confirm spoiler tier, approval state, rights status, provenance class, replacement status, and checksum where required.
- For media, record creator class, rights basis, attribution requirement, and metadata-review state.
- Strip embedded metadata, or explicitly mark it `reviewed-retained` and document why retention is safe and necessary.
- Do not include private repository paths or identifiers, private issue/revision references, correspondence, credentials, or internal rationale.
- Keep candidate, withdrawn, and superseded material outside `src/`.
- Review unexpectedly large text additions as possible manuscript/draft leakage.
- Run the same entrypoint used by CI:

```sh
mise run check
```

JavaScript is the only custom scripting language. Generic runtime/task management belongs in `mise.toml`; publication/build/media/deployment-diagnostic project logic belongs in `tools/site.mjs`; browser behavior belongs in Playwright specs.

## Review expectations

Public-content changes require human review for spoilers, rights, provenance, privacy, metadata, attribution, and final diff scope. Automation is a guardrail, not an approval authority.

Any change to an approved or published artifact requires a new checksum and re-review.
