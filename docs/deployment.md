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
5. Confirm that the deployed site verification succeeds.

Before a custom domain is attached, the expected project origin is:

`https://ryjen.github.io/the-fatherless-marketing/`

Do not change DNS merely because Pages reports a successful legacy build. The direct Pages origin must be produced from the validated Actions artifact and pass live verification first.

## Deployment verification

GitHub Pages publication is a hard deployment gate. The workflow requires `build_type: workflow`, publishes only the validated artifact, and fails if the Pages deployment itself fails.

With no custom domain, the workflow also hard-verifies the Pages deployment URL. With a custom domain behind Cloudflare, the workflow probes `https://<custom-domain>/` after deployment, but that probe is diagnostic rather than a publication gate. Cloudflare security policy can intentionally reject GitHub-hosted datacenter traffic even when the public site is healthy in a normal browser.

The verifiers check HTTPS, representative routes, the public-site identity marker, canonical-host retention, HTTP-to-HTTPS behavior, Cloudflare presence, and the current versioned stylesheet when the edge permits automated access.

For a manual project-origin check:

```sh
sh scripts/verify-origin.sh https://ryjen.github.io/the-fatherless-marketing/
```

For the production custom domain:

```sh
sh scripts/verify-origin.sh https://fatherless.ryanjennin.gs/
sh scripts/verify-cloudflare.sh https://fatherless.ryanjennin.gs/
```

If Cloudflare returns 403 specifically to a GitHub-hosted runner while a normal browser succeeds, do not add a broad WAF bypass merely to make CI green. Record the GitHub-runner denial as an edge-security diagnostic, verify the public hostname in a normal browser, and review the corresponding Cloudflare Security event if deeper attribution is needed.

## Preconditions for custom-domain cutover

- public-content governance and anti-leak controls are in place;
- the intended public artifact passes build and validation from a fresh checkout;
- GitHub Pages reports `build_type: workflow`, not `legacy`;
- the direct Pages project origin was verified before custom-domain attachment;
- creative assets have explicit public rights/provenance records;
- no private repository, token, deploy key, or cross-repository dependency is required;
- the intended custom-domain behavior is recorded before DNS changes;
- the current DNS/Cloudflare records and proxy/cache mode are captured for rollback;
- the previous known-good routing remains recoverable until the new domain path is verified.

## Custom-domain cutover sequence

1. Record the existing custom-domain, DNS/Cloudflare, redirect, TLS, and cache state.
2. Verify the GitHub Pages project origin and record its successful workflow run before attaching the custom domain.
3. Configure the intended custom domain in GitHub Pages.
4. Apply only the DNS records required for the chosen custom-domain behavior.
5. Verify the custom domain over HTTPS in a normal browser before retiring previous routing.
6. Verify representative routes and the current versioned stylesheet through the Cloudflare edge.
7. Confirm HTTP requests are redirected to the canonical HTTPS host in Cloudflare configuration or an allowed edge probe.
8. Confirm versioned styles/assets are current through the DNS/CDN path rather than only at the Pages origin.
9. Keep the previous origin recoverable until the final domain checks pass.
10. Retire superseded public deployment/routing only after the replacement is verified.

## Cloudflare edge contract

The production edge is Cloudflare while GitHub Pages remains the origin and GitHub Actions remains the only publishing mechanism.

For `fatherless.ryanjennin.gs`:

- the DNS record must resolve the custom subdomain to the GitHub Pages user domain, not to a repository path;
- Cloudflare proxying may provide the public TLS edge and cache layer;
- use end-to-end authenticated origin TLS (`Full (strict)`) once the GitHub Pages origin certificate is available; do not use `Flexible` as the steady-state mode;
- HTTP must redirect to the canonical HTTPS host;
- HTML may be dynamic or cached according to Cloudflare policy, but versioned stylesheet content must match the deployed build;
- avoid unversioned long-lived CSS caching, which can recreate the historical stale-style/readability failure mode.

`scripts/verify-cloudflare.sh` is an edge diagnostic. When Cloudflare permits the GitHub-hosted runner, it verifies:

- the HTTPS custom domain returns the current public-site marker;
- a `cf-ray` header proves the request traversed Cloudflare;
- plaintext HTTP redirects to HTTPS on the canonical host;
- `styles/base.v1.css` contains the current expected visual token;
- Cloudflare cache status for the home page and stylesheet is printed into the deployment log for diagnosis.

A diagnostic failure does not undo a successful GitHub Pages deployment. The workflow records it as a warning because a WAF/bot policy that blocks cloud-datacenter automation can be intentional. A public-browser failure, stale content, a Pages deployment failure, or a confirmed Cloudflare routing/TLS misconfiguration remains a real cutover failure.

GitHub's Pages API may temporarily report `https_enforced: false` or an `http://` custom-domain URL while the public Cloudflare HTTPS edge already works. GitHub's own **Enforce HTTPS** setting should still be enabled when available so the origin path is also HTTPS-only.

## Rollback

If origin, DNS, TLS, content integrity, redirect, or cache verification fails:

1. restore the previously recorded DNS/routing state;
2. keep the verified GitHub Pages project origin available for diagnosis;
3. if Cloudflare itself is the fault domain, temporarily bypass the proxy while preserving the custom-domain DNS target and diagnose against Pages directly;
4. purge or bypass only the affected CDN/cache entries when needed;
5. confirm the previous known-good public route is healthy;
6. correct the failed cutover condition before retrying.

Never recover a failed deployment by granting this public repository access to private systems or by publishing unreviewed source material.

## Build contract

```sh
sh scripts/build.sh
sh scripts/validate.sh
```

`dist/` is generated and is not committed. Deployment automation publishes only validated generated output.
