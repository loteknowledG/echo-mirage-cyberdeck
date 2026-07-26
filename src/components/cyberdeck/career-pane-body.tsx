"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import type {
  ApiResponse,
  CareerAccomplishment,
  CareerEvidence,
  CareerEvidenceRecordType,
  CareerPortfolioSnapshot,
  CareerProject,
  CareerSkillEvidence,
  CareerStatusPayload,
  ClientEngagement,
  Employer,
} from "@/lib/calyx/domains/career";
import { groupCareerTimeline } from "@/lib/calyx/domains/career";
import { cn } from "@/lib/utils";

type LoadState = "loading" | "ready" | "error" | "unavailable";

const RECORD_TYPES_WITH_STATUS: CareerEvidenceRecordType[] = [
  "EMPLOYER",
  "ENGAGEMENT",
  "PROJECT",
  "ACCOMPLISHMENT",
];

async function readApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const payload = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !payload.ok) {
    const message = payload.ok ? "Request failed" : payload.error.message;
    throw new Error(message);
  }
  return payload.data;
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-[#1d1d1d] bg-[#050505] px-2 py-1">
      <div className="text-[8px] uppercase tracking-wide text-[#7a7a7a]">{label}</div>
      <div className="text-[11px] text-[#d8d8d8]">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded border border-[#2a2a2a] px-1 py-0.5 text-[8px] uppercase text-[#bdbdbd]">
      {status}
    </span>
  );
}

