# Chatboc production verification — 2026-09-08

## Published frontend

- Production SHA: `82fbc153eddec3158fe3c799c96838842acc6b12`.
- Vercel deployment: `dpl_CqDZhUQEkn1n1uoE5L9gkD1C2mYJ`.
- Immutable URL: https://chatboc-frontend-n0w6exv48-marcelos-projects-c26aa499.vercel.app
- Both `chatboc.ar` and `www.chatboc.ar` returned HTTP 200 and this exact build SHA after promotion.
- Production build verification checked eight canonical API rewrites, no Preview API origin, no placeholder credentials, and matching Git version.
- Widget secondary actions are grouped in an accessible menu; its portal renders above the floating widget. Tested menu interaction at 320/390/420 pixels and against the actual floating widget, including hit testing, sound toggle, Escape, and focus return.
- Regression before the final stacking fix: 375 Vitest files, 2730 tests passed; typecheck passed. Landing/accessibility Playwright: 10 passed. Final stacking fix: 6 focused unit tests and 2 Playwright tests passed, typecheck/build passed, immutable candidate verified visually before promotion.

## Published backend territorial contract

- Production SHA: `3bc0d397e18435b8fc7fb7bed9f668c68c568e06`.
- Render service: `srv-d0rq2rp5pdvs738t3bhg`.
- First attempt `dep-dag6o2dg1s2s73ba3m6g` failed after successful build. No application logs explained the failure; no specific root cause was established. The prior deployment remained available.
- One unchanged retry, `dep-dag6uv740ujc738c0l00`, succeeded and became Live at 2026-09-08 20:32:24 UTC. Public `/api/version` independently confirmed the new SHA at 21:29 UTC.
- Existing preparation command, confirmed in Settings and successful retry logs: `test -n "$DATABASE_URL" && FLASK_MIGRATIONS_ONLY=1 MIGRATIONS_DATABASE_URL="$DATABASE_URL" python scripts/apply_migrations.py`.
- No new migration files, database cutover, worker/cron changes, WhatsApp configuration changes, or citizen messages were part of this patch. Existing predeploy completed successfully against the same configured database.
- Offline territorial QA: 61 tests and 21 subtests passed. Official IDE Mendoza department 09 geometry independently matched the bundled snapshot.
- Rollback predecessor: `b68021923b99f0fb0971ed7657a476c2439b4695`, deployment `dep-daed1n2d0e5s7381tesg`.

## Actual Junín data — not a synthetic success claim

Authenticated `/api/v2/analytics/operations/heatmap` returned HTTP 200 after the release:

- Official jurisdiction containment verified, source IDE Mendoza, department 09.
- 53 ticket records: 19 stored coordinate pairs, 31 pending geocoding, 3 without a location.
- All 19 candidate coordinate pairs were outside the official Junín, Mendoza polygon; zero eligible map points were published.
- Existing-coordinate coverage (35.85%) is NOT validated map coverage. Ticket source coverage after containment is 0%.
- No coordinates were moved or invented. Official department geometry does not certify neighborhood boundaries.
- The initial empty-page presentation still needed improvement: it replaced the map with a generic geocoding alert. This is a separate frontend follow-up, not a completed geocoding operation.

## Production CRM read-only checks

- Junín authenticated session survived frontend/backend releases.
- Ticket queue loaded 12 of 53 records.
- A pre-existing ticket history loaded in expanded conversation mode.
- Measured dialog: approximately 1721 × 835 pixels on a 1745 × 859 viewport, without horizontal page overflow. Escape returned focus to the expand control.
- No ticket was claimed, reassigned, changed in status, or externally messaged during this verification.
- Assignment controls still require the separately reviewed production assignment backend patch; passing local tests is not evidence of a deployed claim workflow.

## Remaining operational boundaries

Render displayed a failed-payment warning. No payment or billing change was made. Render and its database remain active; migration/closure gates are not complete. Real geocoding validation and physical WhatsApp send/receive checks remain separate from this release.

## Follow-up candidate: map clarity and verified assignment

- Empty territorial views keep the official department boundary visible, with no invented activity and no overlay notices. Detailed audit remains collapsed. Review counts use explicit outside/invalid/unverified partitions, not all candidate coordinates.
- New browser test uses the checked public IDE geometry (SHA pinned across Windows/Linux) and controlled counts. Desktop 1440 and mobile 390 captures were visually reviewed; no horizontal overflow or stretched blank map. Three map/widget browser tests passed together.
- Reply drafts no longer claim an assignment, priority change or reopening that has not happened; a citizen name is not treated as an assigned operator. 35 focused guidance tests passed.
- Matrix and lead assignment submit canonical row identity and observed ownership. Matrix apply also includes the reviewed suggested employee. Changed context, unconfirmed/partial results and 403/409 never produce a false success or implicit retry.
- Independent review identified a delayed coverage-save race across tenant changes; two regressions reproduced it before correction. Final assignment run: 104 tests passed in seven suites, typecheck passed.
- Full regression before the final context-race fix/new assignment suites: 375 files / 2752 tests passed. A final whole-suite run is pending at this checkpoint. Publication of the follow-up is not claimed by this section.
