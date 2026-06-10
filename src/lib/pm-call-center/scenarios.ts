import type { PmCallScenario } from "@/lib/pm-call-center/types";

export const PM_CALL_SCENARIOS: readonly PmCallScenario[] = [
  {
    id: "leak-4b",
    title: "4B Kitchen Sink Leak",
    category: "plumbing",
    description: "Resident reports an active kitchen sink leak in unit 4B.",
    residentName: "Jordan",
    propertyHint: "Oak Ridge Apartments — Unit 4B",
    openingLine:
      "Hi, this is Jordan in 4B. There's water pooling under my kitchen sink and it's getting worse.",
    residentBrief:
      "You are Jordan, a tenant in unit 4B. You are worried about damage. Answer the operator's questions honestly. " +
      "You were home when it started about an hour ago. You shut off the valve under the sink but it still drips.",
  },
  {
    id: "gas-hallway",
    title: "Gas smell in hallway",
    category: "emergency",
    description: "Caller reports a strong gas odor on the 2nd floor hallway.",
    residentName: "Pat Nguyen",
    propertyHint: "Riverside Courts — Building A, 2nd floor",
    openingLine:
      "I smell gas out in the hallway by the elevator on the second floor. It's pretty strong.",
    residentBrief:
      "You are Pat Nguyen, a tenant who noticed gas in the common hallway. You are anxious. " +
      "If the operator tells you to evacuate, comply and ask what to do next. Do not downplay the smell.",
  },
  {
    id: "rent-balance",
    title: "Rent balance question",
    category: "billing",
    description: "Resident asks why their portal shows a late fee.",
    residentName: "Alex Rivera",
    propertyHint: "Oak Terrace — Unit 12",
    openingLine:
      "I'm looking at the portal and there's a late fee I don't think I owe. I paid on the 2nd.",
    residentBrief:
      "You are Alex Rivera. You believe you paid rent on time via ACH on the 2nd. You have confirmation email if asked. " +
      "You are frustrated but willing to cooperate if the operator is professional.",
  },
  {
    id: "lease-break",
    title: "Early lease termination",
    category: "leasing",
    description: "Resident needs to break lease due to job relocation.",
    residentName: "Sam Okonkwo",
    propertyHint: "Oak Terrace — Unit 8",
    openingLine:
      "I got relocated for work and need to know my options for ending my lease early. I have about six weeks.",
    residentBrief:
      "You are Sam Okonkwo, relocating out of state in six weeks. You want to know fees, notice period, and whether sublease is allowed. " +
      "Ask follow-up questions if the operator is vague.",
  },
  {
    id: "noise-neighbor",
    title: "Noise complaint",
    category: "general",
    description: "Repeat complaint about loud music from a neighboring unit.",
    residentName: "Morgan Ellis",
    propertyHint: "Riverside Courts — Unit 3A",
    openingLine:
      "It's almost midnight and my neighbor in 3C has had loud bass going for two hours. This keeps happening.",
    residentBrief:
      "You are Morgan Ellis in 3A. You've complained before but it keeps happening on weekends. " +
      "You want something done tonight, not just a form letter.",
  },
  {
    id: "ac-outage",
    title: "AC not cooling",
    category: "maintenance",
    description: "AC running but not cooling during a heat wave.",
    residentName: "Riley Chen",
    propertyHint: "Oak Terrace — Unit 5",
    openingLine:
      "My AC has been running all day but the apartment is still 85 degrees. I have a toddler here.",
    residentBrief:
      "You are Riley Chen with a toddler at home. The thermostat shows 85°F. Filter was changed last month. " +
      "You need a realistic timeline; push back if given only generic reassurance.",
  },
] as const;

export function pmCallScenarioById(id: string): PmCallScenario | undefined {
  return PM_CALL_SCENARIOS.find((scenario) => scenario.id === id);
}
