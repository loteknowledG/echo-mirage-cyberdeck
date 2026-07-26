import type { CareerTimelineEntry } from "./career-types";
import type { CareerPortfolioData } from "./career-repository";

export const UNDATED_TIMELINE_GROUP = "Date not recorded";

type DatedEntry = CareerTimelineEntry & { sortKey: string };

function compareEntries(a: DatedEntry, b: DatedEntry): number {
  if (a.sortKey === UNDATED_TIMELINE_GROUP && b.sortKey !== UNDATED_TIMELINE_GROUP) return 1;
  if (b.sortKey === UNDATED_TIMELINE_GROUP && a.sortKey !== UNDATED_TIMELINE_GROUP) return -1;
  if (a.sortKey !== b.sortKey) return a.sortKey.localeCompare(b.sortKey);
  return a.label.localeCompare(b.label);
}

function sortKeyFor(startDate?: string, endDate?: string): string {
  return startDate ?? endDate ?? UNDATED_TIMELINE_GROUP;
}

export function buildCareerTimeline(data: CareerPortfolioData): CareerTimelineEntry[] {
  const entries: DatedEntry[] = [];

  for (const employer of data.employers) {
    entries.push({
      id: `timeline-employer-${employer.id}`,
      type: "EMPLOYER",
      label: employer.name,
      startDate: employer.startDate,
      endDate: employer.endDate,
      current: employer.current,
      employerId: employer.id,
      recordId: employer.id,
      sortKey: sortKeyFor(employer.startDate, employer.endDate),
    });
  }

  for (const engagement of data.engagements) {
    const employer = data.employers.find((record) => record.id === engagement.employerId);
    entries.push({
      id: `timeline-engagement-${engagement.id}`,
      type: "ENGAGEMENT",
      label: engagement.clientName,
      startDate: engagement.startDate,
      endDate: engagement.endDate,
      current: engagement.current,
      employerId: engagement.employerId,
      engagementId: engagement.id,
      recordId: engagement.id,
      sortKey: sortKeyFor(engagement.startDate, engagement.endDate),
    });
    if (!employer) {
      continue;
    }
  }

  for (const project of data.projects) {
    entries.push({
      id: `timeline-project-${project.id}`,
      type: "PROJECT",
      label: project.name,
      startDate: project.startDate,
      endDate: project.endDate,
      employerId: project.employerId,
      engagementId: project.engagementId,
      recordId: project.id,
      sortKey: sortKeyFor(project.startDate, project.endDate),
    });
  }

  for (const education of data.education) {
    entries.push({
      id: `timeline-education-${education.id}`,
      type: "EDUCATION",
      label: education.institution,
      startDate: education.startDate,
      endDate: education.endDate,
      recordId: education.id,
      sortKey: sortKeyFor(education.startDate, education.endDate),
    });
  }

  for (const certification of data.certifications) {
    entries.push({
      id: `timeline-certification-${certification.id}`,
      type: "CERTIFICATION",
      label: certification.name,
      startDate: certification.issuedDate,
      endDate: certification.expirationDate,
      recordId: certification.id,
      sortKey: sortKeyFor(certification.issuedDate, certification.expirationDate),
    });
  }

  entries.sort(compareEntries);
  return entries.map(({ sortKey: _sortKey, ...entry }) => entry);
}

export type CareerTimelineGroup = {
  groupLabel: string;
  employers: Array<{
    employer: CareerTimelineEntry;
    engagements: CareerTimelineEntry[];
  }>;
  undated: CareerTimelineEntry[];
};

export function groupCareerTimeline(data: CareerPortfolioData): CareerTimelineGroup[] {
  const timeline = buildCareerTimeline(data);
  const employers = timeline.filter((entry) => entry.type === "EMPLOYER");
  const engagements = timeline.filter((entry) => entry.type === "ENGAGEMENT");

  const grouped = employers.map((employer) => ({
    employer,
    engagements: engagements.filter((entry) => entry.employerId === employer.recordId),
  }));

  const undated = timeline.filter(
    (entry) =>
      entry.type !== "EMPLOYER" &&
      entry.type !== "ENGAGEMENT" &&
      !entry.startDate &&
      !entry.endDate,
  );

  const groups = new Map<string, CareerTimelineGroup>();

  for (const item of grouped) {
    const groupLabel = item.employer.startDate ?? item.employer.endDate ?? UNDATED_TIMELINE_GROUP;
    const existing = groups.get(groupLabel) ?? {
      groupLabel,
      employers: [],
      undated: [],
    };
    existing.employers.push(item);
    groups.set(groupLabel, existing);
  }

  if (undated.length > 0) {
    const existing = groups.get(UNDATED_TIMELINE_GROUP) ?? {
      groupLabel: UNDATED_TIMELINE_GROUP,
      employers: [],
      undated: [],
    };
    existing.undated = undated;
    groups.set(UNDATED_TIMELINE_GROUP, existing);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.groupLabel === UNDATED_TIMELINE_GROUP) return 1;
    if (b.groupLabel === UNDATED_TIMELINE_GROUP) return -1;
    return a.groupLabel.localeCompare(b.groupLabel);
  });
}
