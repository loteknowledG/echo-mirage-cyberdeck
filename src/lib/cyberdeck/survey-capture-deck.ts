import {
  buildPowerfistCaptureWsUrl,
  completePowerfistCapturePairFromQr,
  connectPowerfistCaptureSocket,
  readPowerfistCaptureCredentials,
  readPowerfistCapturePairParamsFromQuery,
  saveMirageHubCredentials,
  savePowerfistCaptureCredentials,
} from "@/lib/cyberdeck/powerfist-capture-client";
import { requestHideToTray, requestSilentModeEnabled } from "@/lib/electron/silent-mode";

export type SurveyCaptureDeckHandle = {
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

function applyCaptureDeckChrome(): void {
  if (typeof document === "undefined") return;
  document.title = "\u200b";
}

async function enterCaptureDeckShell(): Promise<void> {
  applyCaptureDeckChrome();
  await requestSilentModeEnabled(true);
  await requestHideToTray();
}

/** Headless capture deck: tray-only on Electron. */
export async function startSurveyCaptureDeck(): Promise<SurveyCaptureDeckHandle | null> {
  applyCaptureDeckChrome();

  let creds = readPowerfistCaptureCredentials();
  const pairParams = readPowerfistCapturePairParamsFromQuery();

  if (pairParams) {
    if (pairParams.mirageHost && pairParams.mirageHttpPort) {
      saveMirageHubCredentials(pairParams.mirageHost, pairParams.mirageHttpPort);
    }
    const result = await completePowerfistCapturePairFromQr(pairParams);
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
    void enterCaptureDeckShell();
  }

  if (!creds) return null;

  void enterCaptureDeckShell();

  const wsUrl = buildPowerfistCaptureWsUrl(
    creds.host,
    creds.port,
    creds.captureToken,
    creds.nodeId,
  );

  const socket = connectPowerfistCaptureSocket({ wsUrl });
  return { close: () => socket.close() };
}
