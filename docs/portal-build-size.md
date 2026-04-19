# Portal build size baseline + delta (Task E)

Fecha de medición: 2026-04-18.

Comando utilizado:
- `npm run build`
- `node` script para leer tamaños de `dist/assets/*` por entry chunk.

## Baseline (referencia pre-separación lógica)
Antes de separar el portal como entry de build, el artefacto principal era el chunk de `main`.
Se usa ese valor como baseline técnico de referencia en este repo.

| Entry | Chunk | Tamaño |
|---|---|---:|
| main (baseline) | `main-CuPbek64.js` | 1484.82 KiB |

## Después de separar portal

| Entry | Chunk | Tamaño |
|---|---|---:|
| main | `main-CuPbek64.js` | 1484.82 KiB |
| portal | `portal-DHZ6LFXY.js` | 5.45 KiB |
| iframe | `iframe-XkETLpJw.js` | 0.75 KiB |

## Delta
- Nuevo artefacto independiente de portal: **+5.45 KiB** (entry chunk propio).
- `main` se mantiene como artefacto separado y el portal ya no bootea con `src/main.tsx`/`App.tsx`.
