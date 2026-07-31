# MUTHUR-LOAD

Portable knowledge packaging for the relationship graph ([manifesto](./muthur-manifesto.md) §VII).

## Surface

| Layer | Value |
|-------|--------|
| Rail id | `d` |
| Rail icon | `ImDownload` (react-icons/im) |
| Pane kind | `muthur-load` |
| Label | MUTHUR-LOAD |

## Milestone 1

Share a **m4trix moment** as a load — recipient opens m4trix with the moment (and optional relationship context) hydrated.

## Planned API

`POST /api/muthur/load` — pack payload  
`GET /api/muthur/load/[id]` — fetch load for hydration
