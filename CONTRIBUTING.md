# Contributing

This repository is a public publication surface. Do not use it for drafting, canon development, editorial notes, research, private publishing records, or unreleased creative material.

## Publication boundary

- Every file under `src/` is deployable and therefore must have exactly one entry in `public-manifest.json`.
- `src/` may contain only `placeholder`, `approved`, or `published` artifacts whose replacement status is `current`.
- Candidate, withdrawn, and superseded material must not live under `src/`; use `staging/` when a public-repository staging record is appropriate.
- The build is manifest-driven. Unmanifested files are rejected rather than copied to `dist/`.

## Before opening a pull request

- Confirm every public artifact has an entry in `public-manifest.json`.
- Confirm spoiler tier, approval state, rights status, public provenance class, and replacement status.
- For media, record creator class, rights basis, attribution requirement, and metadata-review state.
- If attribution is required, include the exact public attribution text.
- Strip embedded metadata, or explicitly mark it `reviewed-retained` and document why retention is safe and necessary.
- Do not include private repository paths or identifiers, private issue or revision references, correspondence, credentials, or internal rationale.
- Keep candidate, withdrawn, and superseded material outside `src/`.
- Review unexpectedly large text additions as possible manuscript or draft leakage.
- Run `python3 -m unittest discover -s tests -v` and `sh scripts/build.sh && sh scripts/validate.sh` before requesting review.

## Review expectations

Public-content changes require human review for spoilers, rights, provenance, privacy, metadata, attribution, and final diff scope. Automation is a guardrail, not an approval authority.

Any change to an approved or published artifact requires a new checksum and re-review.
