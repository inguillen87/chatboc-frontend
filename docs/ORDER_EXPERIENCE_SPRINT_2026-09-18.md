# Order experience and resilient verification — 2026-09-18

## Release scope

Extends PR #1737 on the reconciled September frontend lineage. No new backend
endpoint, provider credentials, public aliases or business data are introduced.
The checkout continues to reject query-string claims of successful payment.

## Implemented

- A reusable verification panel with semantic state colors, light/dark themes,
  one screen-reader live status region and a machine-readable last-check time.
- Payment state remains separate from the explicit commercial stage. No progress
  percentage, estimated delivery or completed milestone is fabricated.
- A short CSS entrance and refresh animation. Both OS reduced-motion and the
  application's `.a11y-reduced-motion` preference suppress motion. No new package.
- Same-order refresh preserves the products, amounts and timestamp rather than
  blanking the page. Transient errors clearly label the last confirmed state.
- A different tenant, order or loader identity clears the previous snapshot;
  401/403/404 and mismatched-order responses remove data and timestamp.
- Each request has a 15-second deadline and cancellation. Late data cannot turn a
  timed-out check into a success. Existing maximum of seven automatic reads stays.
- Offline/hidden tabs pause through browser events, without recurring wakeup
  timers. Resume does not restart a completed or failed check automatically.
- Initial loading uses a static skeleton, never fabricated totals. The missing-ID
  screen directs users to recover the original order, not create a duplicate.
- Removed duplicate payment-status cards; improved wrapping and keyboard controls.

The client-side privacy guarantees are not a replacement for server authorization.
A preserved successful response is historical, not proof that access cannot change.

## Validation executed on this source cut

- Full Vitest suite: **2,838 tests passed in 382 files**; 17 new unit/component cases.
- General and scope TypeScript checks passed; production build passed.
- Six Playwright scenarios passed with Chrome: existing desktop/mobile payment
  verification, retained details during refresh on desktop and dark mobile,
  denied-access cleanup at 320px, and keyboard/in-app reduced-motion behavior.
- Light desktop (1440px) and dark mobile (390px) screenshots were visually reviewed.
  Browser geometry checks found no horizontal document overflow in those scenarios.
- The browser suite intercepts API responses and uses synthetic products/orders.
  It does not certify a live purchase, external delivery, or a production session.
- CI runs the same six scenarios with Playwright Chromium and preserves synthetic
  screenshots as short-lived artifacts. Remote execution is reported separately.

## Migration coordination

Backend PR #2777 now has a READY immutable candidate at
`dpl_E9AixumWpNFJXZ4Za7ozsgWfRByd`, source
`8b54e0114856e1ff21815a60f247bad8041d4ad4`. The release explicitly supplies
`CHATBOC_DEPLOYMENT_REVISION`, avoiding the stale environment-derived version
observed in the preceding candidate. Version/readiness/version checks succeeded
on the new candidate after one retry; the first request still returned a bootstrap
503. No claim of eliminating cold starts or authorizing cutover is made.

The frontend changes are committed for review, not a public-domain promotion.
The remaining migration chain, data parity and end-to-end provider acceptance
continue as separate release gates; this UI work does not silently switch them.
