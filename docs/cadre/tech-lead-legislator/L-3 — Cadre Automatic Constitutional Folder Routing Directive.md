````md
# L-3 — Cadre Automatic Constitutional Folder Routing Directive

Status: ACTIVE  
Branch: Legislator  
Authority: tech-lead-legislator  
Date: 2026-05-21

## Objective

Update Echo Mirage markdown save behavior so constitutional documents automatically resolve their default save directory from the markdown H1 prefix.

Operators should not manually navigate folders during standard Cadre operations.

The constitutional title itself must determine routing.

---

## Constitutional Routing Rules

The save system must parse the markdown H1 title and determine the correct Cadre folder automatically.

Examples:

`L-*`
→ `docs/cadre/tech-lead-legislator/`

`E-*`
→ `docs/cadre/executive-coder/`

`ER-*`
→ `docs/cadre/judge-tester/`

`JR-*`
→ `docs/cadre/judge-tester/`

`JP-*`
→ `docs/cadre/judge-tester/`

`JF-*`
→ `docs/cadre/judge-tester/`

---

## Example Routing

Example H1:

# L-2 — Operator Markdown Viewer Automatic Save Title Directive

Automatically resolves to:

`docs/cadre/tech-lead-legislator/`

Generated filename:

`L-2-operator-markdown-viewer-automatic-save-title-directive.md`

---

## Unknown Prefix Behavior

If the prefix cannot be determined:

save to:

`docs/cadre/`

Fallback filename:

`operator-doc.md`

---

## Save Behavior Requirements

The save system must:

- parse the first markdown H1
- determine constitutional prefix
- resolve default Cadre folder
- generate filesystem-safe filename
- pre-populate save dialog
- preserve operator ability to override manually

---

## Filesystem Naming Rules

Generated filenames must:

- convert em dash (`—`) to standard dash (`-`)
- convert spaces to hyphens
- remove unsafe filesystem characters
- preserve uppercase constitutional prefixes
- lowercase descriptive slug portions
- append `.md`

Example:

`L-3-cadre-automatic-constitutional-folder-routing-directive.md`

---

## Scope

Update only:

- OperatorMarkdownViewer
- markdown save/download behavior
- constitutional routing logic

Do NOT add:

- backend persistence
- database indexing
- filesystem watchers
- Cadre feed systems
- PowerFist dependencies

---

## Validation Requirements

Validation must confirm:

- constitutional prefixes resolve correct folders
- generated filenames are deterministic
- save dialog opens at resolved directory
- fallback routing functions correctly
- manual override remains possible

Required validation commands:

```bash
pnpm exec tsc --noEmit
pnpm build
````

---

## Constitutional Notes

Cadre document routing must emerge mechanically from constitutional document identity.

The markdown H1 title serves as the canonical routing authority.

Operators should focus on operational authorship rather than filesystem management.

```
```
