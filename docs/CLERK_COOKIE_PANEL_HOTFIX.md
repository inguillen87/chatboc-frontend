# Panel session recovery — 2026-09-23

## Problem and correction

A user signed in with Clerk cookie transport could reach the profile and then
be returned to login when opening Super Admin. The request builder automatically
attached a previously stored widget entity token to panel requests. The backend
selects those explicit token headers before the session cookie, so the unrelated
widget token caused a 401 even though the panel cookie was valid.

The request builder now keeps the Clerk cookie as the panel credential when the
selected transport is cookie-only and no Bearer or entity credential was chosen.
It does not automatically add X-Entity-Token/X-Token in that case. Explicit entity
credentials, embedded widgets, legacy Bearer requests, tenant scoping, and server
401/403 denials retain their existing behavior. No role or account changes.

## Evidence and scope

- Isolated from production source 9d85b481b026484dec0042b0b4193aac8c734e31.
- Browser reproduction: cookie-only /api/me without entity headers returned 200;
  subsequent /api/me with stored X-Token/X-Entity-Token returned 401. Clicking
  Super Admin showed the page briefly and then navigated to /login.
- Three failing characterization cases before the change; 73 focused tests
  passed afterward, including profile lifecycle and Clerk bridge tests.
- Full local suite: 2,791 tests passed, zero failures. Application typecheck and
  diff whitespace check passed. Independent frontend/backend contract review
  found no blocking issues for the reproduced failure.
- Tests exercise the real request builder and substitute only the HTTP boundary.
  They verify cookie credentials, preserved tenant scope, explicit/widget/iframe
  behavior, legacy Bearer behavior, and continued rejection of 401 and 403.

An old chatAuthToken selected as a Bearer is outside this change. It was absent
from the reproduced incident and normal Clerk owner-session persistence clears
it. This patch does not change backend credential precedence or weaken guards.

## Release boundaries

The preceding configuration-only recovery rebuilt the same production source
with canonical public backend URLs; that fixed a literal [SENSITIVE] value in
the old deployment. It did not solve this separate token-precedence defect.

This hotfix contains no organization/survey feature-stack changes. Validate the
remote artifact before promotion, retain the current Faro/Conversa aliases, and
separately verify authenticated access. A READY deployment is not runtime proof.
