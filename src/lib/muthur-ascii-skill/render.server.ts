import { renderAsciiTemplate } from "@/lib/muthur-ascii-skill/templates";
import type { AsciiRenderRequest, AsciiRenderResponse } from "@/lib/muthur-ascii-skill/types";
import { normalizeAsciiWidth, validateAsciiOutput, validateAsciiRenderRequest } from "@/lib/muthur-ascii-skill/validate";
import { resolveStyleProfile } from "@/lib/muthur-ascii-skill/styles";

/** Render structured ASCII from MUTHUR ascii.render intent — geometry handled here, not by the model. */
export function renderAsciiSkill(raw: unknown): AsciiRenderResponse {
  const validated = validateAsciiRenderRequest(raw);
  if (!validated.ok) return { ok: false, error: validated.error };

  const request = validated.request;
  const width = normalizeAsciiWidth(request.width);
  const style = resolveStyleProfile(request.style);
  const lines = renderAsciiTemplate({ ...request, width });
  const output = validateAsciiOutput(lines.join("\n"), width);

  if (!output.trim()) {
    return { ok: false, error: "ascii.render produced empty output" };
  }

  return {
    ok: true,
    output,
    width,
    template: request.template,
    style: style.id,
  };
}

export function renderAsciiSkillFromRequest(request: AsciiRenderRequest): AsciiRenderResponse {
  return renderAsciiSkill(request);
}
