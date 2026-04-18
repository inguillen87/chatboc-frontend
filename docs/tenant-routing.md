# Tenant canonical routing

Canonical tenant-facing routes must use:

- `/t/:tenantSlug/*`

Legacy prefixes remain supported only as client-side redirects to the canonical prefix.

## Redirect table (legacy → canonical)

| Legacy prefix | Canonical prefix |
| --- | --- |
| `/m/:tenantSlug/*` | `/t/:tenantSlug/*` |
| `/market/:tenantSlug/*` | `/t/:tenantSlug/*` |
| `/tenant/:tenantSlug/*` | `/t/:tenantSlug/*` |
| `/municipio/:tenantSlug/*` | `/t/:tenantSlug/*` |
| `/pyme/:tenantSlug/*` | `/t/:tenantSlug/*` |

## Notes

- Redirects preserve path suffix, query string and hash.
- The canonicalization runs in the router layer to keep deep links from WhatsApp and other channels stable.
