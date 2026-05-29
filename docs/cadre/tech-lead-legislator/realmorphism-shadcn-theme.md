# Realmorphism shadcn Theme

## Purpose

Realmorphism is a blocky, tactile shadcn/ui theme for operational interfaces.

It is not only a color palette. The theme depends on a physical interaction model:

- host surface
- raised face
- hard-offset wall shadow
- hover lift
- active press
- latched state

The motion is the affordance. It tells the operator that an action is available.

## Distribution Files

- `realmorphism-shadcn-theme.json` — tweakcn/shadcn-style token payload.
- `realmorphism-shadcn-theme.css` — optional Realmorphism motion layer.

## Design Notes

Realmorphism uses smaller, blockier corners than playful rounded themes.

Recommended radius:

```text
0.5rem
```

Hard shadows must stay sharp. Blur weakens the physical read.

Recommended interaction:

```text
rest   -> 2px 2px hard wall
hover  -> -2px lift, 4px 4px hard wall
active -> 4px press, shadow removed
```

## Upload Notes

For a theme site that only accepts variables, upload the JSON/token values.

For a theme site that accepts custom CSS, include the `.realmorphism-action` motion layer as the interaction recipe.

If custom CSS is not accepted, the theme can still publish as color/radius/shadow tokens, but it will not fully express Realmorphism.
