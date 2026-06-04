'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type Orientation = 'horizontal' | 'vertical';

type SizeValue = string | number | undefined;

type ResizableRole = 'panel' | 'handle';

type ResizableComponentType = {
  resizableRole?: ResizableRole;
};

function getResizableRole(child: React.ReactElement): ResizableRole | undefined {
  const type = child.type as ResizableComponentType;
  if (type?.resizableRole) return type.resizableRole;
  if (type === ResizablePanel) return 'panel';
  if (type === ResizableHandle) return 'handle';
  return undefined;
}

export type ResizablePanelGroupProps = {
  orientation?: Orientation;
  className?: string;
  memoryKey?: string;
  onSizesChange?: (sizes: number[]) => void;
  children: React.ReactNode;
};

const rememberedPanelSizes = new Map<string, number[]>();

const readRememberedPanelSizes = (key: string, panelCount: number) => {
  const inMemory = rememberedPanelSizes.get(key);
  if (inMemory) return [...inMemory];

  try {
    const serialized = window.localStorage.getItem(key);
    if (!serialized) return undefined;

    const stored = JSON.parse(serialized);
    if (
      !Array.isArray(stored) ||
      stored.length !== panelCount ||
      stored.some((size) => typeof size !== 'number' || !Number.isFinite(size) || size < 0)
    ) {
      return undefined;
    }

    rememberedPanelSizes.set(key, stored);
    return [...stored];
  } catch {
    return undefined;
  }
};

const storeRememberedPanelSizes = (key: string, sizes: number[]) => {
  rememberedPanelSizes.set(key, [...sizes]);

  try {
    window.localStorage.setItem(key, JSON.stringify(sizes));
  } catch {
    // Resize still works if browser storage is unavailable.
  }
};

const parseFraction = (value?: SizeValue) => {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value > 1 ? value / 100 : value;

  const withoutPercent = value.replace('%', '');
  const num = Number(withoutPercent);
  if (!Number.isFinite(num)) return undefined;

  return value.includes('%') ? num / 100 : num > 1 ? num / 100 : num;
};

const clamp = (value: number, min?: number, max?: number) => {
  let result = value;
  if (typeof min === 'number') result = Math.max(result, min);
  if (typeof max === 'number') result = Math.min(result, max);
  return result;
};

const normalizeInitialSizes = (
  sizes: number[],
  panels: React.ReactElement[],
): number[] => {
  const panelCount = sizes.length;
  const minSizes = sizes.map(
    (_, i) =>
      parseFraction(
        (panels[i] as React.ReactElement<{ minSize?: SizeValue }>)?.props?.minSize,
      ) ?? 0,
  );
  const maxSizes = sizes.map(
    (_, i) =>
      parseFraction(
        (panels[i] as React.ReactElement<{ maxSize?: SizeValue }>)?.props?.maxSize,
      ) ?? 1,
  );

  const minTotal = minSizes.reduce((sum, size) => sum + size, 0);
  if (minTotal >= 1) {
    return minSizes.map((size) => size / minTotal);
  }

  const next = sizes.map((size, i) => clamp(size, minSizes[i], maxSizes[i]));
  for (let i = 0; i < panelCount; i += 1) {
    next[i] = Math.max(next[i], minSizes[i]);
  }

  let total = next.reduce((sum, size) => sum + size, 0);
  if (total > 1) {
    let overflow = total - 1;
    while (overflow > 0.0001) {
      let reduced = false;
      for (let i = panelCount - 1; i >= 0 && overflow > 0; i -= 1) {
        const slack = next[i] - minSizes[i];
        if (slack <= 0) continue;
        const take = Math.min(slack, overflow);
        next[i] -= take;
        overflow -= take;
        reduced = true;
      }
      if (!reduced) break;
    }
  }

  total = next.reduce((sum, size) => sum + size, 0);
  if (total < 1) {
    next[0] += 1 - total;
  }

  total = next.reduce((sum, size) => sum + size, 0);
  if (total <= 0) {
    return Array(panelCount).fill(1 / panelCount);
  }

  return next.map((size) => size / total);
};

