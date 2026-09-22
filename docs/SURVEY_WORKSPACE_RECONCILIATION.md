# Survey workspace: mutation outcomes and read-back

## Scope
Continuation of PR #1761 on its existing branch. No new release branch, database migration, provider dispatch, payment, plan upgrade or change to Vercel preview policy.

## Corrected integration boundaries
- The real admin page propagates a rejected deletion to the real SurveyCard instead of resolving its confirmation as though the operation succeeded.
- Publish, close, delete and QA seed results are separate from a subsequent list refresh. A confirmed write is not labelled failed when the read-back fails.
- Read-back requests opt in to throwOnError. React Query cached data plus an error is not treated as a successful refresh. Default refresh callers receive undefined, not stale data labelled as a successful read.
- A persistent recovery notice explains the stale snapshot. Recovery is read-only, never automatically replays the write and keeps actions blocked until a successful read. Aggregate metrics are not shown as current while that recovery is pending.
- The tenant-keyed workspace discards old filters, dialogs and publication feedback. Mount-lifetime tokens suppress late success, failure, explicit read-back and cleanup effects after navigation, including A-B-A with identical survey IDs. Requests already sent are NOT described as cancelled.
- Local progress reaches both the operational list and conflict section. A synchronous workspace lock rejects overlapping writes before observer rerenders; other cards show their blocked state rather than offering unusable controls.
- A list 401/403 hides cached instruments and counts, including loss of authorization on the next page. A temporary pagination failure still preserves the loaded collection. The detail surface also hides its cached record after its own 401/403.

## Validation boundaries
New tests exercise the real page, card, confirmation hook and workspace lifetime with mocked admin requests, plus the actual React Query hook with mocked API transport. Existing Chromium card tests remain separate: they are not authenticated end-to-end acceptance of the full admin panel.
The workflow retains a machine-readable Vitest report with the card browser evidence so exact counts can be verified without paraphrasing console output. Passing results must be tied to the actual final workflow SHA; this document does not assert that an unexecuted run passed.

## Remaining release acceptance
Authenticated QA login, a disposable instrument, authorized close/delete read-back against the real backend, and verified deployment by an authorized Vercel scope. Production permission and idempotency remain server responsibilities. No protected deployment should be reported as published from an Ignored preview status.
