# Echo Mirage Mission Charter

**Status:** Working target, intended to evolve with evidence  
**Prepared:** 2026-08-09  
**Phase:** Pre-mission planning and build diagnosis

## 1. North star

Echo Mirage is a fast, modular mission Cyberdeck and dispatch nexus for a fleet of autonomous agents, applications, models, and machines.

It gives the operator a shared operational picture, discovers what the fleet can do now, prepares missions, routes bounded work to suitable agents, coordinates handoffs, detects failures and resource exhaustion, proposes contingencies, verifies outcomes, and preserves receipts and experience.

Echo Mirage coordinates agents without absorbing or limiting them. Cursor, Codex, ChatGPT, Pi, OpenCode, MUTHUR, M4trix, Synapse, Echo Satellite, and future systems retain their own repositories, runtimes, tools, models, settings, and release cycles.

The governing rule is:

> Echo Mirage owns coordination state, mission continuity, and the operational picture—not agent internals.

## 2. Product roles

- **Echo Mirage:** operator-facing Cyberdeck, mission control, readiness, dispatch, approvals, monitoring, and receipts.
- **Commander/MUTHUR:** orchestration, reasoning, model selection, and mission synthesis.
- **Synapse:** discovery, presence, transport, and communication across agents and machines.
- **Calyx:** evidence-backed capability, experience, development, and continuity over time.
- **Voice Lab:** voice creation, preview, modulation, fleet identity, assignments, and portable exports.
- **Survey:** structured field observation and intelligence gathering.
- **Echo Satellite:** field interface on remote devices, including the Mac.
- **M4trix:** autonomous connected application and consumer of exported or synchronized voice profiles.
- **Execution fleet:** Cursor, Codex, Pi, OpenCode, ChatGPT, and other specialized agents.

## 3. Operating principles

1. **Autonomy:** every agent remains independently usable and may accept, reject, or partially apply a request.
2. **Capability-aware dispatch:** route by demonstrated skill, tools, permissions, surface, model, availability, budget, and mission state—not name alone.
3. **Evidence over reputation:** Calyx stores time-bound results. Model and runtime updates trigger reevaluation.
4. **Verified readiness:** critical missions require real end-to-end probes, not the presence of a key or configuration file.
5. **Contingency before failure:** missing quota, tools, permissions, or connectivity should produce ranked remediation plans.
6. **Operator authority:** new spending, software installation, destructive actions, credential changes, and new privacy boundaries require approval.
7. **Receipts:** distinguish requested, delivered, acknowledged, applied, tested, rejected, degraded, and offline states.
8. **Fast modularity:** one cohesive product may contain independently compiled, cached, tested, and packaged systems.
9. **Thin integration:** use contracts, adapters, events, and artifacts rather than importing other agents' implementations.
10. **Incremental delivery:** build verified vertical slices; avoid a big-bang rewrite.

## 4. Where we are now

### Product state

- Echo Mirage already contains meaningful Cyberdeck, MUTHUR, Calyx, Survey, Synapse, Voice, Electron, and Satellite concepts.
- The operator is manually performing the future Dispatch function: choosing agents, transferring context, monitoring capacity, requesting work, reviewing artifacts, and recovering from failures.
- Voice Lab exists inside Cyberdeck and is close in capability to the separate SvelteKit prototype, but the Cyberdeck version lacks manual modulation sliders.
- Voice selection has overlapping paths, including more than one apparent way to configure MUTHUR, creating ambiguity between preview, persistence, and active assignment.
- The SvelteKit Voice Lab was separated partly to test Svelte and partly to escape the approximately twenty-minute Cyberdeck iteration loop.
- Echo Satellite on macOS encountered a real survey-mission failure: browser STT was unavailable and the Whisper route had no credit.
- M4trix owns local voice selection but should be able to import or synchronize profiles authored in Voice Lab.

### Engineering state observed so far

- The repository is currently one large root Next.js package rather than a true pnpm workspace.
- The build forces `next build --webpack` and executes three preprocessing scripts first.
- Production Webpack caching is explicitly disabled in `next.config.mjs`.
- TypeScript uses broad recursive include patterns.
- Next transpiles several packages from source, including Realmorphism-related code.
- Output tracing includes broad patterns and large runtime dependency trees.
- Approximately 1,185 JavaScript and TypeScript source files were found across the inspected source, app, script, and test trees.
- Several modules remain very large, although the codebase already contains dynamic-loading and compile-scope protections for heavy Cyberdeck panes.
- The repository contains unrelated uncommitted voice/TTS work; diagnostic work must preserve it.
- A complete cold/warm timing breakdown has not yet been captured.

### Fleet observations

