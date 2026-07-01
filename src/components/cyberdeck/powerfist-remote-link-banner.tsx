"use client";

import { useEffect, useState } from "react";
import type { PowerfistSocketStatus } from "@/lib/cyberdeck/powerfist-remote-socket";
import {
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
  SURVEY_MODE_SHORT,
  SURVEY_POWERFIST_LABEL,
} from "@/lib/cyberdeck/survey-mode";

const STATUS_LABEL: Record<PowerfistSocketStatus, string> = {
  disconnected: `${SURVEY_POWERFIST_LABEL} // OFFLINE`,
  connecting: `${SURVEY_POWERFIST_LABEL} // LINKING…`,
  connected: `${SURVEY_POWERFIST_LABEL} // LINKED`,
  error: `${SURVEY_POWERFIST_LABEL} // ERROR`,
  pairing: `${SURVEY_POWERFIST_LABEL} // PAIRING…`,
};

type PowerfistRemoteLinkBannerProps = {
  status: PowerfistSocketStatus;
  pairMessage?: string | null;
};

export function PowerfistRemoteLinkBanner({ status, pairMessage }: PowerfistRemoteLinkBannerProps) {
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (pairMessage) {
      setHint(pairMessage);
      return;
    }
    if (status === "connected") {
      setHint(
        `${SURVEY_MODE_SHORT}: trigger Echo capture → Mirage solve on ${SURVEY_MIRAGE_DISPLAY}.`,
      );
      return;
    }
    setHint(`Scan PowerFist QR on ${SURVEY_MIRAGE_DISPLAY} (Settings → Survey Mode).`);
  }, [pairMessage, status]);

  return (
    <div className="status" data-testid="powerfist-remote-link-banner">
      <span>{STATUS_LABEL[status]}</span>
      {hint ? (
        <span className="hint">
          {" "}
          · {SURVEY_ECHO_DISPLAY} + {SURVEY_MIRAGE_DISPLAY} · {hint}
        </span>
      ) : null}
    </div>
  );
}
