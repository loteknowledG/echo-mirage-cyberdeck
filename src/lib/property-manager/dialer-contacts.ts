import type { CallSessionParticipantType } from "@/lib/property-manager/call-sessions";
import type { SelectedCaseDialerContext } from "@/lib/property-manager/call-sessions";
import { normalizePhoneInput, VENDOR_PHONE_NORMALIZED } from "@/lib/property-manager/call-sessions";

export type DialerContact = {
  id: string;
  name: string;
  subtitle?: string;
  phoneNumber: string;
  participantType: CallSessionParticipantType;
};

export const JORDAN_CONTACT_PHONE = "5551234567";

/** Rolodex order — Pat wraps above Jordan on the default wheel. */
export const DIALER_CONTACTS: readonly DialerContact[] = [
  {
    id: "riverside-pat",
    name: "Pat Nguyen",
    subtitle: "Riverside Courts · Emergency",
    phoneNumber: "5559876543",
    participantType: "resident",
  },
  {
    id: "jordan-4b",
    name: "Jordan",
    subtitle: "Unit 4B · Resident",
    phoneNumber: JORDAN_CONTACT_PHONE,
    participantType: "resident",
  },
  {
    id: "mikes-plumbing",
    name: "Mike's Plumbing",
    subtitle: "Vendor",
    phoneNumber: VENDOR_PHONE_NORMALIZED,
    participantType: "vendor",
  },
  {
    id: "oak-ridge-desk",
    name: "Oak Ridge Desk",
    subtitle: "Property office",
    phoneNumber: "5555550100",
    participantType: "property_manager",
  },
] as const;

export const DEFAULT_DIALER_CONTACT_ID = "jordan-4b";

export function contactFromSelectedCase(caseRecord: SelectedCaseDialerContext): DialerContact | null {
  if (!caseRecord.residentPhone?.trim()) return null;
  return {
    id: `case-${caseRecord.slug}`,
    name: caseRecord.residentName ?? caseRecord.title,
    subtitle: `${caseRecord.propertyName} · Unit ${caseRecord.unitId.toUpperCase()}`,
    phoneNumber: normalizePhoneInput(caseRecord.residentPhone),
    participantType: "resident",
  };
}

export function buildDialerContactList(selectedCase: SelectedCaseDialerContext | null): DialerContact[] {
  const caseContact = selectedCase ? contactFromSelectedCase(selectedCase) : null;
  const base = DIALER_CONTACTS.filter(
    (contact) =>
      !caseContact ||
      normalizePhoneInput(contact.phoneNumber) !== normalizePhoneInput(caseContact.phoneNumber),
  );
  if (!caseContact) return [...base];

  const isJordanCase =
    normalizePhoneInput(caseContact.phoneNumber) === normalizePhoneInput(JORDAN_CONTACT_PHONE);
  if (isJordanCase) {
    const patIndex = base.findIndex((contact) => contact.id === "riverside-pat");
    const insertAt = patIndex >= 0 ? patIndex + 1 : 0;
    const next = [...base];
    next.splice(insertAt, 0, caseContact);
    return next;
  }

  return [caseContact, ...base];
}

export function resolveDefaultDialerContact(contacts: DialerContact[]): DialerContact | null {
  const jordan = contacts.find((contact) => contact.id === DEFAULT_DIALER_CONTACT_ID);
  if (jordan) return jordan;

  const jordanPhone = normalizePhoneInput(JORDAN_CONTACT_PHONE);
  const caseJordan = contacts.find(
    (contact) => normalizePhoneInput(contact.phoneNumber) === jordanPhone,
  );
  if (caseJordan) return caseJordan;

  return contacts[1] ?? contacts[0] ?? null;
}

export function findDialerContact(
  contacts: DialerContact[],
  contactId: string | null,
): DialerContact | null {
  if (!contactId) return contacts[0] ?? null;
  return contacts.find((contact) => contact.id === contactId) ?? contacts[0] ?? null;
}

/** Stable key for rolodex reset — only changes when list membership/order shifts. */
export function dialerContactsListKey(contacts: readonly DialerContact[]): string {
  return contacts.map((contact) => contact.id).join("\0");
}
