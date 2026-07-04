const SURVEY_MIRAGE_PAIR_STORAGE_KEY = "echo-mirage-survey-mirage-pair";
const SURVEY_POWERFIST_PAIR_STORAGE_KEY = "echo-mirage-survey-powerfist-pair";
const POWERFIST_DEVICE_ID_KEY = "echo-mirage-powerfist-device-id";

const LEGACY_MIRAGE_PAIR_STORAGE_KEYS = [
  "echo-mirage-espionage-mirage-pair",
  "echo-mirage-spy-mirage-pair",
] as const;

const LEGACY_POWERFIST_PAIR_STORAGE_KEYS = [
  "echo-mirage-espionage-powerfist-pair",
  "echo-mirage-spy-powerfist-pair",
] as const;

export type SurveyMiragePairCredentials = {
  echoHost: string;
  httpPort: number;
  echoNodeId: string;
  mirageToken: string;
  nodeId: string;
  sessionEpoch: number;
  pairedAt: string;
};

export type SurveyPowerfistPairCredentials = {
  echoHost: string;
  httpPort: number;
  echoNodeId: string;
  remoteToken: string;
  deviceId: string;
  sessionEpoch: number;
  pairedAt: string;
};

function readJsonStorageWithLegacyFallback(
  surveyKey: string,
  legacyKeys: readonly string[],
): string | null {
  if (typeof window === "undefined") return null;
  const current = window.localStorage.getItem(surveyKey)?.trim();
  if (current) return current;
  for (const legacyKey of legacyKeys) {
    const legacy = window.localStorage.getItem(legacyKey)?.trim();
    if (!legacy) continue;
    window.localStorage.setItem(surveyKey, legacy);
    return legacy;
  }
  return null;
}

export function getOrCreatePowerfistDeviceId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(POWERFIST_DEVICE_ID_KEY)?.trim();
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(POWERFIST_DEVICE_ID_KEY, created);
  return created;
}

export function saveSurveyMiragePairCredentials(creds: SurveyMiragePairCredentials): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SURVEY_MIRAGE_PAIR_STORAGE_KEY, JSON.stringify(creds));
}

export function readSurveyMiragePairCredentials(): SurveyMiragePairCredentials | null {
  const raw = readJsonStorageWithLegacyFallback(
    SURVEY_MIRAGE_PAIR_STORAGE_KEY,
    LEGACY_MIRAGE_PAIR_STORAGE_KEYS,
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SurveyMiragePairCredentials;
  } catch {
    return null;
  }
}

export function saveSurveyPowerfistPairCredentials(creds: SurveyPowerfistPairCredentials): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SURVEY_POWERFIST_PAIR_STORAGE_KEY, JSON.stringify(creds));
}

export function readSurveyPowerfistPairCredentials(): SurveyPowerfistPairCredentials | null {
  const raw = readJsonStorageWithLegacyFallback(
    SURVEY_POWERFIST_PAIR_STORAGE_KEY,
    LEGACY_POWERFIST_PAIR_STORAGE_KEYS,
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SurveyPowerfistPairCredentials;
  } catch {
    return null;
  }
}

export function clearSurveyMiragePairCredentials(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SURVEY_MIRAGE_PAIR_STORAGE_KEY);
  for (const legacyKey of LEGACY_MIRAGE_PAIR_STORAGE_KEYS) {
    window.localStorage.removeItem(legacyKey);
  }
}

export function clearSurveyPowerfistPairCredentials(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SURVEY_POWERFIST_PAIR_STORAGE_KEY);
  for (const legacyKey of LEGACY_POWERFIST_PAIR_STORAGE_KEYS) {
    window.localStorage.removeItem(legacyKey);
  }
}
