import {
  buildPowerfistCaptureWsUrl,
  completePowerfistCapturePairFromQr,
  connectPowerfistCaptureSocket,
  readPowerfistCaptureCredentials,
  readPowerfistCapturePairParamsFromQuery,
  savePowerfistCaptureCredentials,
} from "@/lib/cyberdeck/powerfist-capture-client";
import { requestHideToTray, requestSilentModeEnabled } from "@/lib/electron/silent-mode";

export type StealthCaptureDeckHandle = {
  close: () => void;
};

function stripPairQueryFromAddressBar(): void {
  if (typeof window === "undefined") return;
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch {
    /* ignore */
  }
}

function applyStealthDocumentChrome(): void {
  if (typeof document === "undefined") return;
  document.title = "\u200b";
}

async function enterStealthShell(): Promise<void> {
  applyStealthDocumentChrome();
  await requestSilentModeEnabled(true);
  await requestHideToTray();
}

/** Headless capture-deck: no UI updates, no mission feedback, tray-only on Electron. */
export async function startStealthCaptureDeck(): Promise<StealthCaptureDeckHandle | null> {
  applyStealthDocumentChrome();

  let creds = readPowerfistCaptureCredentials();
  const pairParams = readPowerfistCapturePairParamsFromQuery();

  if (pairParams) {
    const result = await completePowerfistCapturePairFromQr(pairParams.pairId, pairParams.pairSecret);
    stripPairQueryFromAddressBar();
    if (!result.ok) return null;

    savePowerfistCaptureCredentials(
      result.wsHost,
      result.wsPort,
      result.captureToken,
      result.nodeId,
    );
    creds = {
      host: result.wsHost,
      port: result.wsPort,
      captureToken: result.captureToken,
      nodeId: result.nodeId,
    };
    void enterStealthShell();
  }

  if (!creds) return null;

  void enterStealthShell();

  const wsUrl = buildPowerfistCaptureWsUrl(
    creds.host,
    creds.port,
    creds.captureToken,
    creds.nodeId,
  );

  const socket = connectPowerfistCaptureSocket({ wsUrl });
  return { close: () => socket.close() };
}
