# Operational inbox focus — September 18, 2026

## Release scope

Built on orders head `a38359181d5407615dae5ecebdffc13c06e34c1c`.
The feature is integrated in `Sidebar`, used by `NewTicketsPanel` and the real
`/perfil?tab=tickets` workspace, not an isolated demo or the education-only inbox.
No server permissions, ticket transitions, outbound messages or production data
were changed. This branch preserves the September integration lineage.

## Shipped code

- Always-visible focus shortcuts for unread activity, server-reported overdue
  SLA, and unassigned cases. They update existing TicketContext filters and
  server queries, so the queue, next-case logic and advanced filter panel share
  the same state. Multiple focuses intersect; no parallel local filter store.
- Search, channel, area and other criteria survive focus changes. Clearing focus
  removes only these shortcuts, preserving a separately selected agent or SLA.
- No invented global counts. The current queue's existing pagination and scope
  remain authoritative. Clearing may reuse the viewer-scoped inbox cache.
- Compact rows expose the existing SLA component only with known evidence.
  Age or priority alone never manufactures a deadline. Unread indicator is inline
  beside the timestamp instead of covering it.
- Standard keyboard-operable buttons, semantic color treatments in both themes,
  no new libraries, and CSS interactions that respect OS and app reduced motion.
- Backend categories are scoped by tenant. Stale loaded names disappear on scope
  changes; late responses from the former organization are discarded.

## Validation

- Full local suite: **2,856 tests passed in 384 files**, including 18 new cases.
- General and scoped TypeScript checks, production build, and diff checks passed.
- Two browser scenarios exercise the real profile ticket workspace on desktop
  (1440x1000) and mobile (390x844): focus updates the server query, combined filters
  retain the WhatsApp channel, clearing reuses scoped data correctly, and known
  SLA deadlines are visible directly in the compact queue. No replies are sent.
- Reduced-motion row transforms are verified. Dark-theme visual coverage sets the
  theme after tenant bootstrap; this does not certify preference persistence.
- Browser data and credentials are synthetic and API responses intercepted.
  These checks are not a production login, real WhatsApp delivery, or role/RBAC audit.
- CI runs on changed inbox paths and retains only synthetic PNG evidence for 7 days.

## Previous Preview verification closed

Orders Preview `dpl_2oRPNqxda7Yio6VPcwDBmRiFbDLz` is READY. Its immutable URL returned
HTTP 200 with exact frontend revision `a38359181d5407615dae5ecebdffc13c06e34c1c`.
The QA API proxy initially returned bootstrap 503, then HTTP 200 with backend
`e4bd9407564ef5f3996963b03aaca440e652b4c3`. The API alias remains the existing QA
backend, not automatically the newer standalone migration candidate.

New inbox CI and Preview results are recorded in this branch's PR after execution.
No public alias is promoted by this sprint. Render, Neon main, writer authority
and provider callbacks are unchanged. The eight remaining database migrations
and integrated cutover checks remain separate release gates.

Visual review also corrected the overdue SLA's dark-theme text/border treatment;
row and SLA regressions and both browser scenarios were re-run after this CSS-only
adjustment. No SLA computation or lifecycle policy changed.
