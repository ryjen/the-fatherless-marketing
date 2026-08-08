# Public content model

The public content model describes reader-facing artifacts independently of private authoring structure. Public records may simplify or omit canon but must not contradict approved public positioning. Private source paths, revisions, issue references, editorial rationale, and release evidence remain outside this repository.

## Common metadata

Every governed artifact has:

- `id` — stable public identifier;
- `path` — normalized repository-relative source or staging path;
- `title` — public-facing title;
- `summary` — short public-safe description of the artifact's purpose/content;
- `content_type` — one of the public types below;
- `spoiler_tier` — `placeholder`, `premise`, `early-context`, or `approved-excerpt`;
- `approval_state` — `placeholder`, `candidate`, `approved`, `published`, `withdrawn`, or `superseded`;
- `rights_status` — public rights classification;
- `provenance_class` — public-safe provenance class only;
- `publication_date` — ISO `YYYY-MM-DD` date for published material, otherwise `null`;
- `canonical_url` — root-relative public canonical URL for deployable pages/assets, otherwise `null`;
- `checksum_sha256` — exact checksum for approved or published artifacts;
- `replacement_status` — `current`, `withdrawn`, or `superseded`.

Media additionally carries creator class, rights basis, attribution requirements/text, and metadata-review status as defined by the public-content policy.

## Content types

### `page`

Structural public page such as home, index, about, contact, or utility content. It must still be manifest-backed when deployable.

### `book-summary`

Approved reader-facing positioning for one trilogy volume. May include premise, era/context, publication status, and approved links. It must not contain endings, unreleased resolutions, or hidden thematic architecture.

### `character-profile`

Approved public profile for a character. Use only facts safe at the profile's spoiler tier. Relationships, outcomes, identities, or motives not approved for that tier are omitted.

### `world-note`

Approved setting/world explanation. It may simplify private canon. It must not expose research notes, private source reasoning, or undisclosed continuity mechanics.

### `great-age-note`

A specialized world note for explicitly approved Great Age interpretation. Public language should distinguish observed story-world claims, interpretation, symbolism, and real-world reference where relevant rather than collapsing them into one authoritative explanation.

### `excerpt`

Exact approved story text. Requires `approved-excerpt` spoiler tier, exact checksum, rights review, and the private-side release process. Editing after approval invalidates the checksum and approval.

### `quotation`

Short exact approved quotation. Governed like an excerpt, including exact-byte approval when sourced from unpublished text.

### `news`

Dated public update about publication, release, events, or other approved project news. Must not imply publication status or commitments that are not approved.

### `faq`

Public question/answer material. Answers are marketing/editorial copy, not canonical source documentation, and should avoid resolving intentionally ambiguous story questions.

### `press`

Approved synopsis, creator information, release facts, contact routes, and press-ready copy. Industry-facing language remains subordinate to the reader experience.

### `press-asset`

Approved downloadable media or document. Requires complete media provenance, attribution, metadata review, checksum, and rights basis.

## Classification rules

### Spoiler tier

- `placeholder`: no substantive story information;
- `premise`: high-level public setup and positioning;
- `early-context`: approved information from early story context that does not expose later resolutions;
- `approved-excerpt`: exact content explicitly approved for public release.

Embargoed and prohibited material never enters public Git history and therefore are not valid manifest values.

### Approval and replacement state

Deployable `src/` artifacts may be only:

- `placeholder/current`;
- `approved/current`;
- `published/current`.

Candidate, withdrawn, and superseded material must remain outside the deployable tree. Withdrawal or supersession changes both approval and replacement state consistently.

## Canon and marketing separation

Public content is its own approved edition. It is not a mirror of private canon and does not automatically update when private drafts change.

- public omission is allowed;
- public simplification is allowed;
- deliberate ambiguity is allowed;
- contradiction of approved positioning is not allowed;
- private thematic interpretation does not become public canon merely because it informed marketing decisions.

## Static-generation requirements

The model must be renderable as accessible static HTML without JavaScript. Relationships between artifacts are expressed through stable public IDs and canonical URLs, never private coordinates.

Index pages may aggregate approved artifacts by `content_type`, book/collection association, publication date, or explicit public tags. Aggregation must respect spoiler and replacement state and must not infer hidden relationships from private material.

## Lifecycle

1. define a public content slot or candidate;
2. complete private-side editorial/release approval where source material originates privately;
3. create the public artifact with public-only metadata;
4. review final public diff and checksum;
5. publish under its canonical URL;
6. verify deployed output where practical;
7. deliberately correct, withdraw, or supersede when needed.

No lifecycle step performs unattended synchronization from the private authoring repository.
