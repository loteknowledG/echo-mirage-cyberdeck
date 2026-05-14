"use client";

import { useEffect, useState } from "react";
import type { IndicateMarker } from "./computer-use-types";
import { getMarkers } from "./indicate-layer";

export default function IndicateOverlay() {
  const [markers, setMarkers] = useState<readonly IndicateMarker[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarkers(getMarkers());
    }, 200);
    return () => clearInterval(interval);
  }, []);

  if (markers.length === 0) return null;

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
