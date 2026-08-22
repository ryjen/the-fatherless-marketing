# Public release-state contract

The public site may describe only deliberately approved commercial facts. `src/release.json` is the public rendering/configuration input; it is **not** evidence that a private manuscript, beta-reader file, ISBN, retailer URL, or production artifact has been approved for sale.

The safe default is `development` and contains no edition, format, purchase, price, or collector claims.

## States

| State | Public meaning | Required commercial facts | Purchase routes |
| --- | --- | --- | --- |
| `development` | No commercial edition has been announced. | None. `edition` must be `null`. | Forbidden. |
| `announced` | An edition may be named publicly, but is not available for preorder or sale. | Public edition title; release date may remain unknown. | Forbidden. |
| `preorder` | A real approved edition has a real public release date and at least one preorder destination. | Edition title, date, format, destination. | At least one explicit `preorder` format. |
| `released` | At least one real format is available. | Edition title, date, available format and destination. | At least one explicit `available` format. Other formats may remain preorder/unavailable. |
| `superseded` | This edition is no longer current and has an approved replacement public destination. | Historical edition facts plus `replacement_url`. | Active purchase routes forbidden. |
| `withdrawn` | This edition is no longer offered and no replacement is implied. | Historical edition facts. | Active purchase routes forbidden. |

A configured URL never implies availability. Format state is explicit and inactive/sold-out formats must not retain purchase destinations.

## Formats and destinations

Supported format identities are intentionally bounded: `ebook`, `paperback`, `hardcover`, `audiobook`, `direct`, `signed`, and `collector`.

Each format has an explicit state: `unavailable`, `preorder`, `available`, or `sold-out`. Only `preorder` and `available` may carry destinations. Destinations are public HTTPS URLs classified as `retailer`, `direct`, or `distributor`; credentials or secret-bearing URLs are forbidden.

This permits several destinations for one format without making any retailer the edition authority. Removing one destination does not imply that another format or the entire edition is withdrawn.

## Collector editions

Collector/crowdfunding readiness is modeled separately from the ordinary edition state. The collector state may be `disabled`, `planned`, `preorder`, `available`, `sold-out`, or `closed`.

`preorder` and `available` collector states require a real public destination and an ordinary edition state capable of supporting the claim. `sold-out` and `closed` are deliberately different from `withdrawn`: they describe completion/exhaustion rather than recall or invalidation.

The current production config remains `disabled`. No campaign provider, manufacturing promise, fulfillment promise, quantity, price, or delivery date should be added until those facts are actually approved.

## Press kit boundary

`/press/` remains the public press-kit home. It may contain approved synopsis/positioning, creator information, contact routing, and rights-cleared downloadable artwork. Query letters, private pitch decks, manuscripts, screenplay files, contracts, economics, negotiations, and submission history remain outside the public repository.

## Promotion procedure

A state transition should be a bounded public change that:

1. receives only approved public facts from the private commercialization process;
2. updates `src/release.json` explicitly;
3. adds or removes reader-facing purchase/preorder UI only when the validated state permits it;
4. updates public-manifest checksums for affected approved artifacts;
5. passes `mise run check` before merge;
6. never derives readiness from the existence of beta-reader Markdown/DOCX/EPUB files, a configured URL, a cover image, or an external product record alone.

Withdrawal/supersession should remove stale commercial routes while preserving any deliberately retained historical public page. Private approval history remains private and is not reconstructed in this repository.
