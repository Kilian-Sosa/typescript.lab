# OAuth fragment logging finding

**Date:** 2026-10-17. **Spec impact: no spec change:** restore the existing requirement that authentication credentials and private content stay out of logs. This does not change scopes, database contracts or hosted security policy.

During owner-authorized hosted authentication verification, the app's Router scroll behavior forwarded an entire OAuth callback fragment as a CSS selector. Vue Router's invalid-selector warning included the fragment, and Vite forwarded the browser warning to local dev-server output. It was discovered when the server was stopped. The output contained Supabase session and GitHub provider tokens. No values are reproduced here; the OAuth App client secret was not read or exposed, and no credential was committed or pushed to Git.

## Containment

- The tested Supabase session had already been signed out with local scope; disposable SQL/API records were independently verified absent.
- The local development server was stopped and the disposable local verifier removed.
- The owner elected to revoke only the new `typescript.lab` GitHub OAuth authorization personally, invalidating its provider access/refresh tokens while retaining the registered OAuth App and Supabase configuration. Completion of that owner step is not assumed.
- Already issued Supabase access JWTs may remain valid until expiry despite sign-out. Do not claim immediate invalidation or introduce unapproved key rotation, user deletion, RLS changes or additional migrations. No real private records should be added before that exposure window ends.

## Fix and verification

The Router now looks up a decoded fragment with `document.getElementById` and returns an existing element only. Missing/opaque fragments and malformed encoding fall back to the top position. Raw callback fragments are never passed to Vue Router's selector/diagnostic path; ordinary and encoded HTML anchors still work.

Four unit regressions were observed failing before the fix and passing afterward. The full suite passes 100 tests, with strict Vue/TypeScript and production build checks. All 22 desktop/mobile browser checks pass; two opt-in local-auth cases are intentionally skipped. A browser regression uses synthetic callback strings with hosted authentication disabled and asserts that neither fixture value reaches console diagnostics. No real credential is used by the regression tests.

This fixes the demonstrated logging path; it does not claim completion of explicit callback/denial presentation, editor recovery or autosave. Credential containment status must remain distinct from successful hosted configuration/session tests. The app/runner remains undeployed and learner execution disabled.
