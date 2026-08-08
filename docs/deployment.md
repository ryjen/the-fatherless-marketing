# Deployment and domain cutover

## Current state

The repository is in bootstrap mode. CI may build and validate placeholder content, but production publication and custom-domain activation are deliberately deferred.

## Preconditions for production activation

- public-content governance and anti-leak controls are in place;
- the intended public artifact passes build and validation from a fresh checkout;
- creative assets have explicit public rights/provenance records;
- no private repository, token, deploy key, or cross-repository dependency is required;
- the Pages origin can be verified before retiring any previous public origin;
- apex and `www` behaviour are documented;
- TLS certificate issuance and renewal are verified;
- Cloudflare/DNS cache behaviour is understood;
- rollback can restore the previous known-good public origin without exposing private material.

## Cutover sequence

1. Deploy the validated public artifact to the new Pages origin without changing the custom domain.
2. Verify HTML, assets, redirects, canonical URLs, and cache headers directly against that origin.
3. Record the exact deployed revision and validation result.
4. Apply the custom-domain/DNS change.
5. Verify apex and `www`, HTTPS/TLS, redirects, and representative cached/uncached requests.
6. Keep the previous origin available until the new path is verified.
7. Retire the superseded public deployment only after verification.

## Rollback

If origin, DNS, TLS, content integrity, or cache verification fails, restore the previous known-good routing. Do not work around a failed cutover by granting this repository access to private systems or by publishing unreviewed source material.

## Build contract

```sh
sh scripts/build.sh
sh scripts/validate.sh
```

`dist/` is generated and is not committed. Deployment automation should publish only validated generated output.
