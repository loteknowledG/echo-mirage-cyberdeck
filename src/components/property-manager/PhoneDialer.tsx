"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BsBackspace } from "react-icons/bs";
import { MdExpandLess, MdExpandMore, MdLocalPhone } from "react-icons/md";
import { CyberdeckActionButton } from "@/components/cyberdeck/action-button";
import { CallerIdActiveCall } from "@/components/property-manager/CallerIdActiveCall";
import { DialerContactRoller } from "@/components/property-manager/DialerContactRoller";
import { KeypadButton } from "@/components/property-manager/KeypadButton";
import {
  buildDialerContactList,
  DEFAULT_DIALER_CONTACT_ID,
  JORDAN_CONTACT_PHONE,
  dialerContactsListKey,
  findDialerContact,
  resolveDefaultDialerContact,
} from "@/lib/property-manager/dialer-contacts";
import {
  appendDialDigit,
  fetchDialerState,
  formatPhoneDisplay,
  KEYPAD_ROWS,
  normalizePhoneInput,
  postDialerAction,
  type CallSession,
  type DialerState,
  type SelectedCaseDialerContext,
} from "@/lib/property-manager/call-sessions";
import { formatCaseLabel } from "@/lib/property-manager/cases";
import { cn } from "@/lib/utils";

type PhoneDialerProps = {
  selectedCase: SelectedCaseDialerContext | null;
  onCallEnded?: () => void;
  onStateChange?: (state: DialerState) => void;
  /** Parent-polled server state — reconciles if local state drifts after hang-up. */
  remoteState?: DialerState | null;
  floating?: boolean;
};

function idleDialerState(state: DialerState): DialerState {
  return { ...state, active: null, incoming: null };
}

function participantLabel(session: CallSession): string {
  if (session.participantName) return session.participantName;
  return formatCaseLabel(session.participantType);
}

