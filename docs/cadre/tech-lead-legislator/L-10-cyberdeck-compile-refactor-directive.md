# L-10 — CYBERDECK COMPILE REFACTOR DIRECTIVE

## OBJECTIVE

Refactor the `/cyberdeck` route and surrounding architecture to dramatically reduce development compile times, hot reload latency, and runtime startup overhead.

Current symptom:

- `HEAD /cyberdeck 200 in 2.9min (compile: 2.8min, render: 6.0s)`

This indicates the route has become an oversized monolithic dependency graph.

The system must evolve from:
- single-page giant React app

Into:
- modular operating-system style architecture
- lazy-loaded subsystems
- isolated operator domains
- deferred heavy tooling

---

# PRIMARY GOALS

## Goal 1 — Reduce Initial Compile Scope

The root `/cyberdeck` route must become lightweight.

The route should:
- establish layout shell
- establish providers
- establish docking framework
- establish minimal runtime state

The route should NOT:
- eagerly import all panes
- eagerly import all operators
- eagerly import editors
- eagerly import AI systems
- eagerly import visualization engines
- eagerly import markdown tooling
- eagerly import audio systems

---

# REQUIRED REFACTOR STRATEGY

## 1. BREAK UP THE GOD ROUTE

Current issue:
- `page.tsx` likely imports too many systems directly.

Required:
- split into composable subsystem modules

Suggested structure:

```txt
src/app/cyberdeck/
  page.tsx

src/features/
  operators/
  panes/
  workspace/
  muthur/
  terminal/
  atlas/
  voice/
  markdown/
  project-tree/
````

---

# 2. DYNAMIC IMPORT HEAVY PANELS

Use dynamic imports for all heavyweight systems.

Examples:

* Monaco editor
* xterm terminal
* markdown preview
* syntax highlighting
* charts
* globe visualizations
* spectrogram/audio systems
* AI review panels
* project tree indexing
* database viewers

Required pattern:

```ts
const MonacoPane = dynamic(
  () => import("./panes/MonacoPane"),
  {
    ssr: false,
    loading: () => <PanelLoader />
  }
)
```

Do NOT load these at startup unless visible/opened.

---

# 3. ISOLATE OPERATOR RUNTIME

Operators should not boot automatically.

Operators must:

* initialize only when activated
* suspend when hidden
* avoid global subscriptions unless necessary

Required:

* operator registry
* lazy operator mounting
* runtime activation model

Example concept:

```ts
operatorRegistry.activate("muthur")
```

instead of importing all operators into root render tree.

---

# 4. REMOVE MASSIVE CLIENT TREES

Audit `"use client"` usage.

Problem:

* excessive client boundaries force huge browser bundles

Required:

* move static/layout logic server-side where possible
* isolate interactivity to smallest components
* reduce top-level client providers

---

# 5. SPLIT GLOBAL STATE

Current likely issue:

* gigantic shared context triggering cascading renders

Required:

* domain-specific stores

Suggested:

* workspaceStore
* operatorStore
* dockStore
* themeStore
* projectStore

Avoid:

* one mega-context for entire cyberdeck state

---

# 6. PREVENT WATCHER EXPLOSION

Ensure build/watch systems ignore runtime artifacts.

Required ignore paths:

```txt
.memory/
.atlas/
.powerfist/
logs/
generated/
screenshots/
audio/
spectrograms/
exports/
dist/
tmp/
```

Verify:

* Next watcher
* chokidar
* Electron watcher
* Turbopack/Webpack
* tsconfig include paths

are NOT recursively watching runtime data.

---

# 7. REMOVE BARREL IMPORT EXPLOSION

Audit:

* `index.ts`
* giant export aggregators

Problem:

* importing one symbol may pull entire subsystem graph

Preferred:

* direct imports

BAD:

```ts
import { MuthurPane } from "@/features"
```

GOOD:

```ts
import { MuthurPane } from "@/features/muthur/MuthurPane"
```

---

# 8. SPLIT OPTIONAL SYSTEMS

These systems must become optional plugins:

* Voice Studio
* AudioCraft
* DiffSinger
* Spectrogram Lab
* Markdown conversion
* Atlas visualization
* DB8 bridge
* Computer-use runtime
* Multi-agent panels

Load only when explicitly opened.

---

# 9. INVESTIGATE RENDER COST

Current render:

* 6 seconds

This is still too high.

Audit:

* expensive animations
* layout thrashing
* giant virtual DOM trees
* unnecessary effects
* repeated markdown parsing
* recursive tree renders
* large arrays rendered simultaneously

Required:

* memoization
* virtualization
* deferred rendering
* panel suspension when hidden

---

# 10. CREATE PERFORMANCE MODES

Implement runtime modes:

## Minimal Boot

Only:

* shell
* tabs
* MUTHUR
* lightweight terminal

## Standard

Common tools enabled.

## Full Ship

Everything enabled.

---

# SUCCESS METRICS

Target development performance:

Initial compile:

* under 30 seconds

Hot reload:

* under 3 seconds

Panel activation:

* under 1 second

Route render:

* under 1 second

---

# IMPORTANT

Do NOT rewrite the visual identity.

Preserve:

* Realmorphism
* ASCII morphism
* operator deck feel
* flight deck layout
* MUTHUR interaction model

This is an architectural refactor only.

The cyberdeck should FEEL identical while becoming modular internally.

---

# DELIVERABLES

Provide:

1. Dependency graph findings
2. Largest bundle offenders
3. Refactor plan
4. Incremental patch strategy
5. Before/after compile timing
6. Files/modules split
7. Watcher fixes
8. Dynamic import conversions
9. Render bottleneck analysis

Avoid giant rewrite commits.

Prefer:

* incremental verified refactors
* measurable compile improvements
* isolated subsystem extraction

---

# PRIORITY

Performance and modularity now take precedence over adding new features.

The cyberdeck is transitioning from:

* experimental React application

into:

* long-lived modular operating environment.

Architect accordingly.