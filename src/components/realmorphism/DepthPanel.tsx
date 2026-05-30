'use client';

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import './depth-panel.css';

export type DepthPanelVariant = 'module' | 'control' | 'inset';
export type DepthPanelPosture = 'neutral' | 'signal' | 'amber' | 'critical';

export type DepthPanelProps = {
  children: ReactNode;
  /** Extrusion depth in px — drives --panel-depth for all faces. */
  depth?: number;
  variant?: DepthPanelVariant;
  /** Future posture tint without markup changes. */
  posture?: DepthPanelPosture;
  /** Status glow on the front face ink. */
  glow?: boolean;
  /** Subtle scan-line ascii texture on the face. */
  asciiOverlay?: boolean;
  /** Cable stub overlay (reserved). */
  cable?: boolean;
  className?: string;
  faceClassName?: string;
} & HTMLAttributes<HTMLDivElement>;

function depthPanelStyle(depth: number): CSSProperties {
  return { '--panel-depth': `${depth}px` } as CSSProperties;
}

function postureDataAttr(posture: DepthPanelPosture): string | undefined {
  return posture === 'neutral' ? undefined : posture;
}

/** Mechanical depth primitive — front face + right/bottom walls via CSS faces. */
export function DepthPanel({
  children,
  depth = 8,
  variant = 'module',
  posture = 'neutral',
  glow = false,
  asciiOverlay = false,
  cable = false,
  className,
  faceClassName,
  style,
  ...props
}: DepthPanelProps) {
  return (
    <div
      className={cn('depth-panel', `depth-panel--${variant}`, className)}
      style={{ ...depthPanelStyle(depth), ...style }}
      data-posture={postureDataAttr(posture)}
      data-glow={glow ? 'true' : undefined}
      data-cable={cable ? 'true' : undefined}
      {...props}
    >
      {cable ? <span className="depth-panel__cable" aria-hidden /> : null}
      <div
        className={cn('depth-panel__face', asciiOverlay && 'depth-panel__face--ascii', faceClassName)}
      >
        {children}
      </div>
    </div>
  );
}

export type DepthButtonProps = {
  children: ReactNode;
  depth?: number;
  posture?: DepthPanelPosture;
  glow?: boolean;
  asciiOverlay?: boolean;
  className?: string;
  faceClassName?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

/** Control variant — walls collapse on press so the face physically drops. */
export function DepthButton({
  children,
  depth = 6,
  posture = 'neutral',
  glow = false,
  asciiOverlay = false,
  className,
  faceClassName,
  style,
  type = 'button',
  ...props
}: DepthButtonProps) {
  return (
    <button
      type={type}
      className={cn('depth-panel', 'depth-panel--control', className)}
      style={{ ...depthPanelStyle(depth), ...style }}
      data-posture={postureDataAttr(posture)}
      data-glow={glow ? 'true' : undefined}
      {...props}
    >
      <span
        className={cn(
          'depth-panel__face',
          'inline-flex min-w-[5.5rem] items-center justify-center px-3 py-2 font-mono text-[10px] tracking-[0.08em]',
          asciiOverlay && 'depth-panel__face--ascii',
          faceClassName,
        )}
      >
        {children}
      </span>
    </button>
  );
}
