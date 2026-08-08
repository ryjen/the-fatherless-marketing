# Contributing

This repository is a public publication surface. Do not use it for drafting, canon development, editorial notes, research, private publishing records, or unreleased creative material.

## Before opening a pull request

- Confirm every public artifact has an entry in `public-manifest.json`.
- Confirm spoiler tier, approval state, rights status, and public provenance class.
- For media, record provenance and metadata-review fields in the manifest.
- Remove EXIF or embedded text metadata unless it is intentionally retained and documented.
- Do not include private repository paths, issue references, commit identifiers, correspondence, credentials, or internal rationale.
- Keep candidate material outside `src/`; only approved publication material may become build-visible.
- Review unexpectedly large text additions as possible manuscript or draft leakage.
- Run `sh scripts/build.sh && sh scripts/validate.sh` before requesting review.

## Review expectations

Public-content changes require human review for spoilers, rights, provenance, privacy, metadata, and final diff scope. Automation is a guardrail, not an approval authority.

Any change to an approved or published artifact requires a new checksum and re-review.