- Codex has produced the strongest observed web-design and high-judgment frontend results, but exposes a finite usage reserve.
- Cursor appears capable of sustained implementation work and does not expose a useful remaining-capacity percentage to the operator. Treat this as high observed endurance with unreported capacity, not proven infinity.
- ChatGPT can contribute reasoning and review where its surface lacks direct repository mutation.
- MUTHUR can use OpenCode/OpenRouter for model selection and orchestration.
- Model quality changes over time. Routing assumptions must expire and be retested.

## 5. The delta

| Area | Current condition | Target condition |
|---|---|---|
| Build architecture | Root monolith; slow full build | pnpm workspace with real boundaries and cached affected builds |
| Product packaging | Some capabilities separated to iterate | One Cyberdeck product with independently built internal systems |
| Dispatch | Operator coordinates manually | Capability-aware mission routing and structured handoffs |
| Readiness | Failures discovered during missions | Expiring end-to-end preflight with approved fallbacks |
| Remediation | Operator diagnoses and coordinates repairs | Ranked plans, approvals, dispatch, and automatic reverification |
| Voice Lab | Duplicate pathways and unclear assignment | One profile registry, clear preview/save/assign flow, Roller Deck UX |
| Fleet voice | Mostly MUTHUR-specific | Adapters for MUTHUR, Cursor, Codex, Pi, OpenCode, and future agents |
| M4trix voice | Separate internal selection | Import/sync catalog while M4trix retains active-choice authority |
| Synapse | Connected concept and transport | Capability/presence substrate for Dispatch and remediation |
| Calyx | Domain experience and career system | Time-bound capability evidence feeding explainable routing |
| Resource management | Manually observed | Reported, estimated, or unknown budgets with checkpoint thresholds |
| Mission history | Conversations and ad hoc artifacts | Durable missions, receipts, artifacts, decisions, and handoffs |

## 6. Target technical shape

The names are directional, not a mandate to create empty packages immediately.

```text
apps/
  cyberdeck/                 Next.js operator interface
  desktop/                   Electron packaging and native bridge
  satellite/                 Remote field interface
  voice-lab-svelte/          Temporary UX laboratory if still useful

packages/
  shared-core/               IDs, events, errors, artifacts, receipts
  agent-contracts/           Identity, surfaces, capabilities, budgets
  dispatch-core/             Missions, tasks, routing, and handoffs
  mission-readiness/         Probes, policies, and remediation plans
  synapse-client/            Presence and cross-machine transport
  calyx-core/                Capability and experience evidence
  voice-contracts/           Profiles, modulation, targets, assignments
  voice-engine/              Rendering, effects, and provider bindings
  voice-registry/            Profiles and assignment source of truth
  voice-adapters/            Target-specific application/export adapters
  voice-lab-ui/              Production Cyberdeck Voice Lab
  survey-core/               Survey mission contracts and domain logic
  ui/                        Roller Deck and shared primitives
```

Dependency flow must be one-way and cycle-free. The Cyberdeck shell composes domains; domain packages do not import the shell or each other arbitrarily.

## 7. Quest plan

### Quest 0 — Measure the twenty minutes

**Objective:** explain where build time goes before restructuring.

- Record cold and warm `pnpm build` timings.
- Time preprocessing, TypeScript, Next/Webpack compilation, page-data generation, tracing, linting, tests, dependency installation, and CI overhead separately.
- Inspect import cycles, barrel amplification, source-transpiled dependencies, generated-file invalidation, disk/antivirus effects, and memory pressure.
- Compare builds with controlled changes to Calyx, Voice Lab, Survey, and unrelated UI.
- Produce `docs/engineering/build-baseline.md` with ranked interventions and expected impact.

**Exit gate:** most of the twenty minutes is attributable to measured phases.

### Quest 1 — Apply reversible build wins

- Narrow TypeScript and tracing scope where evidence supports it.
- Stop unnecessary artifact rewrites and duplicated CI work.
- evaluate safe persistent Webpack caching rather than assuming it must remain disabled.
- Prebuild source dependencies where appropriate.
- Separate expensive probes and E2E suites from ordinary interactive builds.
- Add repeatable benchmark commands and preserve before/after data.

**Exit gate:** meaningful improvement with unchanged product behavior.

### Quest 2 — Install the modular build substrate

- Add pnpm workspace configuration and Turborepo task orchestration.
- Declare build, typecheck, lint, test, probe, and benchmark tasks with correct inputs and outputs.
- Add cycle and boundary enforcement.
- Keep the current application intact initially.

**Exit gate:** the existing product builds through the workspace with reliable cache behavior.

### Quest 3 — Prove boundaries with Calyx

- Extract contracts first, then domain logic, server persistence, and UI integration.
- Keep Calyx independent of the Cyberdeck shell.
- Have Dispatch query evidence through an interface and record results through events.
- Measure Calyx-only and unrelated changes.

**Exit gate:** a Calyx change rebuilds Calyx and true dependents, not the entire fleet.

