"use client";

import { useEffect, useState } from "react";
import type { PowerfistSocketStatus } from "@/lib/cyberdeck/powerfist-remote-socket";
import {
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_MIRAGE_DISPLAY,
  ESPIONAGE_MODE_SHORT,
  ESPIONAGE_POWERFIST_LABEL,
} from "@/lib/cyberdeck/espionage-mode";

const STATUS_LABEL: Record<PowerfistSocketStatus, string> = {
  disconnected: `${ESPIONAGE_POWERFIST_LABEL} // OFFLINE`,
  connecting: `${ESPIONAGE_POWERFIST_LABEL} // LINKING…`,
  connected: `${ESPIONAGE_POWERFIST_LABEL} // LINKED`,
  error: `${ESPIONAGE_POWERFIST_LABEL} // ERROR`,
  pairing: `${ESPIONAGE_POWERFIST_LABEL} // PAIRING…`,
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
        `${ESPIONAGE_MODE_SHORT}: trigger Echo capture → Mirage solve on ${ESPIONAGE_MIRAGE_DISPLAY}.`,
      );
      return;
    }
    setHint(`Scan PowerFist QR on ${ESPIONAGE_MIRAGE_DISPLAY} (Settings → Espionage Mode).`);
  }, [pairMessage, status]);

  return (
    <div className="status" data-testid="powerfist-remote-link-banner">
      <span>{STATUS_LABEL[status]}</span>
      {hint ? (
        <span className="hint">
          {" "}
          · {ESPIONAGE_ECHO_DISPLAY} + {ESPIONAGE_MIRAGE_DISPLAY} · {hint}
        </span>
      ) : null}
    </div>
  );
}
