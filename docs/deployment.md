# Deployment and domain cutover

## Deployment model

The public site is built from `src/` into generated `dist/` output. Pull requests and `main` use the same `mise run check` task graph: publication-boundary contracts, responsive-media checks, manifest-driven build validation, performance budgets, and Chromium browser smoke.

GitHub Pages deploys only the validated `dist/` artifact. The deployment job has no private-repository checkout, deploy key, Personal Access Token, or cross-repository dependency.

`docs/` is repository documentation and **is not a Pages publishing source**. Pages must remain configured as **Settings → Pages → Source: GitHub Actions**.

## Tooling

JavaScript is the only custom scripting language. Deployment diagnostics are subcommands of `tools/site.mjs`:

```sh
node tools/site.mjs pages-state
node tools/site.mjs origin https://ryjen.github.io/the-fatherless-marketing/
node tools/site.mjs origin https://fatherless.ryanjennin.gs/
node tools/site.mjs cloudflare https://fatherless.ryanjennin.gs/
```

For normal development and validation, use the shared task front door:

```sh
mise run check
```

## GitHub Pages activation

GitHub Pages must use **GitHub Actions** as its source before the deployment workflow can succeed. `tools/site.mjs pages-state` checks the Pages API and fails closed when Pages is disabled or configured for legacy branch publishing.

One-time activation:

1. Open repository **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Run **Actions → Validate public site → Run workflow** or push a validated change to `main`.
4. Confirm validation and deployment jobs succeed.
5. Confirm live deployment verification succeeds.

Before custom-domain attachment, the expected project origin is:

`https://ryjen.github.io/the-fatherless-marketing/`

## Deployment verification

GitHub Pages publication is a hard gate. The workflow requires `build_type: workflow`, publishes only the validated artifact, and fails if the Pages deployment fails.

Without a custom domain, `tools/site.mjs origin` hard-verifies representative routes and the current base stylesheet.

With a custom domain behind Cloudflare, the workflow runs both `origin` and `cloudflare` diagnostics. The Cloudflare probe checks:

- HTTPS remains on the configured canonical host;
- the current public-site identity marker is present;
- a `cf-ray` header demonstrates Cloudflare traversal;
- plaintext HTTP redirects to HTTPS on the canonical host;
- `styles/base.v1.css` contains the expected current visual token;
- cache/server headers are reported for diagnosis.

Cloudflare can intentionally reject GitHub-hosted datacenter traffic. For that reason the custom-domain edge probe is diagnostic after a successful Pages deployment. Do not add a broad WAF bypass merely to make hosted CI green; verify in a normal browser and review Cloudflare Security events first.

## Custom-domain cutover

Before DNS changes:

- confirm public-content governance and anti-leak controls pass;
- confirm the intended artifact passes `mise run check` from a fresh checkout;
- confirm GitHub Pages reports `build_type: workflow`;
- verify the direct Pages project origin;
- confirm creative assets have explicit public rights/provenance records;
- record current DNS/Cloudflare proxy, TLS, redirect, and cache state for rollback.

Cutover sequence:

1. Verify the direct Pages origin and record the successful workflow run.
2. Configure the intended custom domain in GitHub Pages.
3. Apply only the DNS records required for that domain.
4. Verify the custom domain over HTTPS in a normal browser.
5. Verify representative routes and the current versioned stylesheet through Cloudflare.
6. Confirm HTTP redirects to the canonical HTTPS host.
7. Keep the prior known-good route recoverable until final verification passes.

## Cloudflare edge contract

GitHub Pages remains the origin; Cloudflare may provide public TLS/proxy/cache behavior.

For `fatherless.ryanjennin.gs`:

- DNS should resolve the custom subdomain to the GitHub Pages user domain;
- use end-to-end authenticated origin TLS (`Full (strict)`) once the Pages origin certificate is available;
- do not use `Flexible` as steady state;
- HTTP must redirect to the canonical HTTPS host;
- versioned stylesheet content must match the deployed build;
- avoid unversioned long-lived CSS caching.

A diagnostic edge failure does not undo a successful GitHub Pages deployment. A public-browser failure, stale content, Pages deployment failure, or confirmed Cloudflare routing/TLS misconfiguration is still a real cutover failure.

## Rollback

If origin, DNS, TLS, content integrity, redirect, or cache verification fails:

1. restore the previously recorded DNS/routing state;
2. keep the verified Pages project origin available for diagnosis;
3. if Cloudflare is the fault domain, temporarily bypass the proxy while preserving the DNS target and diagnose against Pages directly;
4. purge or bypass only affected cache entries when needed;
5. confirm the previous known-good route is healthy;
6. correct the failed condition before retrying.

Never recover a failed deployment by granting this public repository access to private systems or by publishing unreviewed source material.
