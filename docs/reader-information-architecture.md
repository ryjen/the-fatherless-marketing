# Reader information architecture

This document defines the public site structure without importing private canon or unpublished story material. It describes routes, reader journeys, and content slots only. Story copy enters this repository through the controlled public-release process.

## Primary navigation

Primary navigation is limited to six destinations:

1. Home — `/`
2. Books — `/books/`
3. Characters — `/characters/`
4. World — `/world/`
5. News — `/news/`
6. About — `/about/`

Secondary destinations such as press, contact, FAQ, feeds, Great Ages, repository information, and accessibility statements must remain contextual or utility navigation unless later usability evidence justifies promotion.

## Audience pathways

### Reader

`Home → Books → selected book → Characters / World → approved excerpt or update`

The reader journey should establish what the trilogy is, where each volume sits, and what public material is available without requiring development knowledge or revealing later-book resolutions.

### Industry and press

`Home / About → Press → approved synopsis, creator information, rights/contact route, approved assets`

Press material is secondary to the reader experience and must contain only explicitly approved public claims and assets.

### Returning reader

`Home → News → release/update item → relevant book or public resource`

News should use durable permalinks and publication dates so returning visitors can distinguish current information from evergreen material.

### Contributor

`About → Project / repository utility link → public contribution and governance documentation`

Repository implementation details must never be required to understand the books or dominate primary navigation.

## Sitemap and stable URLs

```text
/
/books/
/books/prequel/
/books/the-fatherless/
/books/sequel/
/characters/
/characters/{public-slug}/
/world/
/world/great-ages/
/world/{public-slug}/
/news/
/news/{yyyy}/{public-slug}/
/about/
/about/faq/
/press/
/contact/
```

The prequel and sequel route names are structural labels until an approved public title exists. A later approved title may change visible labels without changing the stable route unless there is a deliberate redirect migration.

## Trilogy presentation contract

The three books must be distinct but coherent in public presentation:

- **Prequel:** introduce only its approved era, premise, and immediate story question. Do not explain how it resolves or privately connects symbolic architecture to later books.
- **The Fatherless:** present the approved core premise, public setting/context, and reader-facing conflict. Do not expose endings, hidden thematic machinery, or private canon notes.
- **Sequel:** introduce only approved future context and initiating premise. Do not reveal cross-book resolutions, hidden correspondences, or private system architecture.

Cross-book links may say that the works form a trilogy and may identify chronological order. Any stronger thematic or causal claim requires an explicitly approved public artifact.

## Great Ages

Great Ages belong under `/world/great-ages/`, not primary navigation. The page may contain only explicitly approved public interpretation. Symbolic, religious, astrological, historical, or scientific explanations must remain suggestive rather than presented as authoritative canon unless a specific public artifact has been approved for that claim.

## Page composition

Pages must remain understandable without images or JavaScript. Use semantic headings, meaningful link text, and breadcrumbs on nested routes. Cards may supplement navigation but must not be the only information structure.

Recommended book-page order:

1. title and approved one-line positioning;
2. approved summary/premise;
3. publication status or release information;
4. approved characters/world links;
5. approved excerpt or quotation when available;
6. related news.

## URL policy

- lowercase ASCII slugs with hyphens;
- no file extensions in public canonical URLs;
- one canonical URL per artifact;
- permanent routes should not encode spoiler-sensitive labels;
- published URLs are stable by default;
- redirects are explicit, one-hop where possible, and retained for migrated published URLs;
- withdrawn content returns an intentional replacement, tombstone, or appropriate HTTP status rather than silently pointing to unrelated material;
- canonical URLs must not contain private identifiers, repository coordinates, draft status, or internal release IDs.

## Navigation and accessibility constraints

- maximum six primary navigation destinations;
- no ellipsis-based truncation for primary mobile navigation labels;
- touch targets and text sizing must meet the accessibility work defined by the visual-design issue;
- meaningful document titles and one primary heading per page;
- breadcrumb structure for nested book, character, world, and news pages;
- static HTML must expose the complete information hierarchy before enhancement.
