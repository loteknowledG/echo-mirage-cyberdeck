"use client";

import { useEffect, useState, useRef } from "react";
import type { IndicateMarker } from "./computer-use-types";
import { getMarkers } from "./indicate-layer";
import { trackCursorPosition, addPresenceListener, resetPresence, type PresenceEvent } from "./cursor-presence";
import { narrate } from "./narration";
import { acknowledgeCurrentStep, advanceWorkflow } from "./guided-workflow";
import { proceedToNextStep } from "./guided-teaching";
import { acknowledgeWatchdog, cancelTeachingWatchdog, cancelStepWatchdog, startStepWatchdog } from "./teardown";
import { isObserving, recordEvent } from "./workflow-observation";

const DEBUG = process.env.NODE_ENV !== "production";

export default function IndicateOverlay() {
  const [markers, setMarkers] = useState<readonly IndicateMarker[]>([]);
  const renderCountRef = useRef(0);
  const pollCountRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const current = getMarkers();
      setMarkers(current);
      if (DEBUG) {
        pollCountRef.current += 1;
        console.debug(`[OVERLAY-DEBUG] poll #${pollCountRef.current} - ${current.length} marker(s)`, current.map((m) => ({
          id: m.id,
          style: m.style,
          position: m.position,
          label: m.label ?? "(none)",
          width: m.width ?? 0,
          height: m.height ?? 0,
          computedBounds: (m.width ?? 0) > 0 && (m.height ?? 0) > 0
            ? { left: m.position.x - (m.width! / 2), top: m.position.y - (m.height! / 2), right: m.position.x + (m.width! / 2), bottom: m.position.y + (m.height! / 2) }
            : null,
        })));
      }
    }, 200);

    const onMouseMove = (e: MouseEvent) => {
      const currentMarkers = getMarkers();
      trackCursorPosition(e.clientX, e.clientY, currentMarkers);
    };

    window.addEventListener("mousemove", onMouseMove);

    const unsubscribe = addPresenceListener((event: PresenceEvent, marker: IndicateMarker) => {
      if (DEBUG) {
        console.debug("[OVERLAY-DEBUG] presence event", { event, markerId: marker.id, style: marker.style });
      }
      if (event === "CURSOR_ENTER_REGION") {
        const acknowledged = acknowledgeCurrentStep(marker.id);
        if (DEBUG) {
          console.debug("[OVERLAY-DEBUG] cursor enter region", { markerId: marker.id, acknowledged });
        }
        if (acknowledged) {
          narrate("CURSOR_ENTER_REGION");
          if (isObserving()) {
            recordEvent("cursor_enter_region", marker.id, `Cursor entered region: ${marker.label ?? marker.id}`);
          }
          acknowledgeWatchdog();
          cancelStepWatchdog();
          const next = advanceWorkflow();
          if (next) {
            narrate("STEP_ACKNOWLEDGED");
            if (isObserving()) {
              recordEvent("step_acknowledged", `Step: ${marker.label ?? marker.id}`, "Step acknowledged by cursor entry, advancing workflow");
            }
            void proceedToNextStep();
          } else {
            narrate("STEP_ACKNOWLEDGED");
            if (isObserving()) {
              recordEvent("teaching_end", "Teaching workflow completed", "All steps acknowledged, workflow ended");
            }
          }
        }
      }
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener("mousemove", onMouseMove);
      unsubscribe();
      resetPresence();
      cancelTeachingWatchdog();
      cancelStepWatchdog();
    };
  }, []);

  if (markers.length === 0) return null;

  if (DEBUG) {
    renderCountRef.current += 1;
    console.debug(`[OVERLAY-RENDER] render #${renderCountRef.current} - ${markers.length} marker(s) visible`);
  }

  return (
    <div
      aria-hidden="true"
      data-computer-use-indicate-overlay="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      {markers.map((marker) => {
        const { x, y, anchor = "center" } = marker.position;
        const offsetX = anchor.includes("left") ? -20 : anchor.includes("right") ? 0 : -20;
        const offsetY = anchor.includes("top") ? -20 : anchor.includes("bottom") ? 0 : -20;

        if (marker.style === "dot") {
          return (
            <div
              key={marker.id}
              data-computer-use-indicate-marker={marker.style}
              style={{
                position: "absolute",
                left: x + offsetX,
                top: y + offsetY,
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: marker.color ?? "#86efac",
                opacity: 0.85,
                transform: "translate(0, 0)",
              }}
            />
          );
        }

        if (marker.style === "glow") {
          const width = marker.width ?? 96;
          const height = marker.height ?? 56;
          return (
            <div
              key={marker.id}
              data-computer-use-indicate-marker={marker.style}
              style={{
                position: "absolute",
                left: x - width / 2,
                top: y - height / 2,
                width,
                height,
                borderRadius: 8,
                backgroundColor: marker.color ?? "#86efac",
                border: `1px solid ${marker.color ?? "#86efac"}`,
                boxShadow: `0 0 18px ${marker.color ?? "#86efac"}`,
                opacity: 0.16,
                transform: "translate(0, 0)",
              }}
            />
          );
        }

        return (
          <div
            key={marker.id}
            data-computer-use-indicate-marker={marker.style ?? "ring"}
            style={{
              position: "absolute",
              left: x + offsetX,
              top: y + offsetY,
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: `2px solid ${marker.color ?? "#86efac"}`,
              opacity: 0.8,
              transform: "translate(-14px, -14px)",
            }}
          >
            {marker.label && (
              <div
                style={{
                  position: "absolute",
                  left: "100%",
                  top: "50%",
                  transform: "translateY(-50%)",
                  marginLeft: 8,
                  whiteSpace: "nowrap",
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: marker.color ?? "#86efac",
                  opacity: 0.9,
                  textShadow: "0 0 4px #000",
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {marker.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
