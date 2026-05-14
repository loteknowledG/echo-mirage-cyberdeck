# CODEX RESIDUAL CLOSURE INITIATION

You are operating as:

> Codex Verification Authority for Echo Mirage residual hardening review.

This review is NOT:

* a feature review
* a speculative architecture discussion
* a partial implementation acceptance
* a “close enough” approval

This review IS:

* residual closure verification
* hardening confirmation
* doctrine enforcement
* regression prevention

The previous implementation PASS does NOT automatically close residuals.

Residuals remain open until independently verified as:

* FIXED
* ALREADY FIXED
* or INTENTIONALLY LEFT with justification

---

# CURRENT TARGET

Control Lease Hardening v0 residual closure.

The following residuals are specifically under review:

1. `grantLease()` remains exported and may bypass `requestLease()` policy.
2. `CONTROL_DENIED` is not emitted by `action-runner.ts` for ownership/scope denial.
3. `next-env.d.ts` drift from:
   `.next/types/routes.d.ts`
   to:
   `.next/dev/types/routes.d.ts`

These are the ONLY focus areas unless regressions are discovered.

---

# REVIEW REQUIREMENTS

You must verify each residual individually.

For EACH residual, classify as:

```text
FIXED
ALREADY FIXED
INTENTIONALLY LEFT
NOT FIXED
```

Do NOT infer completion from prior PASS reports.

You must inspect current implementation state directly.

---

# REQUIRED COMMANDS

Run and inspect:

```bash
git status --short

rg "grantLease|requestLease|CONTROL_DENIED|OWNERSHIP_DENIED|next/dev/types|next/types" src electron next-env.d.ts

git diff -- next-env.d.ts src/lib/computer-use/control-lease.ts src/lib/computer-use/action-runner.ts

pnpm exec tsc --noEmit

pnpm exec eslint src/lib/computer-use electron/main.js electron/preload.js

pnpm build

pnpm e2e
```

You are expected to inspect implementation behavior, not only search text.

---

# REQUIRED RUNTIME VERIFICATION

Verify:

* USER retake succeeds
* MUTHUR/non-USER retake denied
* invalid lease duration denied
* ownership-denied actions emit `CONTROL_DENIED`
* MUTHUR observation lease denies `paste_text`
* ownership remains unchanged after denied revoke
* malformed actions still fail honestly

---

# DOCTRINE ENFORCEMENT

Echo Mirage requires:

* bounded embodiment
* interruptibility
* visible ownership
* honest unsupported states
* operational trust over optimistic approval
* continuity over spectacle

Human override remains absolute.

No unrestricted control paths may emerge through residual drift.

---

# REQUIRED OUTPUT FORMAT

```text
REVIEW OUTCOME: PASS / REVISE / FAIL
```

Then include:

## COMMANDS EXECUTED

## FILES INSPECTED

## RESIDUAL STATUS

For each residual:

* FIXED / NOT FIXED / etc.
* evidence

## VERIFIED

## ISSUES FOUND

## FINAL JUDGMENT

Do NOT blur:

* implemented
* claimed
* inferred
* verified

If uncertainty remains:
DO NOT PASS.
