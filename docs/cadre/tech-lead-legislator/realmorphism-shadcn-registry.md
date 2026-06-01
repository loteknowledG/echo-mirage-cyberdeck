# Realmorphism shadcn Registry

## Purpose

Realmorphism ships as **optional install layers**: theme, base controls, rolling pickers, kit showroom, or the `realmorphism` npm package.

## Install options (pick what you need)

| Layer | Command | You get |
|-------|---------|---------|
| Theme | `npx shadcn@latest add <origin>/registry/realmorphism.json` | Tokens + motion CSS |
| Base controls | `npx shadcn@latest add <origin>/registry/realmorphism-base.json` | Wrapped shadcn primitives |
| **Rolling pickers** | `npx shadcn@latest add <origin>/registry/realmorphism-rolling-pickers.json` | `DocTypeRollingPicker`, `TextRollingPicker`, `ShowroomFontPicker`, `RollingPicker` |
| Kit showroom | `npx shadcn@latest add <origin>/registry/realmorphism-kit.json` | `KitShowroom` + kit sections + knobs |
| Registry page | `npx shadcn@latest add <origin>/registry/realmorphism-site.json` | `app/registry/page.tsx` → `KitShowroom` |
| **Package** | `pnpm add realmorphism` | Same pickers/kit via import (Echo monorepo: `file:../realmorphism`) |

Replace `<origin>` with your registry host (`http://localhost:3050` for Echo Mirage dev, or GitHub Pages when deployed).

## Registry files

- `public/registry/realmorphism.json` — theme
- `public/registry/realmorphism-base.json` — base wrappers
- `public/registry/realmorphism-rolling-pickers.json` — **pickers** (generated)
- `public/registry/realmorphism-kit.json` — **kit showroom** (generated)
- `public/registry/realmorphism-site.json` — portable page (generated)
- `public/registry/registry.json` — index

## Regenerate from source

Picker and kit registry JSON is generated from `f:\dev\realmorphism\src`:

```bash
# realmorphism repo
pnpm registry:build

# echo-mirage (build + sync to public/registry)
pnpm registry:build
```

Run after changing pickers, kit sections, or install commands in `KitShowroom`.

## Echo Mirage (primary consumer)

Echo uses the **package path** (`realmorphism: file:../realmorphism`) for the live Kit tab. Registry items stay in sync for shadcn `add` and for other projects.

## Usage contract

- Root shell: `theme-realmorphism`
- Actionable controls: `realmorphism-action` or `realmorphism-control`
- Kit panels: `realmorphism-panel`, `realmorphism-kit-toolbar`
