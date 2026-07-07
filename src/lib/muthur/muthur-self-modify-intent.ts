import type { MuthurPosture } from "@/lib/muthur/muthur-posture";

/** Operator wants MUTHUR / Echo Mirage to change this deck's source code. */
export function isMuthurSelfModifyIntent(message: string): boolean {
  const lower = message.trim().toLowerCase();
  if (!lower) return false;

  const mentionsSelf =
    /\b(your(?:self)?|your own|muthur'?s?|this deck|the deck|echo[- ]?mirage|cyberdeck|this (?:app|repo|codebase|project))\b/.test(
      lower,
    );
  const mentionsCode =
    /\b(code|source|repo|repository|codebase|implementation|typescript|tsx?|files?|module|component|route|api)\b/.test(
      lower,
    );
  const asksChange =
    /\b(change|edit|modify|update|fix|patch|refactor|implement|add|remove|rewrite|adjust|tweak|wire|hook up|enable)\b/.test(
      lower,
    );

  if (mentionsSelf && mentionsCode && asksChange) return true;

  return (
    /\b(change|edit|modify|update|fix|patch)\b.*\b(your(?:self)?|your own)\b.*\b(code|source)\b/.test(
      lower,
    ) ||
    /\b(make it so|let me|allow me to)\b.*\b(ask muthur|muthur)\b.*\b(change|edit|modify)\b/.test(lower)
  );
}

export function buildMuthurSelfModifyPrompt(
  posture: MuthurPosture,
  workspaceRoot: string,
): string {
  const repo = workspaceRoot.replace(/\\/g, "/");

  if (posture === "plan") {
    return (
      "\n\nECHO MIRAGE SELF-MODIFY: The operator wants changes to this deck's source (MUTHUR / Echo Mirage). " +
      "Self-modification is explicitly permitted — do NOT refuse because the target is your own codebase. " +
      `Plan posture is read-only: inspect with localfs cat/ls under ${repo}, outline the exact files and edits, ` +
      "and tell the operator to switch to Agent (USE) so you can apply localfs write patches."
    );
  }

  if (posture === "commander") {
    return (
      "\n\nECHO MIRAGE SELF-MODIFY: The operator wants changes to this deck's source. " +
      "Self-modification is permitted on this repo. With an ACTIVE mission, use localfs write (or open_operator_file + suggest_operator_edit) " +
      `under ${repo} — especially src/features/cyberdeck/, src/components/cyberdeck/, src/lib/muthur-core/, src/app/. ` +
      "Run git_diff and workspace_exec tsc after edits. Do NOT refuse."
    );
  }

  return (
    "\n\nECHO MIRAGE SELF-MODIFY: The operator directed changes to this deck's source — your own Echo Mirage codebase. " +
    "This is authorized. Execute with localfs cat → localfs write (or open_operator_file + suggest_operator_edit). " +
    `Repo root: ${repo}. Prefer surgical patches in src/ over broad rewrites. ` +
    "After edits: git_diff/git_status and workspace_exec `pnpm exec tsc --noEmit`. Do NOT refuse because the code is MUTHUR itself."
  );
}
