import { pmCallScenarioById } from "@/lib/pm-call-center/scenarios";
import type { PmCallEpisodeDigest, PmCallTurn } from "@/lib/pm-call-center/types";
import { findBestMatchingOpenCase } from "@/lib/property-manager/cases/matching.server";
import { buildCallId } from "@/lib/property-manager/cases/paths";
import { nextCaseSequence } from "@/lib/property-manager/cases/sequence.server";
import {
  buildLookupKey,
  buildLookupTags,
  scenarioCaseContext,
  urgencyToSeverity,
} from "@/lib/property-manager/cases/scenario-context";
import { buildCallSummaryMarkdown, buildCaseSummaryMarkdown } from "@/lib/property-manager/cases/summary";
import {
  appendCaseEvent,
  buildNewCaseRecord,
  readCaseRecord,
  readTimelineMarkdown,
  writeCallArtifacts,
  writeCaseRecord,
  writeCaseSummaryMarkdown,
  writeTimelineMarkdown,
} from "@/lib/property-manager/cases/store.server";
import { appendTimelineLine } from "@/lib/property-manager/cases/timeline";
import { buildTranscriptJson, buildTranscriptMarkdown } from "@/lib/property-manager/cases/transcript-files";
import type { CaseEvent, PersistedCallRecord, PropertyCase } from "@/lib/property-manager/cases/types";

export type PersistPmCallInput = {
  scenarioId: string;
  turns: PmCallTurn[];
  digest: PmCallEpisodeDigest;
  startedAt: number;
  endedAt: number;
  attachCaseSlug?: string;
};

function mergeSeverity(
  current: PropertyCase["severity"],
  next: PropertyCase["severity"],
): PropertyCase["severity"] {
  const rank: Record<PropertyCase["severity"], number> = {
    low: 1,
    normal: 2,
    urgent: 3,
    emergency: 4,
  };
  return rank[next] > rank[current] ? next : current;
}

function buildLookupAliases(ctx: ReturnType<typeof scenarioCaseContext>, digest: PmCallEpisodeDigest): string[] {
  const aliases = new Set<string>();
  aliases.add(`${ctx.residentName} ${ctx.unitId.toUpperCase()} ${ctx.issue.replace(/-/g, " ")}`);
  aliases.add(`${ctx.unitId.toUpperCase()} ${ctx.title.toLowerCase()}`);
  if (digest.residentIntent.trim()) {
    aliases.add(digest.residentIntent.trim().toLowerCase());
  }
  return [...aliases];
}

function timelineNotesFromDigest(digest: PmCallEpisodeDigest): string[] {
  const notes = [`Call classified ${urgencyToSeverity(digest.routing.urgency)}`];
  if (digest.operatorActions[0]) {
    notes.push(digest.operatorActions[0]);
  }
  return notes;
}

export async function persistPmCall(input: PersistPmCallInput): Promise<PersistedCallRecord> {
  const scenario = pmCallScenarioById(input.scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${input.scenarioId}`);
  }

  const ctx = scenarioCaseContext(scenario);
  const severity = urgencyToSeverity(input.digest.routing.urgency);
  const callId = buildCallId(input.endedAt);
  const nowIso = new Date(input.endedAt).toISOString();

  let caseRecord: PropertyCase | null = null;
  let createdCase = false;
  let matchedExistingCase = false;

  if (input.attachCaseSlug) {
    caseRecord = await readCaseRecord(input.attachCaseSlug);
    if (!caseRecord) {
      throw new Error(`Case not found: ${input.attachCaseSlug}`);
    }
    matchedExistingCase = true;
  } else {
    const match = await findBestMatchingOpenCase(ctx);
    if (match) {
      caseRecord = await readCaseRecord(match.slug);
      matchedExistingCase = Boolean(caseRecord);
    }
  }

  if (!caseRecord) {
    const { year, sequence } = await nextCaseSequence();
    const lookupKey = buildLookupKey(ctx);
    caseRecord = buildNewCaseRecord({
      year,
      sequence,
      ctx,
      severity,
      lookup: {
        key: lookupKey,
        aliases: buildLookupAliases(ctx, input.digest),
        tags: buildLookupTags(ctx, severity, "intake"),
      },
      nowIso,
    });
    createdCase = true;
  }

  if (caseRecord.callIds.includes(callId)) {
    throw new Error(`Call ${callId} already recorded on case ${caseRecord.id}`);
  }

  const transcriptMd = buildTranscriptMarkdown({
    callId,
    caseId: caseRecord.id,
    turns: input.turns,
  });
  const transcriptJson = buildTranscriptJson({
    callId,
    caseId: caseRecord.id,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    turns: input.turns,
  });
  const callSummaryMd = buildCallSummaryMarkdown(input.digest);

  await writeCallArtifacts({
    caseSlug: caseRecord.slug,
    callId,
    transcriptMd,
    transcriptJson,
    summaryMd: callSummaryMd,
  });

  caseRecord = {
    ...caseRecord,
    severity: mergeSeverity(caseRecord.severity, severity),
    stage: createdCase ? "intake" : caseRecord.stage === "intake" ? "triage" : caseRecord.stage,
    status: caseRecord.status === "closed" ? "open" : caseRecord.status,
    callIds: [...caseRecord.callIds, callId],
    lookup: {
      ...caseRecord.lookup,
      aliases: [...new Set([...caseRecord.lookup.aliases, ...buildLookupAliases(ctx, input.digest)])],
      tags: [...new Set([...caseRecord.lookup.tags, ...buildLookupTags(ctx, severity, caseRecord.stage)])],
    },
    updatedAt: nowIso,
  };

  await writeCaseRecord(caseRecord);
  await writeCaseSummaryMarkdown(caseRecord.slug, buildCaseSummaryMarkdown(caseRecord));

  let timeline = await readTimelineMarkdown(caseRecord.slug);
  timeline = appendTimelineLine(timeline, nowIso, "Call started");
  for (const turn of input.turns) {
    if (turn.role === "resident" && turn.text.trim()) {
      timeline = appendTimelineLine(
        timeline,
        new Date(turn.at).toISOString(),
        `Resident: ${turn.text.trim().slice(0, 120)}`,
      );
    }
  }
  for (const note of timelineNotesFromDigest(input.digest)) {
    timeline = appendTimelineLine(timeline, nowIso, note);
  }
  timeline = appendTimelineLine(timeline, nowIso, "Call ended");
  await writeTimelineMarkdown(caseRecord.slug, timeline);

  const events: CaseEvent[] = [];
  if (createdCase) {
    events.push({
      type: "case_created",
      timestamp: nowIso,
      caseId: caseRecord.id,
      callId,
    });
  } else {
    events.push({
      type: "case_updated",
      timestamp: nowIso,
      caseId: caseRecord.id,
      callId,
    });
  }
  events.push({
    type: "call_ended",
    timestamp: nowIso,
    caseId: caseRecord.id,
    callId,
  });

  for (const event of events) {
    await appendCaseEvent(caseRecord.slug, event);
  }

  return {
    callId,
    caseId: caseRecord.id,
    caseSlug: caseRecord.slug,
    folderRelative: `data/property-manager/cases/${caseRecord.slug}`,
    createdCase,
    matchedExistingCase,
  };
}
