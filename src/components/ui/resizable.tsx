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
  children: React.ReactNode;
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

export function ResizablePanelGroup({
  orientation = 'horizontal',
  className,
  children,
}: ResizablePanelGroupProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = React.useState(0);
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

    const initialSizes = Array(panelCount).fill(1 / panelCount);

    for (let i = 0; i < panelCount; i += 1) {
      const panel = panels[i] as React.ReactElement<{ defaultSize?: SizeValue }>;
      const fraction = parseFraction(panel?.props?.defaultSize);
      if (typeof fraction === 'number' && fraction > 0) {
        initialSizes[i] = fraction;
      }
    }

    initialSizesRef.current = initialSizes;
    layoutKeyRef.current = layoutKey;
    setSizes(initialSizes);
  }, [orientation, panelCount, panels, sizes.length]);

  const dragState = React.useRef<{
    index: number;
    startPos: number;
    startSizes: number[];
    minSizes: number[];
    maxSizes: number[];
  } | null>(null);

  const isHorizontal = orientation === 'horizontal';

  const getPanelFraction = (i: number) => sizes[i] ?? 0;

  const resetSizes = React.useCallback(() => {
    if (!initialSizesRef.current) return;
    setSizes([...initialSizesRef.current]);
  }, []);

  const updateSizes = (index: number, deltaPx: number) => {
    if (containerSize <= 0) return;

    const deltaFraction = deltaPx / containerSize;
    const leftIndex = index;
    const rightIndex = index + 1;

    const state = dragState.current;
    if (!state) return;

    const leftMin = state.minSizes[leftIndex];
    const leftMax = state.maxSizes[leftIndex];
    const rightMin = state.minSizes[rightIndex];
    const rightMax = state.maxSizes[rightIndex];

    let newLeft = state.startSizes[leftIndex] + deltaFraction;
    let newRight = state.startSizes[rightIndex] - deltaFraction;

    // Enforce min/max constraints.
    newLeft = clamp(newLeft, leftMin, leftMax);
    newRight = clamp(newRight, rightMin, rightMax);

    // Ensure they still add up to the same total (approx).
    const total = newLeft + newRight;
    const startTotal = state.startSizes[leftIndex] + state.startSizes[rightIndex];
    if (total !== 0 && startTotal !== 0) {
      const scale = startTotal / total;
      newLeft *= scale;
      newRight *= scale;
    }

    const nextSizes = [...state.startSizes];
    nextSizes[leftIndex] = newLeft;
    nextSizes[rightIndex] = newRight;
    setSizes(nextSizes);
  };

  const endDrag = () => {
    dragState.current = null;
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

  const startDrag = (index: number, startPos: number) => {
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

    dragState.current = {
      index,
      startPos,
      startSizes: [...sizes],
      minSizes,
      maxSizes,
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  return (
    <div
      ref={containerRef}
      className={cn('h-full w-full', className)}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        height: '100%',
        width: '100%',
      }}
    >
      {childrenArray.map((child) => {
        if (getResizableRole(child) === 'panel') {
          const panelIndex = panels.indexOf(child);
          const panel = child as React.ReactElement<ResizablePanelProps>;
          const size = getPanelFraction(panelIndex) * 100;

          const style: React.CSSProperties = isHorizontal
            ? {
                flexGrow: 0,
                flexShrink: 0,
                flexBasis: `${size}%`,
                minWidth: `${(parseFraction(panel.props.minSize) ?? 0) * 100}%`,
                maxWidth: `${(parseFraction(panel.props.maxSize) ?? 1) * 100}%`,
              }
            : {
                flexGrow: 0,
                flexShrink: 0,
                flexBasis: `${size}%`,
                minHeight: `${(parseFraction(panel.props.minSize) ?? 0) * 100}%`,
                maxHeight: `${(parseFraction(panel.props.maxSize) ?? 1) * 100}%`,
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

        return React.cloneElement(handle, {
          role: 'separator',
          title: 'Drag to resize. Double-click to reset.',
          onPointerDown: (event: React.PointerEvent) => {
            event.preventDefault();
            event.stopPropagation();
            startDrag(handleIndex, isHorizontal ? event.clientX : event.clientY);
          },
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

export function ResizableHandle({ withHandle = false, stacked = false, className, ...props }: ResizableHandleProps) {
  return (
    <div
      className={cn(
        stacked
          ? 'relative z-20 flex-none self-stretch h-1 min-h-[6px] w-full flex items-center justify-center border-y border-slate-700/35 bg-slate-950/90 hover:bg-slate-700/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 cursor-row-resize touch-none'
          : 'relative z-20 flex-none self-stretch w-px min-w-[6px] flex items-center justify-center border-x border-slate-700/35 bg-slate-950/90 hover:bg-slate-700/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 cursor-col-resize touch-none',
        className,
      )}
      {...props}
    >
      {withHandle ? (
        stacked ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-px w-14 rounded-full bg-slate-400/70 shadow-[0_0_8px_rgba(148,163,184,0.12)]" />
          </div>
        ) : (
          <div className="h-full w-px rounded-full bg-slate-400/70 shadow-[0_0_8px_rgba(148,163,184,0.12)]" />
        )
      ) : null}
    </div>
  );
}
ResizableHandle.resizableRole = 'handle' as const;
