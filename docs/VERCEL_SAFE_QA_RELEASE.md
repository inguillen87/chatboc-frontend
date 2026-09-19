# Safe QA release and Git Preview policy

## Scope and diagnosed failure

On 2026-09-19, the build log for `dpl_AHU5gV1PwrMZxG3qVsBMXkaCa1er`
confirmed that the existing Preview rewrite guard rejected the canonical
production API destinations. This was an intentional routing safeguard, not a
TypeScript compilation failure. The authenticated local Vercel CLI could inspect
the deployment even though the Vercel connector returned a team-scope 403.

## Policy

`vercel.json` binds `ignoreCommand` to the dependency-free
`scripts/vercelGitPreviewPolicy.mjs`. Only Preview builds with a recognized Git
provider and a complete Git SHA are skipped. Vercel interprets exit 0 as skip and
exit 1 as continue. Production, local CLI and incomplete/unknown contexts continue
their existing pipeline. An unexpected context therefore still reaches the
rewrite guard; the policy does not authorize an unsafe build.

No rewrite, permission, secret, provider setting or production alias is changed.
The existing guard and the exact eight-route QA contract remain intact.
Ignored Git builds are not successful deployment or acceptance evidence.

## Consolidated QA procedure

1. Start from the preserved September branch; fetch and verify the remote head.
   Run `npm ci`, both TypeScript checks, the full suite and `npm run test:release`.
2. Commit the reviewed batch once. Keep the working tree clean. Link the known
   ChatBoc project and run `vercel pull --yes --environment=preview --scope
   marcelos-projects-c26aa499`. Never commit the downloaded environment files.
3. Run `scripts/buildVercelPreviewQa.ps1` in PowerShell. Require its final
   `chatboc.frontend.preview-build.v1` receipt, exact HEAD, eight Preview routes,
   zero Production API routes, and exit 0. Do not replace the canonical config or
   set guard overrides outside that bound script. Normal CLI stderr is not an
   exit-status check: avoid wrappers that treat every native stderr line as fatal.
4. Deploy only that output with `vercel deploy --prebuilt --yes --scope
   marcelos-projects-c26aa499`. Inspect READY state, compiled routes and immutable
   HTML revision before changing an alias. Store the previous QA deployment ID.
5. Re-read `chatboc-r2-preview.vercel.app` immediately before aliasing. If its
   deployment differs from the recorded baseline, stop and reconcile. Change only
   this QA alias, then verify the served revision and same-origin API behavior.
   The bundle deliberately targets this authorized QA origin; an immutable-host
   check alone does not certify the final browser/API authentication flow.

## Acceptance and rollback

A complete WhatsApp workspace acceptance needs an authorized real tenant: catalog
identity/permissions, local draft creation, matching receipt, read-back and explicit
retry with the same operation identity. Synthetic browser responses do not satisfy
that gate. Do not use the isolated Conversa demo account as a full SaaS identity.
No Meta/Twilio messages or approval requests are part of this release procedure.

For QA rollback, re-read the current alias and restore its recorded predecessor
only if it still points to this release. Never roll back another operator's change.
Production needs separate authenticated/backend-contract acceptance and a build
verified against production configuration. Do not promote the QA-bound artefact.
Record exact commit, CI result, candidate ID, aliases, probes and unresolved gates
in the PR after execution; a build marked READY is not a production acceptance.

Reference: https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
