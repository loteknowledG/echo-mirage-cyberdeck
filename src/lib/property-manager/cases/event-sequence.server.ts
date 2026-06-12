import { promises as fs } from "node:fs";
import path from "node:path";
import { pmCasesRootAbs } from "@/lib/property-manager/cases/paths";

type EventSequenceState = {
  year: number;
  next: number;
};

const SEQUENCE_FILE = ".event-sequence.json";

async function readState(): Promise<EventSequenceState> {
  const filePath = path.join(pmCasesRootAbs(), SEQUENCE_FILE);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<EventSequenceState>;
    return {
      year: typeof parsed.year === "number" ? parsed.year : new Date().getFullYear(),
      next: typeof parsed.next === "number" && parsed.next > 0 ? parsed.next : 1,
    };
  } catch {
    return { year: new Date().getFullYear(), next: 1 };
  }
}

export async function nextCaseEventId(): Promise<string> {
  await fs.mkdir(pmCasesRootAbs(), { recursive: true });
  let state = await readState();
  const year = new Date().getFullYear();
  if (state.year !== year) {
    state = { year, next: 1 };
  }
  const sequence = state.next;
  state.next += 1;
  const filePath = path.join(pmCasesRootAbs(), SEQUENCE_FILE);
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return `EVT-${year}-${String(sequence).padStart(5, "0")}`;
}
