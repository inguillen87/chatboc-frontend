# Shared WhatsApp template workspace

## Scope

This changes the real `GestionPlantillasPage` component used by Chatboc organizations,
not the isolated Conversa demonstration. Base: `39f9579` on the preserved September
frontend lineage. No backend migration, provider account, sender, plan or callback
is changed. Existing catalogue and draft endpoints are reused.

## Behavior delivered

- One selected template pack at a time, lifecycle filter and responsive previews.
  Labels, template bodies, blockers and capabilities still come from the backend.
- Explicit tenant required. Catalogue must carry the expected contract, organization
  slug/ID, unique packs and read permission. No global fallback when scope is absent.
- Draft action uses only the known local endpoint; an external/changed endpoint is
  not followed with authentication headers.
- Remount on scope changes prevents late A → B → A results from contaminating a new
  view. Unmount invalidates pending callbacks and clears the local wait.
- Access/identity failures clear content and controls. Temporary read failures keep
  a visibly stale preview but disable writes until new verification succeeds.
- One draft write at a time; no competing refresh. Validate acknowledged tenant ID,
  pack identity/version/template names and provider_calls_performed=false.
- Uncertain result: refresh before explicit retry, retaining the same idempotency
  key while this workspace remains mounted. No automatic mutation retry.
- Local wait is bounded to 30 seconds. It does NOT cancel an already-issued server
  transaction or network request. No changes to shared apiFetch behavior.
- A confirmed local draft is not presented as Meta approval. Contradictory approval
  evidence or blockers is displayed as unverified.
- Dark-state contrast, wrapped content, 44px selection controls and reduced-motion
  handling. No extra runtime library, private template copy or simulated approval.

## Evidence

Local full suite: **2,879 tests / 387 files passed**. This includes 19 new tests
(16 workspace/contract regressions and 3 local-wait tests). Five existing panel tests
were updated with tenant/contract fields actually present in the backend response.
General and scoped TypeScript checks passed. Four browser scenarios passed on
Chromium: 1440, 820, 390 dark and 320 CSS pixels. They exercise the real component
with intercepted SYNTHETIC HTTP responses: pack selection, state filter, one write,
scope change and revoked access. No customer/provider request leaves that harness.
Screenshots were reviewed; pending-state contrast was corrected after inspection.
These are not physical-device, installed-PWA or real-provider approval tests.
CI and deployment results for the committed release are recorded in its PR.

## Boundaries and remaining implementation

No new content is created at Meta/Twilio. Existing server authorization and
idempotency still need integration acceptance; frontend validation cannot replace
RBAC, database constraints or provider ownership checks. No credentials changed.
The final real WhatsApp flow still needs the correct authorized number/WABA,
approved content and end-to-end inbound/outbound/status tests.
The Render/Vercel/Neon migration and eight pending schema steps remain separate.
The browser harness is test-only, not a production entry or authentication bypass.

Reference: Twilio Content and Approvals are separate provider evidence, not inferred
from a local draft: https://www.twilio.com/docs/content/content-api-resources