### Quest 4 — Consolidate the voice domain

- Inventory all preview, persistence, TTS, character-profile, and MUTHUR-assignment paths.
- Establish canonical `VoiceProfile`, `VoiceModulation`, `VoiceTarget`, `VoiceAssignment`, capability, and receipt contracts.
- Separate browse selection, preview draft, saved profile, and active assignment.
- Route all MUTHUR changes through one registry/service.

**Exit gate:** no competing source of truth for MUTHUR's active voice.

### Quest 5 — Build the fleet Voice Lab

- Use Roller Deck for browsing and selection.
- Add manual modulation sliders and explicit preview/save/assign actions.
- Add capability-aware target adapters for MUTHUR, Cursor, Codex, Pi, and OpenCode.
- Define a versioned portable voice-pack format and M4trix import/sync adapter.
- Let M4trix retain authority over its active local selection.
- Keep the SvelteKit implementation as a UX laboratory until a measured convergence decision is made.

**Exit gate:** Voice Lab can change quickly, and every assignment produces a verifiable receipt.

### Quest 6 — Establish Dispatch

- Implement agent identity, surface, capability, budget, mission, task, context-envelope, handoff, artifact, approval, and receipt contracts.
- Discover agents and query live capabilities through thin adapters.
- Route bounded tasks without assuming every agent can edit code or expose quota.

**Exit gate:** Echo Mirage can select an eligible agent, dispatch a task, and receive a structured outcome.

### Quest 7 — Mission readiness and remediation

- Implement configured, reachable, authenticated, usable, funded, and end-to-end-verified probe levels.
- Support `READY`, `READY_WITH_FALLBACK`, `DEGRADED`, and `BLOCKED` mission states.
- Rank remediation by capability, time, cost, privacy, risk, and operator policy.
- Rerun readiness after remediation or material environment changes.

**Exit gate:** critical missions cannot launch on configuration checks alone.

### Quest 8 — First combat-mission vertical slice

Reproduce the macOS survey scenario:

1. Detect Satellite and microphone state.
2. Verify real audio capture.
3. Detect unavailable browser STT.
4. Detect that the preferred Whisper route cannot execute because of quota.
5. Query Synapse for alternative devices and services.
6. Recommend an approved local, remote, or alternate-provider route.
7. Dispatch repair/configuration work to an eligible coding agent when needed.
8. Require approval for installation, spending, or changed privacy boundaries.
9. Rerun the complete transcription-to-survey flow.
10. Preserve the mission receipt and unlock only after verification.

**Exit gate:** Echo Mirage recovers from the observed failure rather than merely displaying it.

### Quest 9 — Close the Calyx learning loop

- Store claimed, observed, verified, repeated, stale, and contradicted capability evidence.
- Tie evidence to agent, model, version, surface, environment, task type, artifact, and date.
- Decay confidence and benchmark again after meaningful runtime/model changes.
- Make routing recommendations explainable to the operator.

**Exit gate:** Dispatch can explain why a particular agent was selected using current evidence.

## 8. Initial agent assignment plan

Assignments are best guesses based on current evidence and must be revised as models and tools change.

| Work | Lead | Support/review | Reason |
|---|---|---|---|
| Build profiling and architecture | Codex | Cursor | High-judgment diagnosis first; sustained repo inspection second |
| Mechanical workspace migration | Cursor | Codex review | Long-running, repetitive integration with architectural checkpoints |
| Package-boundary design | Codex | Cursor implementation | Requires dependency judgment and careful public APIs |
| Calyx extraction | Cursor | Codex boundary review | Large implementation surface with explicit architectural gate |
| Voice Lab UX direction | Codex | Operator | Strongest observed web-design output and operator taste |
| Roller Deck propagation and wiring | Cursor | Codex visual review | Reference design followed by sustained implementation |
| Voice-domain consolidation | Codex | Cursor | State-model judgment followed by mechanical migration |
| Synapse/device integration | Pi or capable local agent | Codex/Cursor | Prefer an agent with direct machine/runtime access |
| Dispatch contracts | Codex | MUTHUR/OpenCode review | Cross-system architecture and orchestration semantics |
| Readiness probes | Cursor or Codex | Pi on-device verification | Repository work plus real hardware/environment validation |
| Mission orchestration | MUTHUR | OpenCode model routing | Natural coordinator with selectable runtime/model support |
| Independent reasoning/review | ChatGPT | Operator | Useful where repository mutation is unnecessary |
| Web-design candidates lacking current evidence | Benchmark first | Codex review | Do not route critical design by model reputation alone |

## 9. Token and capacity reserve plan

Echo Mirage must distinguish exact, estimated, and unavailable resource information.

### Capacity states

