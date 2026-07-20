"use client";

import { useEffect, useState } from "react";
import {
  clearMirageLocalListeningTranscript,
  mirageLocalListeningDisplayText,
  readMirageLocalListeningState,
  startMirageLocalListening,
  stopMirageLocalListening,
  subscribeMirageLocalListening,
  type MirageLocalListeningState,
} from "@/lib/cyberdeck/mirage-local-listening.client";

/** React binding for Mirage-device mic + STT. */
export function useMirageLocalListening() {
  const [snapshot, setSnapshot] = useState<MirageLocalListeningState>(() =>
    readMirageLocalListeningState(),
  );

  useEffect(() => subscribeMirageLocalListening(setSnapshot), []);

  return {
    active: snapshot.active,
    interim: snapshot.interim,
    transcript: snapshot.transcript,
    error: snapshot.error,
    mediaRecorder: snapshot.mediaRecorder,
    start: startMirageLocalListening,
    stop: stopMirageLocalListening,
    clearTranscript: clearMirageLocalListeningTranscript,
    displayText: mirageLocalListeningDisplayText() ||
      [snapshot.transcript, snapshot.interim].filter(Boolean).join(snapshot.interim ? " … " : "").trim(),
  };
}
