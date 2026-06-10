import { promises as fs } from "node:fs";
import path from "node:path";
import { pmCasesRootAbs } from "@/lib/property-manager/cases/paths";

type SequenceState = {
  year: number;
  next: number;
};

const SEQUENCE_FILE = ".sequence.json";

async function readSequenceState(): Promise<SequenceState> {
  const filePath = path.join(pmCasesRootAbs(), SEQUENCE_FILE);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SequenceState>;
    const year = typeof parsed.year === "number" ? parsed.year : new Date().getFullYear();
    const next = typeof parsed.next === "number" && parsed.next > 0 ? parsed.next : 1;
    return { year, next };
  } catch {
    return { year: new Date().getFullYear(), next: 1 };
  }
}

export async function nextCaseSequence(): Promise<{ year: number; sequence: number }> {
  await fs.mkdir(pmCasesRootAbs(), { recursive: true });
  let state = await readSequenceState();
  const currentYear = new Date().getFullYear();
  if (state.year !== currentYear) {
    state = { year: currentYear, next: 1 };
  }
  const sequence = state.next;
  state.next += 1;
  const filePath = path.join(pmCasesRootAbs(), SEQUENCE_FILE);
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return { year: currentYear, sequence };
}
