import type { CareerPortfolioSnapshot } from "./career-types";
import type { CareerPortfolioData } from "./career-repository";
import { buildCareerTimeline } from "./career-timeline";

function isDraftStatus(status: string): boolean {
  return status === "DRAFT";
}

function collectDates(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

export function buildCareerSummary(data: CareerPortfolioData) {
  const draftRecordCount = [
    ...data.employers,
    ...data.engagements,
    ...data.projects,
    ...data.accomplishments,
    ...data.education,
    ...data.certifications,
  ].filter((record) => isDraftStatus(record.status)).length;

  const verifiedAccomplishmentCount = data.accomplishments.filter(
    (record) => record.status === "VERIFIED",
  ).length;

  const currentRoleCount =
    data.employers.filter((record) => record.current).length +
    data.engagements.filter((record) => record.current).length;

  const datedValues = collectDates([
    ...data.employers.flatMap((record) => [record.startDate, record.endDate]),
    ...data.engagements.flatMap((record) => [record.startDate, record.endDate]),
    ...data.projects.flatMap((record) => [record.startDate, record.endDate]),
    ...data.education.flatMap((record) => [record.startDate, record.endDate]),
    ...data.certifications.flatMap((record) => [record.issuedDate, record.expirationDate]),
  ]);

  datedValues.sort();

  return {
    employerCount: data.employers.length,
    engagementCount: data.engagements.length,
    projectCount: data.projects.length,
    verifiedAccomplishmentCount,
    draftRecordCount,
    evidencedSkillCount: data.skills.length,
    earliestCareerDate: datedValues[0],
    latestCareerDate: datedValues.at(-1),
    currentRoleCount,
  };
}

export function assemblePortfolioSnapshot(data: CareerPortfolioData): CareerPortfolioSnapshot {
  const timeline = buildCareerTimeline(data);
  const summary = buildCareerSummary(data);
  return { ...data, timeline, summary };
}

export function countDraftRecords(data: CareerPortfolioData): number {
  return buildCareerSummary(data).draftRecordCount;
}

export type { CareerPortfolioData };