function ActionButton({
  label,
  disabled,
  onClick,
  tone = "neutral",
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  tone?: "neutral" | "danger" | "verify";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "shrink-0 rounded border px-2 py-1 text-[8px] uppercase disabled:opacity-40",
        tone === "danger" && "border-red-900/60 text-red-200",
        tone === "verify" && "border-emerald-900/60 text-emerald-200",
        tone === "neutral" && "border-[#333] text-[#bdbdbd]",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function RecordActions({
  busy,
  status,
  recordType,
  recordId,
  onEdit,
  onDelete,
  onVerify,
}: {
  busy: boolean;
  status?: string;
  recordType: CareerEvidenceRecordType;
  recordId: string;
  onEdit: () => void;
  onDelete: () => void;
  onVerify: (recordType: CareerEvidenceRecordType, recordId: string) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap gap-1">
      <ActionButton label="Edit" disabled={busy} onClick={onEdit} />
      <ActionButton
        label="Delete"
        disabled={busy}
        tone="danger"
        onClick={onDelete}
      />
      {status === "DRAFT" && RECORD_TYPES_WITH_STATUS.includes(recordType) ? (
        <ActionButton
          label="Verify"
          disabled={busy}
          tone="verify"
          onClick={() => onVerify(recordType, recordId)}
        />
      ) : null}
    </div>
  );
}

export function CyberdeckCareerPaneBody() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<CareerPortfolioSnapshot | null>(null);
  const [status, setStatus] = useState<CareerStatusPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const [profileName, setProfileName] = useState("");
  const [profileHeadline, setProfileHeadline] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [engagementEmployerId, setEngagementEmployerId] = useState("");
  const [engagementClientName, setEngagementClientName] = useState("");
  const [engagementTitle, setEngagementTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectEngagementId, setProjectEngagementId] = useState("");
  const [accomplishmentStatement, setAccomplishmentStatement] = useState("");
  const [skillName, setSkillName] = useState("");
  const [skillProjectId, setSkillProjectId] = useState("");
  const [evidenceSourceName, setEvidenceSourceName] = useState("");
  const [linkEvidenceId, setLinkEvidenceId] = useState("");
  const [linkRecordType, setLinkRecordType] =
    useState<CareerEvidenceRecordType>("ACCOMPLISHMENT");
  const [linkRecordId, setLinkRecordId] = useState("");

  const [editingEmployerId, setEditingEmployerId] = useState<string | null>(null);
  const [editingEmployerName, setEditingEmployerName] = useState("");
  const [editingEngagementId, setEditingEngagementId] = useState<string | null>(null);
  const [editingEngagementClient, setEditingEngagementClient] = useState("");
  const [editingEngagementTitle, setEditingEngagementTitle] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [editingAccomplishmentId, setEditingAccomplishmentId] = useState<string | null>(null);
  const [editingAccomplishmentStatement, setEditingAccomplishmentStatement] = useState("");

  const refresh = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    try {
      const [nextPortfolio, nextStatus] = await Promise.all([
        readApi<CareerPortfolioSnapshot>("/api/calyx/career"),
        readApi<CareerStatusPayload>("/api/calyx/career/status"),
      ]);
      if (!nextStatus.repositoryAvailable) {
        setLoadState("unavailable");
        setStatus(nextStatus);
        return;
      }
      setPortfolio(nextPortfolio);
      setStatus(nextStatus);
      setProfileName(nextPortfolio.profile.displayName);
      setProfileHeadline(nextPortfolio.profile.headline ?? "");
      setLoadState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Career module unavailable");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const timelineGroups = useMemo(
    () => (portfolio ? groupCareerTimeline(portfolio) : []),
    [portfolio],
  );

  const employers = portfolio?.employers ?? [];
  const engagements = portfolio?.engagements ?? [];
  const projects = portfolio?.projects ?? [];
  const accomplishments = portfolio?.accomplishments ?? [];
  const skills = portfolio?.skills ?? [];
  const evidence = portfolio?.evidence ?? [];
  const evidenceLinks = portfolio?.evidenceLinks ?? [];

  async function mutate<T>(
    fn: () => Promise<T>,
    onSuccess?: () => void,
  ): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await fn();
      await refresh();
      onSuccess?.();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function postJson<T>(url: string, body: unknown): Promise<T | undefined> {
    return mutate(() =>
      readApi<T>(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  async function patchJson<T>(url: string, body: unknown): Promise<T | undefined> {
    return mutate(() =>
      readApi<T>(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  async function deleteJson(url: string): Promise<void> {
    await mutate(() =>
      readApi<{ deleted: boolean }>(url, { method: "DELETE" }),
    );
  }

  async function verifyRecord(recordType: CareerEvidenceRecordType, recordId: string) {
    await postJson("/api/calyx/career/verify", { recordType, recordId });
  }

  async function confirmDelete(label: string, url: string) {
    if (!window.confirm(`Delete ${label}?`)) return;
    await deleteJson(url);
  }

  const subtitle =
    status == null
      ? "CALYX CAREER // LOADING"
      : `CALYX CAREER // ${status.storageMode.toUpperCase()} // ${status.calyxStatus}`;

  const linkTargetOptions = useMemo(() => {
    switch (linkRecordType) {
      case "EMPLOYER":
        return employers.map((e) => ({ id: e.id, label: e.name }));
      case "ENGAGEMENT":
        return engagements.map((e) => ({ id: e.id, label: e.clientName }));
      case "PROJECT":
        return projects.map((p) => ({ id: p.id, label: p.name }));
      case "ACCOMPLISHMENT":
        return accomplishments.map((a) => ({ id: a.id, label: a.statement.slice(0, 48) }));
      case "SKILL":
        return skills.map((s) => ({ id: s.id, label: s.skill }));
      default:
        return [];
    }
  }, [linkRecordType, employers, engagements, projects, accomplishments, skills]);

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                CAREER INTELLIGENCE
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>{subtitle}</CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />

        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 font-mono text-[10px]">
          {loadState === "loading" ? (
            <div className="text-[9px] text-[#8f8f8f]">LOADING CAREER PORTFOLIO…</div>
          ) : null}
          {loadState === "error" ? (
            <div className="text-[9px] text-amber-200/90">CAREER OFFLINE // {error}</div>
          ) : null}
          {loadState === "unavailable" ? (
            <div className="text-[9px] text-amber-200/90">
              REPOSITORY UNAVAILABLE // SELECTED STORAGE MODE IS NOT READY
            </div>
          ) : null}

          {portfolio && loadState === "ready" ? (
            <>
              <section className="space-y-2">
                <div className="text-[9px] uppercase tracking-wide text-[#8a8a8a]">
                  Career Overview
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <StatCell label="Profile" value={portfolio.profile.displayName} />
                  <StatCell label="Headline" value={portfolio.profile.headline ?? "—"} />
                  <StatCell label="Employers" value={portfolio.summary.employerCount} />
                  <StatCell label="Clients" value={portfolio.summary.engagementCount} />
                  <StatCell label="Projects" value={portfolio.summary.projectCount} />
                  <StatCell
                    label="Verified accomplishments"
                    value={portfolio.summary.verifiedAccomplishmentCount}
                  />
                  <StatCell label="Draft records" value={portfolio.summary.draftRecordCount} />
                  <StatCell label="Evidenced skills" value={portfolio.summary.evidencedSkillCount} />
                </div>
              </section>

              <section className="space-y-2">
                <div className="text-[9px] uppercase tracking-wide text-[#8a8a8a]">
                  Career Timeline
                </div>
                {timelineGroups.length === 0 ? (
                  <div className="text-[9px] text-[#7d7d7d]">NO TIMELINE RECORDS YET.</div>
                ) : (
                  timelineGroups.map((group) => (
                    <div key={group.groupLabel} className="rounded border border-[#171717] p-2">
                      <div className="mb-1 text-[8px] uppercase text-[#6f6f6f]">
                        {group.groupLabel}
                      </div>
                      {group.employers.map(({ employer, engagements: nested }) => (
                        <div key={employer.id} className="mb-2">
                          <div className="text-[10px] text-[#dcdcdc]">{employer.label}</div>
                          {nested.length > 0 ? (
                            <ul className="ml-3 mt-1 space-y-0.5 border-l border-[#222] pl-2">
                              {nested.map((entry) => (
                                <li key={entry.id} className="text-[9px] text-[#a8a8a8]">
                                  └ {entry.label}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </section>

              <section className="space-y-2">
                <div className="text-[9px] uppercase tracking-wide text-[#8a8a8a]">
                  Record Management
                </div>

                <form
                  className="space-y-1 rounded border border-[#171717] p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void patchJson("/api/calyx/career/profile", {
                      displayName: profileName,
                      headline: profileHeadline,
                    });
                  }}
                >
                  <div className="text-[8px] text-[#777]">Profile</div>
                  <input
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    placeholder="Display name"
                  />
                  <input
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={profileHeadline}
                    onChange={(event) => setProfileHeadline(event.target.value)}
                    placeholder="Headline"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded border border-[#333] px-2 py-1 text-[9px] uppercase"
                  >
                    Save profile
                  </button>
                </form>

                <form
                  className="space-y-1 rounded border border-[#171717] p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void postJson("/api/calyx/career/employers", {
                      name: employerName,
                      current: false,
                    }).then(() => setEmployerName(""));
                  }}
                >
                  <div className="text-[8px] text-[#777]">Add employer</div>
                  <input
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={employerName}
                    onChange={(event) => setEmployerName(event.target.value)}
                    placeholder="Employer name"
                  />
                  <button
                    type="submit"
                    disabled={busy || !employerName.trim()}
                    className="rounded border border-[#333] px-2 py-1 text-[9px] uppercase"
                  >
                    Add employer
                  </button>
                </form>

                {employers.length > 0 ? (
                  <div className="space-y-1 rounded border border-[#171717] p-2">
                    <div className="text-[8px] text-[#777]">Employers</div>
                    {employers.map((employer: Employer) => (
                      <div
                        key={employer.id}
                        className="flex items-start justify-between gap-2 border-t border-[#1a1a1a] pt-1 first:border-t-0 first:pt-0"
                      >
                        <div className="min-w-0 flex-1">
                          {editingEmployerId === employer.id ? (
                            <div className="space-y-1">
                              <input
                                className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                                value={editingEmployerName}
                                onChange={(e) => setEditingEmployerName(e.target.value)}
                              />
                              <div className="flex gap-1">
                                <ActionButton
                                  label="Save"
                                  disabled={busy}
                                  onClick={() =>
                                    void patchJson(`/api/calyx/career/employers/${employer.id}`, {
                                      name: editingEmployerName,
                                    }).then(() => setEditingEmployerId(null))
                                  }
                                />
                                <ActionButton
                                  label="Cancel"
                                  disabled={busy}
                                  onClick={() => setEditingEmployerId(null)}
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <StatusBadge status={employer.status} />
                              <div className="mt-1 text-[9px] text-[#bdbdbd]">{employer.name}</div>
                            </>
                          )}
                        </div>
                        {editingEmployerId !== employer.id ? (
                          <RecordActions
                            busy={busy}
                            status={employer.status}
                            recordType="EMPLOYER"
                            recordId={employer.id}
                            onEdit={() => {
                              setEditingEmployerId(employer.id);
                              setEditingEmployerName(employer.name);
                            }}
                            onDelete={() =>
                              void confirmDelete(employer.name, `/api/calyx/career/employers/${employer.id}`)
                            }
                            onVerify={verifyRecord}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                <form
                  className="space-y-1 rounded border border-[#171717] p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void postJson("/api/calyx/career/engagements", {
                      employerId: engagementEmployerId,
                      clientName: engagementClientName,
                      title: engagementTitle,
                      current: false,
                    }).then(() => {
                      setEngagementClientName("");
                      setEngagementTitle("");
                    });
                  }}
                >
                  <div className="text-[8px] text-[#777]">Add client engagement</div>
                  <select
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={engagementEmployerId}
                    onChange={(event) => setEngagementEmployerId(event.target.value)}
                  >
                    <option value="">Select employer</option>
                    {employers.map((employer: Employer) => (
                      <option key={employer.id} value={employer.id}>
                        {employer.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={engagementClientName}
                    onChange={(event) => setEngagementClientName(event.target.value)}
                    placeholder="Client name"
                  />
                  <input
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={engagementTitle}
                    onChange={(event) => setEngagementTitle(event.target.value)}
                    placeholder="Engagement title"
                  />
                  <button
                    type="submit"
                    disabled={
                      busy ||
                      !engagementEmployerId ||
                      !engagementClientName.trim() ||
                      !engagementTitle.trim()
                    }
                    className="rounded border border-[#333] px-2 py-1 text-[9px] uppercase"
                  >
                    Add engagement
                  </button>
                </form>

                {engagements.length > 0 ? (
                  <div className="space-y-1 rounded border border-[#171717] p-2">
                    <div className="text-[8px] text-[#777]">Client engagements</div>
                    {engagements.map((engagement: ClientEngagement) => {
                      const employerLabel =
                        employers.find((e) => e.id === engagement.employerId)?.name ?? "—";
                      return (
                        <div
                          key={engagement.id}
                          className="flex items-start justify-between gap-2 border-t border-[#1a1a1a] pt-1 first:border-t-0 first:pt-0"
                        >
                          <div className="min-w-0 flex-1">
                            {editingEngagementId === engagement.id ? (
                              <div className="space-y-1">
                                <input
                                  className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                                  value={editingEngagementClient}
                                  onChange={(e) => setEditingEngagementClient(e.target.value)}
                                  placeholder="Client name"
                                />
                                <input
                                  className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                                  value={editingEngagementTitle}
                                  onChange={(e) => setEditingEngagementTitle(e.target.value)}
                                  placeholder="Title"
                                />
                                <div className="flex gap-1">
                                  <ActionButton
                                    label="Save"
                                    disabled={busy}
                                    onClick={() =>
                                      void patchJson(
                                        `/api/calyx/career/engagements/${engagement.id}`,
                                        {
                                          clientName: editingEngagementClient,
                                          title: editingEngagementTitle,
                                        },
                                      ).then(() => setEditingEngagementId(null))
                                    }
                                  />
                                  <ActionButton
                                    label="Cancel"
                                    disabled={busy}
                                    onClick={() => setEditingEngagementId(null)}
                                  />
                                </div>
                              </div>
                            ) : (
                              <>
                                <StatusBadge status={engagement.status} />
                                <div className="mt-1 text-[9px] text-[#bdbdbd]">
                                  {engagement.clientName} — {engagement.title}
                                </div>
                                <div className="text-[8px] text-[#666]">via {employerLabel}</div>
                              </>
                            )}
                          </div>
                          {editingEngagementId !== engagement.id ? (
                            <RecordActions
                              busy={busy}
                              status={engagement.status}
                              recordType="ENGAGEMENT"
                              recordId={engagement.id}
                              onEdit={() => {
                                setEditingEngagementId(engagement.id);
                                setEditingEngagementClient(engagement.clientName);
                                setEditingEngagementTitle(engagement.title);
                              }}
                              onDelete={() =>
                                void confirmDelete(
                                  engagement.clientName,
                                  `/api/calyx/career/engagements/${engagement.id}`,
                                )
                              }
                              onVerify={verifyRecord}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <form
                  className="space-y-1 rounded border border-[#171717] p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void postJson("/api/calyx/career/projects", {
                      name: projectName,
                      engagementId: projectEngagementId || undefined,
                    }).then(() => setProjectName(""));
                  }}
                >
                  <div className="text-[8px] text-[#777]">Add project</div>
                  <select
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={projectEngagementId}
                    onChange={(event) => setProjectEngagementId(event.target.value)}
                  >
                    <option value="">Optional engagement</option>
                    {engagements.map((engagement: ClientEngagement) => (
                      <option key={engagement.id} value={engagement.id}>
                        {engagement.clientName}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Project name"
                  />
                  <button
                    type="submit"
                    disabled={busy || !projectName.trim()}
                    className="rounded border border-[#333] px-2 py-1 text-[9px] uppercase"
                  >
                    Add project
                  </button>
                </form>

                {projects.length > 0 ? (
                  <div className="space-y-1 rounded border border-[#171717] p-2">
                    <div className="text-[8px] text-[#777]">Projects</div>
                    {projects.map((project: CareerProject) => (
                      <div
                        key={project.id}
                        className="flex items-start justify-between gap-2 border-t border-[#1a1a1a] pt-1 first:border-t-0 first:pt-0"
                      >
                        <div className="min-w-0 flex-1">
                          {editingProjectId === project.id ? (
                            <div className="space-y-1">
                              <input
                                className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                                value={editingProjectName}
                                onChange={(e) => setEditingProjectName(e.target.value)}
                              />
                              <div className="flex gap-1">
                                <ActionButton
                                  label="Save"
                                  disabled={busy}
                                  onClick={() =>
                                    void patchJson(`/api/calyx/career/projects/${project.id}`, {
                                      name: editingProjectName,
                                    }).then(() => setEditingProjectId(null))
                                  }
                                />
                                <ActionButton
                                  label="Cancel"
                                  disabled={busy}
                                  onClick={() => setEditingProjectId(null)}
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <StatusBadge status={project.status} />
                              <div className="mt-1 text-[9px] text-[#bdbdbd]">{project.name}</div>
                            </>
                          )}
                        </div>
                        {editingProjectId !== project.id ? (
                          <RecordActions
                            busy={busy}
                            status={project.status}
                            recordType="PROJECT"
                            recordId={project.id}
                            onEdit={() => {
                              setEditingProjectId(project.id);
                              setEditingProjectName(project.name);
                            }}
                            onDelete={() =>
                              void confirmDelete(
                                project.name,
                                `/api/calyx/career/projects/${project.id}`,
                              )
                            }
                            onVerify={verifyRecord}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                <form
                  className="space-y-1 rounded border border-[#171717] p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void postJson("/api/calyx/career/accomplishments", {
                      statement: accomplishmentStatement,
                      category: "DELIVERY",
                    }).then(() => setAccomplishmentStatement(""));
                  }}
                >
                  <div className="text-[8px] text-[#777]">Add accomplishment</div>
                  <textarea
                    className="min-h-[56px] w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={accomplishmentStatement}
                    onChange={(event) => setAccomplishmentStatement(event.target.value)}
                    placeholder="Evidence-backed accomplishment statement"
                  />
                  <button
                    type="submit"
                    disabled={busy || !accomplishmentStatement.trim()}
                    className="rounded border border-[#333] px-2 py-1 text-[9px] uppercase"
                  >
                    Add accomplishment
                  </button>
                </form>

                {accomplishments.length > 0 ? (
                  <div className="space-y-1 rounded border border-[#171717] p-2">
                    <div className="text-[8px] text-[#777]">Accomplishments</div>
                    {accomplishments.map((record: CareerAccomplishment) => (
                      <div
                        key={record.id}
                        className="flex items-start justify-between gap-2 border-t border-[#1a1a1a] pt-1 first:border-t-0 first:pt-0"
                      >
                        <div className="min-w-0 flex-1">
                          {editingAccomplishmentId === record.id ? (
                            <div className="space-y-1">
                              <textarea
                                className="min-h-[48px] w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                                value={editingAccomplishmentStatement}
                                onChange={(e) => setEditingAccomplishmentStatement(e.target.value)}
                              />
                              <div className="flex gap-1">
                                <ActionButton
                                  label="Save"
                                  disabled={busy}
                                  onClick={() =>
                                    void patchJson(
                                      `/api/calyx/career/accomplishments/${record.id}`,
                                      { statement: editingAccomplishmentStatement },
                                    ).then(() => setEditingAccomplishmentId(null))
                                  }
                                />
                                <ActionButton
                                  label="Cancel"
                                  disabled={busy}
                                  onClick={() => setEditingAccomplishmentId(null)}
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <StatusBadge status={record.status} />
                              <div className="mt-1 text-[9px] text-[#bdbdbd]">{record.statement}</div>
                            </>
                          )}
                        </div>
                        {editingAccomplishmentId !== record.id ? (
                          <RecordActions
                            busy={busy}
                            status={record.status}
                            recordType="ACCOMPLISHMENT"
                            recordId={record.id}
                            onEdit={() => {
                              setEditingAccomplishmentId(record.id);
                              setEditingAccomplishmentStatement(record.statement);
                            }}
                            onDelete={() =>
                              void confirmDelete(
                                "accomplishment",
                                `/api/calyx/career/accomplishments/${record.id}`,
                              )
                            }
                            onVerify={verifyRecord}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                <form
                  className="space-y-1 rounded border border-[#171717] p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void postJson("/api/calyx/career/skills", {
                      skill: skillName,
                      projectId: skillProjectId || undefined,
                      confidence: "USER_CONFIRMED",
                      proficiency: "PROFICIENT",
                    }).then(() => {
                      setSkillName("");
                      setSkillProjectId("");
                    });
                  }}
                >
                  <div className="text-[8px] text-[#777]">Add skill evidence</div>
                  <input
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={skillName}
                    onChange={(event) => setSkillName(event.target.value)}
                    placeholder="Skill name"
                  />
                  <select
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={skillProjectId}
                    onChange={(event) => setSkillProjectId(event.target.value)}
                  >
                    <option value="">Optional project link</option>
                    {projects.map((project: CareerProject) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={busy || !skillName.trim()}
                    className="rounded border border-[#333] px-2 py-1 text-[9px] uppercase"
                  >
                    Add skill
                  </button>
                </form>

                {skills.length > 0 ? (
                  <div className="space-y-1 rounded border border-[#171717] p-2">
                    <div className="text-[8px] text-[#777]">Skills</div>
                    {skills.map((skill: CareerSkillEvidence) => (
                      <div
                        key={skill.id}
                        className="border-t border-[#1a1a1a] pt-1 first:border-t-0 first:pt-0"
                      >
                        <div className="text-[9px] text-[#bdbdbd]">{skill.skill}</div>
                        <div className="text-[8px] text-[#666]">
                          {skill.proficiency ?? "—"} / {skill.confidence}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <form
                  className="space-y-1 rounded border border-[#171717] p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void postJson("/api/calyx/career/evidence", {
                      sourceType: "USER_ENTRY",
                      sourceName: evidenceSourceName,
                      confidence: "USER_CONFIRMED",
                    }).then(() => setEvidenceSourceName(""));
                  }}
                >
                  <div className="text-[8px] text-[#777]">Add evidence</div>
                  <input
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={evidenceSourceName}
                    onChange={(event) => setEvidenceSourceName(event.target.value)}
                    placeholder="Source name (notes, doc, URL label)"
                  />
                  <button
                    type="submit"
                    disabled={busy || !evidenceSourceName.trim()}
                    className="rounded border border-[#333] px-2 py-1 text-[9px] uppercase"
                  >
                    Add evidence
                  </button>
                </form>

                <form
                  className="space-y-1 rounded border border-[#171717] p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void postJson("/api/calyx/career/evidence-links", {
                      evidenceId: linkEvidenceId,
                      recordType: linkRecordType,
                      recordId: linkRecordId,
                    }).then(() => {
                      setLinkEvidenceId("");
                      setLinkRecordId("");
                    });
                  }}
                >
                  <div className="text-[8px] text-[#777]">Link evidence to record</div>
                  <select
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={linkEvidenceId}
                    onChange={(event) => setLinkEvidenceId(event.target.value)}
                  >
                    <option value="">Select evidence</option>
                    {evidence.map((item: CareerEvidence) => (
                      <option key={item.id} value={item.id}>
                        {item.sourceName}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={linkRecordType}
                    onChange={(event) => {
                      setLinkRecordType(event.target.value as CareerEvidenceRecordType);
                      setLinkRecordId("");
                    }}
                  >
                    <option value="ACCOMPLISHMENT">Accomplishment</option>
                    <option value="PROJECT">Project</option>
                    <option value="ENGAGEMENT">Engagement</option>
                    <option value="EMPLOYER">Employer</option>
                    <option value="SKILL">Skill</option>
                  </select>
                  <select
                    className="w-full border border-[#222] bg-black px-2 py-1 text-[10px]"
                    value={linkRecordId}
                    onChange={(event) => setLinkRecordId(event.target.value)}
                  >
                    <option value="">Select target record</option>
                    {linkTargetOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={busy || !linkEvidenceId || !linkRecordId}
                    className="rounded border border-[#333] px-2 py-1 text-[9px] uppercase"
                  >
                    Link evidence
                  </button>
                </form>
              </section>

              <section className="space-y-2">
                <div className="text-[9px] uppercase tracking-wide text-[#8a8a8a]">
                  Evidence State
                </div>
                {evidenceLinks.length > 0 ? (
                  <div className="space-y-1 rounded border border-[#171717] p-2">
                    <div className="text-[8px] text-[#777]">Evidence links</div>
                    {evidenceLinks.map((link) => {
                      const source = evidence.find((e) => e.id === link.evidenceId);
                      return (
                        <div key={link.id} className="text-[9px] text-[#a8a8a8]">
                          {source?.sourceName ?? link.evidenceId} → {link.recordType}{" "}
                          {link.recordId.slice(0, 8)}…
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[9px] text-[#7d7d7d]">NO EVIDENCE LINKS YET.</div>
                )}
                <div className="space-y-1">
                  {accomplishments.length === 0 &&
                  employers.every((e) => e.status !== "DRAFT") &&
                  engagements.every((e) => e.status !== "DRAFT") &&
                  projects.every((p) => p.status !== "DRAFT") ? (
                    <div className="text-[9px] text-[#7d7d7d]">NO DRAFT RECORDS TO REVIEW.</div>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
