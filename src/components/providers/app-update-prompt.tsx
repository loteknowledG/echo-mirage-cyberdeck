"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  APP_UPDATE_PROMPT_EVENT,
  checkForAppUpdate,
  dismissAppUpdate,
  fetchAppReleaseVersion,
  promptForAppUpdate,
  restartAppForUpdate,
  shouldPollForAppUpdates,
} from "@/lib/app-update-client";

const VERSION_CHECK_MS = 5 * 60_000;

export function AppUpdatePrompt() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const promptVisibleRef = useRef(false);

  const showUpdate = useCallback((version: string) => {
    promptVisibleRef.current = true;
    setUpdateVersion(version);
  }, []);

  const checkForUpdate = useCallback(async () => {
    const result = await checkForAppUpdate();
    if (result.status === "update-available") {
      showUpdate(result.latest);
    }
  }, [showUpdate]);

  const restartForUpdate = useCallback(() => {
    restartAppForUpdate(waitingWorkerRef.current);
  }, []);

  const dismissForNow = useCallback(() => {
    if (updateVersion) {
      dismissAppUpdate(updateVersion);
    }
    promptVisibleRef.current = false;
    setUpdateVersion(null);
  }, [updateVersion]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      const version = (event as CustomEvent<{ version?: string }>).detail?.version;
      if (typeof version === "string" && version.trim()) {
        showUpdate(version.trim());
      }
    };

    window.addEventListener(APP_UPDATE_PROMPT_EVENT, onPrompt);
    return () => window.removeEventListener(APP_UPDATE_PROMPT_EVENT, onPrompt);
  }, [showUpdate]);

  useEffect(() => {
    if (!shouldPollForAppUpdates()) return;

    void checkForUpdate();

    const onFocus = () => {
      void checkForUpdate();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };

    const intervalId = window.setInterval(() => {
      void checkForUpdate();
    }, VERSION_CHECK_MS);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [checkForUpdate]);

  useEffect(() => {
    if (!shouldPollForAppUpdates()) return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        const trackWaitingWorker = (worker: ServiceWorker | null) => {
          if (!worker || cancelled) return;
          waitingWorkerRef.current = worker;
          void fetchAppReleaseVersion().then((version) => {
            if (version) promptForAppUpdate(version);
          });
        };

        if (registration.waiting) {
          trackWaitingWorker(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              trackWaitingWorker(registration.waiting);
            }
          });
        });

        const onControllerChange = () => {
          window.location.reload();
        };

        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

        return () => {
          navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        };
      } catch {
        return undefined;
      }
    };

    let cleanupControllerListener: (() => void) | undefined;
    void registerServiceWorker().then((cleanup) => {
      cleanupControllerListener = cleanup;
    });

    return () => {
      cancelled = true;
      cleanupControllerListener?.();
    };
  }, []);

  if (!updateVersion) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-[200] flex justify-center p-3 sm:p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-2xl flex-col gap-3 rounded border border-[#2a4a2a] bg-[#071007]/95 p-4 text-[#b8ffb8] shadow-[0_0_24px_rgba(0,255,0,0.12)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-wide text-[#d8ffd8]">Update ready</p>
          <p className="mt-1 text-xs leading-relaxed text-[#8fd88f]">
            A newer Echo Mirage build is available. Restart to load the latest version.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded border border-[#2f6b2f] bg-[#0f1f0f] px-3 py-1.5 text-xs font-medium text-[#d8ffd8] transition hover:border-[#4caf50] hover:bg-[#163016]"
            onClick={dismissForNow}
          >
            Later
          </button>
          <button
            type="button"
            className="rounded border border-[#4caf50] bg-[#1b3d1b] px-3 py-1.5 text-xs font-medium text-[#e8ffe8] transition hover:bg-[#245824]"
            onClick={restartForUpdate}
          >
            Restart now
          </button>
        </div>
      </div>
    </div>
  );
}
