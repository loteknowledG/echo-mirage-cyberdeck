# Realmorphism shadcn Registry

## Purpose

Realmorphism is now registered as a shadcn registry theme item for Echo Mirage distribution.

## Registry Files

- `public/registry/realmorphism.json` - installable `registry:theme` item.
- `public/registry/realmorphism-base.json` - installable wrapper kit for shadcn controls.
- `public/registry/realmorphism-site.json` - installable showroom page.
- `public/registry/registry.json` - local registry index.

## Local Install

When Echo Mirage is running locally, another project can install the theme from:

```bash
npx shadcn@latest add http://localhost:3050/registry/realmorphism.json
```

To install the turnkey component wrappers:

```bash
npx shadcn@latest add http://localhost:3050/registry/realmorphism-base.json
```

To install the showroom page:

```bash
npx shadcn@latest add http://localhost:3050/registry/realmorphism-site.json
```

If the app is served from another host or port, replace the origin and keep the same path:

```text
/registry/realmorphism.json
```

## Usage Contract

The registry item installs color tokens and the Realmorphism action layer. To express the full theme, apply:

```text
theme-realmorphism
```

to the app root and:

```text
realmorphism-action
```

to tactile controls.

The motion layer is part of the design, not decoration. It communicates available action, hover lift, active press, and pressed/on state.

## Base Exports

The base item installs:

- `RealmorphismShell`
- `RealmorphismButton`
- `RealmorphismIconButton`
- `RealmorphismCard`
- `RealmorphismInput`
- `RealmorphismSwitch`
- `RealmorphismToolbar`
- `RealmorphismTabs`
- `RealmorphismTabsList`
- `RealmorphismTabsTrigger`

It also re-exports common shadcn card and tabs subcomponents.