export function ResizablePanelGroup({
  orientation = 'horizontal',
  className,
  memoryKey,
  onSizesChange,
  children,
}: ResizablePanelGroupProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = React.useState(0);
  const [handleSpan, setHandleSpan] = React.useState(0);
  const [sizes, setSizes] = React.useState<number[]>([]);
  const initialSizesRef = React.useRef<number[] | null>(null);
  const layoutKeyRef = React.useRef<string>("");

  const childrenArray = React.Children.toArray(children).filter(
    (child): child is React.ReactElement => React.isValidElement(child),
  );
  const panels = childrenArray.filter((child) => getResizableRole(child) === 'panel');
  const handles = childrenArray.filter((child) => getResizableRole(child) === 'handle');
  const panelCount = panels.length;

  // Track container size so we can calculate fractions for dragging.
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize(orientation === 'horizontal' ? rect.width : rect.height);
      if (orientation === 'vertical') {
        let span = 0;
        el.querySelectorAll('[role="separator"]').forEach((node) => {
          span += node.getBoundingClientRect().height;
        });
        setHandleSpan(span);
      } else {
        setHandleSpan(0);
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [orientation]);

  // Initialize sizes from panel props if not already set.
  React.useLayoutEffect(() => {
    const layoutKey = `${orientation}:${panelCount}`;
    if (sizes.length === panelCount && layoutKeyRef.current === layoutKey) return;

    const rememberedKey = memoryKey ? `${memoryKey}:${layoutKey}` : undefined;
    const rememberedSizes = rememberedKey ? readRememberedPanelSizes(rememberedKey, panelCount) : undefined;
    const initialSizes = rememberedSizes ? [...rememberedSizes] : Array(panelCount).fill(1 / panelCount);

    if (!rememberedSizes) {
      for (let i = 0; i < panelCount; i += 1) {
        const panel = panels[i] as React.ReactElement<{ defaultSize?: SizeValue }>;
        const fraction = parseFraction(panel?.props?.defaultSize);
        if (typeof fraction === 'number' && fraction > 0) {
          initialSizes[i] = fraction;
        }
      }
    }

    const normalizedSizes = normalizeInitialSizes(initialSizes, panels as React.ReactElement[]);

    initialSizesRef.current = normalizedSizes;
    layoutKeyRef.current = layoutKey;
    setSizes(normalizedSizes);
  }, [memoryKey, orientation, panelCount, panels, sizes.length]);

  React.useEffect(() => {
    if (!memoryKey || sizes.length !== panelCount || panelCount === 0) return;
    storeRememberedPanelSizes(`${memoryKey}:${orientation}:${panelCount}`, sizes);
  }, [memoryKey, orientation, panelCount, sizes]);

  React.useEffect(() => {
    if (sizes.length !== panelCount || panelCount === 0) return;
    onSizesChange?.(sizes);
  }, [onSizesChange, panelCount, sizes]);

  const dragState = React.useRef<{
    index: number;
    startPos: number;
    startSizes: number[];
    minSizes: number[];
    maxSizes: number[];
    pointerId: number | null;
    captureTarget: HTMLElement | null;
  } | null>(null);

  const isHorizontal = orientation === 'horizontal';

  const getPanelFraction = (i: number) => sizes[i] ?? 0;

  const resetSizes = React.useCallback(() => {
    if (!initialSizesRef.current) return;
    setSizes([...initialSizesRef.current]);
  }, []);

  const collectPanelConstraints = React.useCallback(() => {
    const minSizes = Array(panelCount).fill(0);
    const maxSizes = Array(panelCount).fill(1);

    for (let i = 0; i < panelCount; i += 1) {
      const panel = panels[i] as React.ReactElement<{
        minSize?: SizeValue;
        maxSize?: SizeValue;
      }>;
      const minFraction = parseFraction(panel?.props?.minSize);
      const maxFraction = parseFraction(panel?.props?.maxSize);
      if (typeof minFraction === 'number') minSizes[i] = minFraction;
      if (typeof maxFraction === 'number') maxSizes[i] = maxFraction;
    }

    return { minSizes, maxSizes };
  }, [panelCount, panels]);

  const restoreDocumentTouch = React.useCallback(() => {
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('touch-action');
  }, []);

  const lockDocumentTouch = React.useCallback(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }, []);

  const updateSizes = (index: number, deltaPx: number) => {
    const trackSize = isHorizontal
      ? containerSize
      : Math.max(containerSize - handleSpan, 1);
    if (trackSize <= 0) return;

    const deltaFraction = deltaPx / trackSize;
    const leftIndex = index;
    const rightIndex = index + 1;

    const state = dragState.current;
    if (!state) return;

    const leftMin = state.minSizes[leftIndex];
    const leftMax = state.maxSizes[leftIndex];
    const rightMin = state.minSizes[rightIndex];
    const rightMax = state.maxSizes[rightIndex];

    const nextSizes = [...state.startSizes];

    if (state.startSizes.length === 2) {
      let newLeading = state.startSizes[leftIndex] + deltaFraction;
      const leadingMax = Math.min(leftMax, 1 - rightMin);
      const leadingMin = Math.max(leftMin, 1 - rightMax);
      newLeading = clamp(newLeading, leadingMin, leadingMax);
      nextSizes[leftIndex] = newLeading;
      nextSizes[rightIndex] = 1 - newLeading;
      setSizes(nextSizes);
      return;
    }

    let newLeft = state.startSizes[leftIndex] + deltaFraction;
    let newRight = state.startSizes[rightIndex] - deltaFraction;

    newLeft = clamp(newLeft, leftMin, leftMax);
    newRight = clamp(newRight, rightMin, rightMax);

    const total = newLeft + newRight;
    const startTotal = state.startSizes[leftIndex] + state.startSizes[rightIndex];
    if (total !== 0 && startTotal !== 0) {
      const scale = startTotal / total;
      newLeft *= scale;
      newRight *= scale;
    }

    nextSizes[leftIndex] = newLeft;
    nextSizes[rightIndex] = newRight;
    setSizes(nextSizes);
  };

  const endDrag = () => {
    const state = dragState.current;
    if (state?.captureTarget && state.pointerId !== null) {
      try {
        state.captureTarget.releasePointerCapture(state.pointerId);
      } catch {
        // Pointer may already be released.
      }
    }
    dragState.current = null;
    restoreDocumentTouch();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  };

  const onPointerMove = (event: PointerEvent) => {
    const state = dragState.current;
    if (!state) return;

    const currentPos = isHorizontal ? event.clientX : event.clientY;
    const delta = currentPos - state.startPos;
    updateSizes(state.index, delta);
  };

  const startDrag = (
    index: number,
    startPos: number,
    event: React.PointerEvent<Element>,
  ) => {
    const { minSizes, maxSizes } = collectPanelConstraints();

    const captureTarget = event.currentTarget as HTMLElement;
    captureTarget.setPointerCapture(event.pointerId);
    lockDocumentTouch();

    dragState.current = {
      index,
      startPos,
      startSizes: [...sizes],
      minSizes,
      maxSizes,
      pointerId: event.pointerId,
      captureTarget,
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  React.useEffect(() => () => restoreDocumentTouch(), [restoreDocumentTouch]);

  const useStackedGrid =
    !isHorizontal && panelCount === 2 && handles.length === 1 && sizes.length === 2;
  const leadingFraction = useStackedGrid ? getPanelFraction(0) : 0;
  const trailingFraction = useStackedGrid ? getPanelFraction(1) : 0;

  return (
    <div
      ref={containerRef}
      className={cn('h-full w-full', className)}
      style={
        useStackedGrid
          ? {
              display: 'grid',
              gridTemplateRows: `minmax(0, ${leadingFraction}fr) auto minmax(0, ${trailingFraction}fr)`,
              height: '100%',
              width: '100%',
            }
          : {
              display: 'flex',
              flexDirection: isHorizontal ? 'row' : 'column',
              height: '100%',
              width: '100%',
            }
      }
    >
      {childrenArray.map((child) => {
        if (getResizableRole(child) === 'panel') {
          const panelIndex = panels.indexOf(child);
          const panel = child as React.ReactElement<ResizablePanelProps>;
          const size = getPanelFraction(panelIndex) * 100;

          const minFraction = parseFraction(panel.props.minSize) ?? 0;
          const maxFraction = parseFraction(panel.props.maxSize) ?? 1;
          const style: React.CSSProperties = isHorizontal
            ? {
                flex: `${size} 1 0`,
                minWidth: 0,
                minHeight: 0,
                ...(minFraction > 0 ? { minWidth: `${minFraction * 100}%` } : {}),
                maxWidth: `${maxFraction * 100}%`,
              }
            : {
                flex: `${size} 1 0`,
                minWidth: 0,
                minHeight: 0,
                ...(minFraction > 0 ? { minHeight: `${minFraction * 100}%` } : {}),
                maxHeight: `${maxFraction * 100}%`,
              };

          return React.cloneElement(panel, {
            style: { ...style, ...panel.props.style },
          });
        }

        if (getResizableRole(child) !== 'handle') {
          return child;
        }

        const handleIndex = handles.indexOf(child);
        const handle = child as React.ReactElement<ResizableHandleProps>;

        const beginResize = (event: React.PointerEvent<Element>) => {
          event.preventDefault();
          event.stopPropagation();
          startDrag(handleIndex, isHorizontal ? event.clientX : event.clientY, event);
        };

        return React.cloneElement(handle, {
          role: 'separator',
          title: 'Drag to resize. Double-click to reset.',
          'aria-label':
            handle.props['aria-label'] ??
            (!isHorizontal ? 'Resize chat and work panes' : 'Drag to resize columns'),
          onPointerDown: beginResize,
          onDoubleClick: (event: React.MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            resetSizes();
          },
          style: {
            cursor: isHorizontal ? 'col-resize' : 'row-resize',
            ...handle.props.style,
          },
        });
      })}
    </div>
  );
}

export type ResizablePanelProps = {
  defaultSize?: string | number;
  minSize?: string | number;
  maxSize?: string | number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export function ResizablePanel({
  defaultSize: _defaultSize,
  minSize: _minSize,
  maxSize: _maxSize,
  className,
  children,
  ...props
}: ResizablePanelProps) {
  // defaultSize/minSize/maxSize are only used by the ResizablePanelGroup logic.
  // They should not be forwarded to the DOM element.
  return (
    <div className={cn('relative min-h-0 min-w-0', className)} {...props}>
      {children}
    </div>
  );
}
ResizablePanel.resizableRole = 'panel' as const;

export type ResizableHandleProps = {
  withHandle?: boolean;
  stacked?: boolean;
  className?: string;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>;

export function ResizableHandle({
  withHandle = false,
  stacked = false,
  className,
  onPointerDown,
  ...props
}: ResizableHandleProps) {
  return (
    <div
      className={cn(
        stacked
          ? 'relative z-20 box-border flex h-px min-h-[6px] w-full flex-none shrink-0 cursor-row-resize touch-none select-none items-center justify-center border-y border-slate-700/35 bg-slate-950/90 hover:bg-slate-700/30 [-webkit-tap-highlight-color:transparent] before:absolute before:-top-3 before:-bottom-3 before:left-0 before:right-0 before:content-[""] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300'
          : 'relative z-20 flex-none self-stretch w-px min-w-[6px] flex items-center justify-center border-x border-slate-700/35 bg-slate-950/90 hover:bg-slate-700/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 cursor-col-resize touch-none select-none [-webkit-tap-highlight-color:transparent]',
        className,
      )}
      onPointerDown={onPointerDown}
      {...props}
    >
      {withHandle ? (
        stacked ? (
          <div className="pointer-events-none h-px w-full rounded-full bg-slate-400/70 shadow-[0_0_8px_rgba(148,163,184,0.12)]" />
        ) : (
          <div className="pointer-events-none h-full w-px rounded-full bg-slate-400/70 shadow-[0_0_8px_rgba(148,163,184,0.12)]" />
        )
      ) : null}
    </div>
  );
}
ResizableHandle.resizableRole = 'handle' as const;
