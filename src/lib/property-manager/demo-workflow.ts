export type PropertyIssueClass =
  | "EMERGENCY"
  | "MAINTENANCE"
  | "LEASING"
  | "PAYMENT/ACCOUNT"
  | "GENERAL CALLBACK"
  | "UNKNOWN";

export type PropertyTicketPriority = "emergency" | "urgent" | "routine" | "information";

export type PropertyTicketDraft = {
  priority: PropertyTicketPriority;
  category: string;
  tenant_name: string;
  unit: string;
  callback_number: string;
  summary: string;
  recommended_action: string;
};

export type PropertyConversationTurn = {
  role: "caller" | "muthur";
  text: string;
};

export type PropertyWorkflowResult = {
  classification: PropertyIssueClass;
  ticket: PropertyTicketDraft | null;
  reply: string;
  escalation: "EMERGENCY ESCALATION" | "FOLLOW-UP REQUIRED" | "ROUTINE QUEUE" | "INFORMATION QUEUE";
};

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function classifyPropertyIssue(text: string): PropertyIssueClass {
  const value = text.toLowerCase();
  if (/\b(gas smell|smell(?:s)? gas|fire|smoke|sparks?|electrical hazard|live wire|flood(?:ing|ed)?|water (?:is )?(?:coming |pouring )?through (?:the )?ceiling|ceiling (?:is )?(?:leaking|pouring))\b/.test(value)) {
    return "EMERGENCY";
  }
  if (/\b(rent payment|payment|account|balance|ledger|portal|late fee)\b/.test(value)) {
    return "PAYMENT/ACCOUNT";
  }
  if (/\b(lease|leasing|tour|available (?:unit|apartment)|application|move[ -]?in)\b/.test(value)) {
    return "LEASING";
  }
  if (/\b(call me back|callback|call back|return my call|leave a message)\b/.test(value)) {
    return "GENERAL CALLBACK";
  }
  if (/\b(leak|toilet|sink|faucet|heat|heater|a\/c|air condition|refrigerator|dishwasher|repair|maintenance|broken|clog)\b/.test(value)) {
    return "MAINTENANCE";
  }
  return "UNKNOWN";
}

function classifyCategory(classification: PropertyIssueClass, text: string) {
  const value = text.toLowerCase();
  if (classification === "EMERGENCY") {
    if (/\bgas\b/.test(value)) return "gas_odor";
    if (/\b(fire|smoke)\b/.test(value)) return "fire_or_smoke";
    if (/\b(electrical|wire|spark)\b/.test(value)) return "electrical_hazard";
    return "water_leak";
  }
  if (classification === "MAINTENANCE") {
    if (/\b(heat|heater)\b/.test(value)) return "no_heat";
    if (/\b(toilet|sink|faucet|clog)\b/.test(value)) return "plumbing";
    if (/\b(a\/c|air condition)\b/.test(value)) return "cooling";
    return "general_maintenance";
  }
  if (classification === "LEASING") return "leasing_inquiry";
  if (classification === "PAYMENT/ACCOUNT") return "account_question";
  if (classification === "GENERAL CALLBACK") return "callback_request";
  return "unclassified";
}

function extractName(text: string) {
  return text.match(/\b(?:my name is|this is|i am|i'm)\s+([a-z][a-z' -]{1,40}?)(?=\s+(?:in|at|from|and|unit|apt|apartment|my|phone|number|callback)\b|[,.]|$)/i)?.[1]?.trim() ?? "";
}

function extractUnit(text: string) {
  return text.match(/\b(?:unit|apt|apartment)\s*#?\s*([a-z0-9-]{1,12})\b/i)?.[1]?.toUpperCase() ?? "";
}

function extractPhone(text: string) {
  const match = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
  return match?.[0]?.replace(/\s+/g, " ").trim() ?? "";
}

function priorityFor(classification: PropertyIssueClass): PropertyTicketPriority {
  if (classification === "EMERGENCY") return "emergency";
  if (classification === "MAINTENANCE") return "routine";
  return "information";
}

function recommendedActionFor(classification: PropertyIssueClass) {
  if (classification === "EMERGENCY") return "Escalate to on-call manager immediately; simulated maintenance dispatch pending approval.";
  if (classification === "MAINTENANCE") return "Draft routine maintenance work order for next available technician.";
  if (classification === "LEASING") return "Route inquiry to leasing team for next-business-day follow-up.";
  if (classification === "PAYMENT/ACCOUNT") return "Route to account specialist; do not accept payment details in this demo.";
  if (classification === "GENERAL CALLBACK") return "Create callback task for property staff.";
  return "Collect additional information before routing.";
}

function questionFor(ticket: PropertyTicketDraft, classification: PropertyIssueClass) {
  if (!ticket.tenant_name) return "May I have your name?";
  if (!ticket.unit && classification !== "LEASING") return "What is your unit or apartment number?";
  if (!ticket.callback_number) return "What is the best callback number for you?";
  if (classification === "EMERGENCY") return "Are you in a safe location away from the hazard right now?";
  return "I have enough information to create a draft ticket. Is there anything else staff should know?";
}

export function advancePropertyConversation(turns: PropertyConversationTurn[]): PropertyWorkflowResult {
  const callerText = normalize(
    turns
      .filter((turn) => turn.role === "caller")
      .map((turn) => turn.text)
      .join(" "),
  );
  const classification = classifyPropertyIssue(callerText);
  if (classification === "UNKNOWN") {
    return {
      classification,
      ticket: null,
      escalation: "FOLLOW-UP REQUIRED",
      reply: "I can help with maintenance, emergencies, leasing, account questions, or a callback request. What is happening at the property?",
    };
  }

  const ticket: PropertyTicketDraft = {
    priority: priorityFor(classification),
    category: classifyCategory(classification, callerText),
    tenant_name: extractName(callerText),
    unit: extractUnit(callerText),
    callback_number: extractPhone(callerText),
    summary: callerText,
    recommended_action: recommendedActionFor(classification),
  };
  const question = questionFor(ticket, classification);

  if (classification === "EMERGENCY") {
    return {
      classification,
      ticket,
      escalation: "EMERGENCY ESCALATION",
      reply: `I understand this may be an emergency. If there is fire, smoke, gas odor, or immediate danger, leave the area and call emergency services. ${question}`,
    };
  }

  const opening =
    classification === "MAINTENANCE"
      ? "I have started a maintenance intake."
      : classification === "LEASING"
        ? "I can take a leasing inquiry for the daytime team."
        : classification === "PAYMENT/ACCOUNT"
          ? "I can document an account question, but I cannot accept payment information."
          : "I can create a callback request.";

  return {
    classification,
    ticket,
    escalation:
      classification === "MAINTENANCE"
        ? "ROUTINE QUEUE"
        : "INFORMATION QUEUE",
    reply: `${opening} ${question}`,
  };
}
