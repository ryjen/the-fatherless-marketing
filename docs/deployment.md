# Deployment and domain cutover

## Deployment model

The public site is built from `src/` into generated `dist/` output. Pull requests and `main` use the same validation workflow. A Pages artifact is uploaded only after publication-boundary tests, responsive-media checks, build validation, performance budgets, and Chromium browser smoke tests have passed.

The deployment job has no private-repository checkout, deploy key, Personal Access Token, or cross-repository dependency. It uses the repository-scoped workflow token only for GitHub Pages publication.

`docs/` contains repository documentation and **is not a Pages publishing source**. Do not configure Pages as `Deploy from a branch` using `main:/docs`; that bypasses the validated `dist/` artifact and can expose documentation instead of the intended site.

## One-time GitHub Pages activation

GitHub Pages must be configured with **GitHub Actions** as its source before the normal workflow can deploy. The deploy job checks the Pages API and fails closed if Pages is disabled or configured for legacy branch publishing.

To activate the public origin once:

1. Open repository **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions** — not `Deploy from a branch` / `main:/docs`.
3. Run **Actions → Validate public site → Run workflow** (or push a new validated change to `main`).
4. Confirm that both the validation and deployment jobs succeed.
5. Confirm that the `Verify deployed Pages origin` step succeeds.

Before a custom domain is attached, the expected project origin is:

`https://ryjen.github.io/the-fatherless-marketing/`

Do not change DNS merely because Pages reports a successful legacy build. The direct Pages origin must be produced from the validated Actions artifact and pass live verification first.

## Direct-origin verification

The deployment workflow automatically runs:

```sh
sh scripts/verify-origin.sh "$SITE_URL"
```

The verifier requires HTTPS and checks the home, Books, Characters, World, News, and About routes, the shared versioned stylesheet, the public-site identity marker, and the absence of a private-repository reference on the deployed home page.

For a manual check:

```sh
sh scripts/verify-origin.sh https://ryjen.github.io/the-fatherless-marketing/
```

Record the exact deployed `main` revision and successful workflow run before proceeding to domain cutover.

## Preconditions for custom-domain cutover

- public-content governance and anti-leak controls are in place;
- the intended public artifact passes build and validation from a fresh checkout;
- GitHub Pages reports `build_type: workflow`, not `legacy`;
- the direct Pages origin has passed live verification;
- creative assets have explicit public rights/provenance records;
- no private repository, token, deploy key, or cross-repository dependency is required;
- the intended apex/`www` canonical behavior is recorded before DNS changes;
- the current DNS/Cloudflare records and proxy/cache mode are captured for rollback;
- the previous known-good routing remains recoverable until the new domain path is verified.

## Custom-domain cutover sequence

1. Record the existing apex, `www`, DNS/Cloudflare, redirect, TLS, and cache state.
2. Verify the GitHub Pages project origin again and record its successful workflow run.
3. Configure the intended custom domain in GitHub Pages.
4. Apply only the DNS records required for the chosen apex/`www` behavior.
5. Wait for GitHub to report the custom domain and HTTPS certificate as valid before retiring previous routing.
6. Verify both apex and `www` behavior, HTTPS/TLS, redirects, and representative cached and uncached requests.
7. Run `scripts/verify-origin.sh` against the final canonical HTTPS URL.
8. Confirm versioned styles/assets are current through the DNS/CDN path rather than only at the Pages origin.
9. Keep the previous origin recoverable until the final domain checks pass.
10. Retire superseded public deployment/routing only after the replacement is verified.

If Cloudflare is in front of the domain, treat DNS mode, proxy mode, redirects, and cache rules as explicit cutover state. Do not mask a GitHub Pages domain/TLS failure with a proxy or cache workaround; first establish a valid origin and certificate path.

## Rollback

If origin, DNS, TLS, content integrity, redirect, or cache verification fails:

1. restore the previously recorded DNS/routing state;
2. keep the verified GitHub Pages project origin available for diagnosis;
3. purge or bypass only the affected CDN/cache entries when needed;
4. confirm the previous known-good public route is healthy;
5. correct the failed cutover condition before retrying.

Never recover a failed deployment by granting this public repository access to private systems or by publishing unreviewed source material.

## Build contract

```sh
sh scripts/build.sh
sh scripts/validate.sh
```

`dist/` is generated and is not committed. Deployment automation publishes only validated generated output.