- **Reported:** the platform provides an exact allowance or percentage.
- **Estimated:** inferred from usage, latency, task history, and failure patterns.
- **Unreported:** no useful meter is exposed.
- **Degraded:** throttling, context loss, compaction, or repeated failures appear.
- **Exhausted:** the provider explicitly refuses further work.

### Reserve policy for this quest

- Keep at least **25% of explicitly reported high-judgment capacity** reserved for architecture corrections, integration failures, and final verification.
- Do not spend scarce design/reasoning capacity on broad mechanical rewrites once acceptance criteria are stable.
- Use Cursor's observed endurance for bounded implementation batches, but checkpoint because its remaining capacity is unreported.
- At approximately **50% context consumption**, require an internal summary of decisions and open risks.
- At approximately **70%**, stop expanding scope and prepare a structured handoff.
- At approximately **85%**, allow only verification, checkpointing, or emergency repair unless the operator overrides.
- Never rely on one agent for mission-critical continuity; store state in repository artifacts and receipts.

### Required checkpoint contents

- objective and current phase;
- decisions and constraints;
- files changed and artifacts produced;
- measurements and tests already run;
- failures and unresolved risks;
- exact next action;
- operator approvals and prohibited actions.

## 10. Operator task list

### Before execution

- [ ] Confirm this charter reflects the intended product and authority boundaries.
- [ ] Identify the build that actually takes approximately twenty minutes: local production, CI, Electron packaging, or more than one.
- [ ] Preserve or commit unrelated active voice/TTS work before broad restructuring.
- [ ] Decide which branch/worktree will contain the build-performance program.
- [ ] Identify any mission-critical dates that constrain migration risk.
- [ ] List providers or local engines approved for automatic STT/TTS fallback.
- [ ] State privacy rules for survey audio and whether it may leave the device.
- [ ] State spending limits and which changes always require approval.

### Voice Lab decisions

- [ ] Demonstrate the two or more current ways MUTHUR's voice can be set.
- [ ] Choose terminology for preview voice, saved profile, and active agent assignment.
- [ ] Rank the Svelte and Cyberdeck Voice Lab UX elements worth preserving.
- [ ] Confirm whether M4trix should support manual import, automatic local sync, or both.

### Fleet and mission readiness

- [ ] List the machines and agent surfaces Echo Mirage should discover first.
- [ ] Confirm which agents may modify code, install software, spend provider credit, or alter configuration.
- [ ] Choose the first approved Mac-local STT fallback candidate.
- [ ] Provide a short representative survey audio sample for the readiness probe.
- [ ] Define what must pass before a critical survey mission may launch.

### Review cadence

- [ ] Review evidence at the end of every quest rather than approving the entire migration at once.
- [ ] Re-rank agents after major model/runtime updates or failed acceptance tests.
- [ ] Keep operator ratings attached to artifacts and task type, not global personality judgments.

## 11. Codex task list

### Immediate, preparation and diagnosis

- [ ] Finish the cold/warm build timing breakdown without touching unrelated work.
- [ ] Measure TypeScript separately with extended diagnostics.
- [ ] Time each build preprocessing step.
- [ ] inspect caching, tracing, source transpilation, import cycles, barrels, generated artifacts, and CI duplication.
- [ ] Produce the build-baseline report with ranked low-risk interventions.
- [ ] Propose the first reviewable patch; do not begin a monorepo rewrite prematurely.

### Architecture preparation

- [ ] Draft package-boundary rules and dependency direction from actual imports.
- [ ] Identify the smallest Calyx extraction seam.
- [ ] Inventory all voice selection and assignment pathways.
- [ ] Draft canonical voice and agent/dispatch contracts.
- [ ] Define benchmark and acceptance checks for affected-only builds.

### Verification responsibilities

- [ ] Preserve before/after timing evidence for every build change.
- [ ] Verify production build, typecheck, relevant probes, and product behavior after each phase.
- [ ] Review high-judgment UI work against screenshots and explicit interaction states.
- [ ] Maintain the charter's current-state, decision, risk, and progress sections as evidence changes.

## 12. Decisions still open

1. Which observed twenty-minute path is the primary optimization target?
2. Does Svelte Voice Lab remain a shipped workspace app or a temporary UX laboratory?
3. Which voice engine owns canonical rendering, and which pieces remain provider adapters?
4. What is the first transport contract between Dispatch and Synapse?
5. What persistence layer owns missions, receipts, and capability evidence?
6. Which Mac-local STT route is approved as the first fallback?
7. Which actions may Dispatch execute automatically during a critical mission?
8. What evidence threshold allows Calyx to call a capability verified?

## 13. Start criteria

Execution begins when:

- the operator accepts the north star and authority rules;
- the relevant current work is protected;
- the target build path is named;
- diagnostic commands and normal build artifacts are authorized;
- the first quest is limited to measurement and reversible fixes.

Until then, continue refining this document rather than moving production architecture.

