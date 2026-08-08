# Public content policy

This repository is a publication surface, not an authoring workspace. Content enters it only after a deliberate public-release decision.

## Allowed content

- approved synopsis, pitch, and release copy;
- explicitly approved excerpts and quotations;
- non-spoiler character and world material;
- approved artwork, logos, covers, and press assets;
- public development news and release information;
- public contact, feed, and newsletter copy.

## Prohibited content

- manuscripts, scene drafts, canonical outlines, unreleased endings, or working canon;
- private story foundations, symbolism notes, character-arc architecture, research, prompts, editorial notes, TODOs, or review discussions;
- private source paths, repository identifiers, issue references, commit identifiers, or unpublished provenance;
- submissions, contracts, private correspondence, beta-reader information, payment/identity data, or other personal data;
- credentials, secrets, deploy keys, private-host URLs, or cross-repository access tokens;
- assets without confirmed public rights and provenance.

## Publication boundary

`src/` is the deployable source boundary. Every file under `src/` must have exactly one public manifest entry. The build reads the manifest and copies only valid deployable entries; it never blindly copies the source tree.

Only artifacts with approval state `placeholder`, `approved`, or `published` and replacement status `current` may live under `src/`. Candidate, withdrawn, and superseded material must remain outside the deployable tree. `staging/` may hold material that is intentionally present in the public repository but not deployable.

## Required classifications

Every governed artifact must have a public manifest entry with:

- stable public ID;
- normalized repository-relative public or staging path;
- content type;
- spoiler tier;
- approval state;
- rights status;
- public provenance class;
- checksum for approved or published artifacts;
- replacement or withdrawal status.

The public manifest must never contain private source paths, private revision identifiers, private issue references, or internal editorial rationale.

## Spoiler tiers

- `placeholder` — temporary non-story material;
- `premise` — safe high-level premise or positioning;
- `early-context` — approved early-story context;
- `approved-excerpt` — exact excerpt approved for publication;
- `embargoed` — not permitted in the public repository;
- `prohibited` — never permitted in the public repository.

Only the first four tiers may be committed, and `embargoed` material must remain outside public Git history entirely.

## Approval states

- `placeholder`
- `candidate`
- `approved`
- `published`
- `withdrawn`
- `superseded`

Candidate material may be staged only when it contains no private metadata and is clearly excluded from generated public output. Story content should normally enter the deployable tree only at `approved` or later. Withdrawn and superseded artifacts are invalid in `src/`.

## Asset provenance

Before publication, identify whether each asset is author-created, commissioned, generated, stock, public-domain, historical, or contributor-owned. Confirm public-use rights, required attribution, provider/model terms where relevant, and embedded metadata disposition.

All recognized media formats require a metadata review state. Metadata must either be stripped or explicitly reviewed and retained. Retained metadata requires a public-safe rationale. When attribution is required, the exact attribution text must be recorded in the manifest.

## Review checklist

Before merging public content:

1. confirm spoiler tier, approval state, and replacement state;
2. confirm rights/provenance and required attribution text;
3. inspect for private paths, identifiers, comments, TODOs, metadata, and personal data;
4. strip embedded metadata unless deliberately retained, reviewed, and justified;
5. verify every deployable file is manifest-backed and the final diff contains only expected files and volume;
6. generate or update the public manifest checksum for the exact approved artifact;
7. run the negative regression tests, then build and validate from a fresh checkout;
8. after publication, verify the deployed bytes where practical.

Any change to an approved or published artifact invalidates its previous checksum and requires re-review.

## Withdrawal and correction

Withdrawn material must leave `src/` immediately and be removed from generated navigation, feeds, sitemaps, downloadable bundles, and controlled caches where practical. Corrections and replacements use a new checksum and retain a public-safe status trail without exposing private rationale.
