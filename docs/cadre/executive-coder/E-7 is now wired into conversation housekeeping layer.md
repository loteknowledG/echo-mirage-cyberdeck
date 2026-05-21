**L-7 is now wired into the conversion housekeeping layer.**

The directive already lives at `docs/cadre/tech-lead-legislator/L-7-muthur-conversion-housekeeping-directive.md`. Implementation matches its bounded scope:

| L-7 requirement | Status |
|-----------------|--------|
| Conversational wrapper cleanup | `operator-paste-cleaner.ts` (3–6+ backtick, escaped, `id=` variants) |
| Mechanical markdown normalization | **New** `operator-markdown-housekeeping.ts` — CRLF→LF, heading spacing, `---` separators, collapse 3+ blank lines; skips fenced code bodies |
| Filename housekeeping | Existing `deriveMarkdownSaveFilename` / `slugifyCadreDescription` (em dash → hyphen, constitutional prefix) |
| Conversion pipeline | `muthur-document-conversion.server.ts` applies housekeeping and rewrites output `.md` when changed |
| Operator load path | `setOperatorTextAsset` — wrapper strip for all text; mechanical normalize when kind is `markdown` |
| Auto-open / mime / render | Unchanged (already working) |

**Validation (per L-7):**
- `probe-operator-paste-cleaner.ts` — pass
- `probe-operator-markdown-housekeeping.ts` — pass
- `probe-operator-markdown-title.ts` — pass
- `pnpm exec tsc --noEmit` — pass
- `pnpm build` — pass

MUTHUR housekeeping stays mechanical only: no summarization, rewriting, or semantic restructuring — transport/format layers only, with constitutional meaning preserved.