export function PhoneDialer({
  selectedCase,
  onCallEnded,
  onStateChange,
  remoteState = null,
  floating = false,
}: PhoneDialerProps) {
  const [state, setState] = useState<DialerState>({ incoming: null, active: null, recent: [] });
  const [dialInput, setDialInput] = useState(JORDAN_CONTACT_PHONE);
  const [selectedContactId, setSelectedContactId] = useState(DEFAULT_DIALER_CONTACT_ID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactsExpanded, setContactsExpanded] = useState(!floating);
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const stateGenRef = useRef(0);

  const selectedCaseSlug = selectedCase?.slug ?? "";
  const contacts = useMemo(
    () => buildDialerContactList(selectedCase),
    [selectedCase, selectedCaseSlug, selectedCase?.residentPhone],
  );
  const contactsListKey = dialerContactsListKey(contacts);
  const selectedContact = useMemo(
    () => findDialerContact(contacts, selectedContactId),
    [contacts, selectedContactId],
  );

  const publishState = useCallback((next: DialerState) => {
    stateGenRef.current += 1;
    setState(next);
    onStateChangeRef.current?.(next);
  }, []);

  const syncFromServer = useCallback(async () => {
    const next = await fetchDialerState();
    publishState(next);
    return next;
  }, [publishState]);

  useEffect(() => {
    const mountGen = stateGenRef.current;
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchDialerState();
        if (cancelled || stateGenRef.current !== mountGen) return;
        publishState(next);
      } catch (err) {
        if (cancelled || stateGenRef.current !== mountGen) return;
        setError(err instanceof Error ? err.message : "Failed to load dialer");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publishState]);

  useEffect(() => {
    if (!remoteState) return;
    if (remoteState.active || remoteState.incoming) return;
    if (!state.active && !state.incoming) return;
    publishState(remoteState);
  }, [remoteState, state.active, state.incoming, publishState]);

  useEffect(() => {
    if (state.active || state.incoming) return;

    const currentStillListed = contacts.some((contact) => contact.id === selectedContactId);
    if (currentStillListed) return;

    const preferred = resolveDefaultDialerContact(contacts);
    if (!preferred) return;
    setSelectedContactId(preferred.id);
    setDialInput(preferred.phoneNumber);
  }, [contactsListKey, contacts, selectedContactId, state.active, state.incoming]);

  const handleContactChange = useCallback(
    (contactId: string) => {
      setSelectedContactId(contactId);
      const contact = contacts.find((entry) => entry.id === contactId);
      if (contact) {
        setDialInput(contact.phoneNumber);
      }
    },
    [contacts],
  );

  const run = async (fn: () => Promise<DialerState>, ended = false) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      publishState(next);
      if (ended) onCallEnded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dialer action failed");
    } finally {
      setBusy(false);
    }
  };

  const handleHangUp = () => {
    const sessionId = state.active?.id;
    if (!sessionId) return;

    const endedLocally = idleDialerState(state);
    publishState(endedLocally);
    setError(null);

    void (async () => {
      try {
        const next = await postDialerAction({ action: "hang_up" }, sessionId);
        publishState(idleDialerState(next));
        onCallEnded?.();
      } catch (err) {
        try {
          await syncFromServer();
        } catch {
          publishState(endedLocally);
        }
        setError(err instanceof Error ? err.message : "Hang up failed");
      }
    })();
  };

  const onCall = Boolean(state.active) || Boolean(state.incoming);
  const dialDisabled = onCall;
  const controlsLocked = busy;

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden", floating && "bg-transparent")}>
      {!state.active && !state.incoming ? (
        <header
          className={cn(
            "shrink-0 border-b border-[#25352c] px-2",
            floating ? "border-[#1c2a22] py-1" : "py-2",
          )}
        >
          {floating ? (
            <div className="flex min-w-0 flex-col gap-1">
              <button
                type="button"
                disabled={dialDisabled}
                aria-expanded={contactsExpanded}
                aria-controls="dialer-contacts-panel"
                onClick={() => setContactsExpanded((open) => !open)}
                className="flex w-full min-w-0 items-center gap-2 rounded-sm text-left disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[9px] tracking-[0.05em] text-emerald-200">
                    {selectedContact?.name ?? "Contact"}
                  </span>
                  {!contactsExpanded ? (
                    <span className="mt-0.5 block truncate font-mono text-[7px] tracking-[0.06em] text-[#707070]">
                      {formatPhoneDisplay(selectedContact?.phoneNumber ?? dialInput)}
                    </span>
                  ) : null}
                </span>
                {contactsExpanded ? (
                  <MdExpandLess className="h-4 w-4 shrink-0 text-[#707070]" aria-hidden />
                ) : (
                  <MdExpandMore className="h-4 w-4 shrink-0 text-[#707070]" aria-hidden />
                )}
              </button>
              {contactsExpanded ? (
                <div id="dialer-contacts-panel" className="pt-0.5">
                  <DialerContactRoller
                    contacts={contacts}
                    value={selectedContactId}
                    onChange={handleContactChange}
                    disabled={dialDisabled}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <DialerContactRoller
              contacts={contacts}
              value={selectedContactId}
              onChange={handleContactChange}
              disabled={dialDisabled}
            />
          )}
        </header>
      ) : null}

      <div
        className={cn(
          "min-h-0 flex-1",
          floating ? "space-y-1 overflow-hidden p-1.5" : "custom-scrollbar space-y-3 overflow-y-auto p-3",
        )}
      >
        {error ? (
          <p className="shrink-0 font-mono text-[9px] text-rose-300" role="alert">
            {error}
          </p>
        ) : null}

        {state.incoming ? (
          <section
            className={cn(
              "rounded-sm border border-rose-900/50 bg-rose-950/20",
              floating ? "p-2" : "p-3",
            )}
          >
            <div className="font-mono text-[8px] tracking-[0.12em] text-rose-300/90">INCOMING CALL</div>
            <div className="mt-2 font-mono text-[11px] text-[#e8e8e8]">
              {participantLabel(state.incoming)}
              {state.incoming.participantType === "resident" ? (
                <span className="text-[#9a9a9a]"> · Unit 4B</span>
              ) : null}
            </div>
            <div className="mt-1 font-mono text-[10px] tracking-[0.06em] text-[#b0b0b0]">
              {formatPhoneDisplay(state.incoming.phoneNumber)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <CyberdeckActionButton
                variant="accent"
                disabled={controlsLocked}
                onClick={() =>
                  void run(() =>
                    postDialerAction(
                      { action: "pick_up", caseSlug: selectedCase?.slug },
                      state.incoming!.id,
                    ),
                  )
                }
              >
                Pick Up
              </CyberdeckActionButton>
              <CyberdeckActionButton
                variant="danger"
                disabled={controlsLocked}
                onClick={() =>
                  void run(() => postDialerAction({ action: "decline" }, state.incoming!.id))
                }
              >
                Decline
              </CyberdeckActionButton>
            </div>
          </section>
        ) : null}

        {!state.active ? (
          <section
            className={cn(
              "rounded-sm border border-[#25352c] bg-black/60",
              floating ? "p-1.5" : "p-3",
            )}
          >
            {!floating ? (
              <div className="mb-2 font-mono text-[8px] tracking-[0.12em] text-[#606060]">DIAL OUT</div>
            ) : null}
            <div
              className={cn(
                "rounded-sm border border-[#2d2d2d] bg-black text-center font-mono tracking-[0.08em] text-emerald-200",
                floating ? "min-h-[1.5rem] px-2 py-1 text-sm" : "min-h-[2.25rem] px-3 py-2 text-lg",
              )}
              aria-live="polite"
            >
              {formatPhoneDisplay(dialInput) || "—"}
            </div>
            {!floating ? (
              selectedCase ? (
                <p className="mt-2 font-mono text-[8px] text-[#707070]">
                  Selected case: {selectedCase.title}
                </p>
              ) : (
                <p className="mt-2 font-mono text-[8px] text-[#606060]">
                  No case selected — call will be unattached.
                </p>
              )
            ) : null}

            <div className={cn("flex justify-end", floating ? "mt-1" : "mt-3")}>
              <button
                type="button"
                aria-label="Backspace"
                disabled={dialDisabled || !dialInput}
                onClick={() => setDialInput((current) => current.slice(0, -1))}
                className="rounded-sm p-1 text-[#9a9a9a] transition-colors hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <BsBackspace className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div
              className={cn(
                "grid grid-cols-3 place-items-start justify-items-center",
                floating ? "mt-1 gap-0" : "mt-2 gap-x-1 gap-y-2",
              )}
            >
              {KEYPAD_ROWS.flat().map((key) => (
                <KeypadButton
                  key={key.digit}
                  digit={key.digit}
                  letters={key.letters}
                  disabled={dialDisabled}
                  onPress={(digit) => setDialInput((current) => appendDialDigit(current, digit))}
                />
              ))}
            </div>

            <div className={cn("flex w-full justify-center", floating ? "mt-1.5" : "mt-3")}>
              <CyberdeckActionButton
                variant="accent"
                disabled={dialDisabled || !normalizePhoneInput(dialInput)}
                className="dialer-call-btn"
                onClick={() =>
                  void run(() =>
                    postDialerAction({
                      action: "dial_outbound",
                      phoneNumber: dialInput,
                      caseSlug: selectedCase?.slug,
                      participantType: selectedContact?.participantType,
                      participantName: selectedContact?.name,
                    }),
                  )
                }
              >
                <MdLocalPhone className="h-4 w-4 shrink-0" aria-hidden />
                Call
              </CyberdeckActionButton>
            </div>
          </section>
        ) : null}

        {state.active ? (
          <CallerIdActiveCall
            session={state.active}
            selectedCase={selectedCase}
            controlsLocked={controlsLocked}
            compact={floating}
            onHangUp={handleHangUp}
            onAttachToCase={
              selectedCase && !state.active.caseSlug
                ? () =>
                    void run(() =>
                      postDialerAction(
                        { action: "attach_to_case", caseSlug: selectedCase.slug },
                        state.active!.id,
                      ),
                    )
                : undefined
            }
          />
        ) : null}
      </div>
    </div>
  );
}
