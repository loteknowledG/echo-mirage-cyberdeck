"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import {
  dialerContactsListKey,
  resolveDefaultDialerContact,
  type DialerContact,
} from "@/lib/property-manager/dialer-contacts";
import { formatPhoneDisplay } from "@/lib/property-manager/call-sessions";
import { cn } from "@/lib/utils";

const SLIDE_HEIGHT_PX = 36;
const VISIBLE_ROWS = 3;

type DialerContactRollerProps = {
  contacts: DialerContact[];
  value: string;
  onChange: (contactId: string) => void;
  disabled?: boolean;
};

function contactNameClass(active: boolean) {
  return cn(
    "block w-full truncate px-1 font-mono text-[9px] leading-none tracking-[0.05em]",
    active ? "text-emerald-200" : "text-[#6a6a6a]",
  );
}

function ContactSlide({ contact, active }: { contact: DialerContact; active: boolean }) {
  return (
    <span
      className="flex w-full min-w-0 flex-col items-center justify-center px-2 text-center font-mono leading-tight"
      title={contact.subtitle}
    >
      <span className={contactNameClass(active)}>{contact.name}</span>
      <span
        className={cn(
          "mt-0.5 block w-full truncate text-[7px] leading-none tracking-[0.06em]",
          active ? "text-emerald-200/75" : "text-[#555555]",
        )}
      >
        {formatPhoneDisplay(contact.phoneNumber)}
      </span>
    </span>
  );
}

function ContactLabelSlide({ contact, active }: { contact: DialerContact; active: boolean }) {
  return (
    <span className={contactNameClass(active)} title={contact.subtitle}>
      {contact.name}
    </span>
  );
}

export function DialerContactRoller({ contacts, value, onChange, disabled }: DialerContactRollerProps) {
  const listKey = dialerContactsListKey(contacts);
  const listKeyRef = useRef(listKey);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const resolvedValue = useMemo(() => {
    if (contacts.some((contact) => contact.id === value)) return value;
    return resolveDefaultDialerContact(contacts)?.id ?? contacts[0]?.id ?? "";
  }, [contacts, value]);

  const [wheelValue, setWheelValue] = useState(resolvedValue);

  useEffect(() => {
    if (listKeyRef.current === listKey) return;
    listKeyRef.current = listKey;
    setWheelValue(resolvedValue);
  }, [listKey, resolvedValue]);

  const items = useMemo(
    () =>
      contacts.map((contact) => ({
        value: contact.id,
        label: contact.name,
        renderSlide: (active: boolean) => <ContactSlide contact={contact} active={active} />,
        renderLabelSlide: (active: boolean) => <ContactLabelSlide contact={contact} active={active} />,
      })),
    [contacts],
  );

  if (contacts.length === 0) {
    return (
      <p className="font-mono text-[8px] tracking-[0.06em] text-[#606060]">No contacts on file.</p>
    );
  }

  return (
    <div className={cn("w-full min-w-0", disabled && "pointer-events-none opacity-40")}>
      <CyberdeckRollingPicker
        items={items}
        value={wheelValue}
        onChange={setWheelValue}
        onUserSelect={(contactId) => {
          setWheelValue(contactId);
          onChangeRef.current(contactId);
        }}
        ariaLabel="Dialer contacts"
        viewportClassName="w-full max-w-none"
        slideHeightPx={SLIDE_HEIGHT_PX}
        wheelNeighborCount={VISIBLE_ROWS}
        wheelExpandOnScroll
        wheelPinnedOpen
        wheelScrollStep={1}
        showTextWhileScrolling={false}
        wheelSettledShowsSlide={false}
        alwaysShowLabel={false}
        loop={contacts.length > 1}
        rollerType="dialer-contacts"
      />
    </div>
  );
}
