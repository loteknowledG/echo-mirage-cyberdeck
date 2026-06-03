"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import EmblaCarousel, { type EmblaCarouselType } from "embla-carousel";
import { CardContent } from "@/components/ui/card";
import { scrollMatrixTo } from "@/app/preview/preview-matrix-nav";
import { ensurePickerSnappedToCenter } from "@/lib/embla-ios-picker-loop";
import { cn } from "@/lib/utils";
import "./matrix-carousel.css";

const CENTER_ROW = 1;
const CENTER_COL = 1;

const MATRIX_DATA = [
  [
    {
      id: "1-1",
      title: "Deck 1 - Card 1",
      desc: "Drag vertically to change decks, horizontally to change cards.",
    },
    {
      id: "1-2",
      title: "Deck 1 - Card 2",
      desc: "Native Embla drag — same pattern as Powerfist hands.",
    },
    {
      id: "1-3",
      title: "Deck 1 - Card 3",
      desc: "Edge cards peek into view on the sides.",
    },
  ],
  [
    {
      id: "2-1",
      title: "Deck 2 - Card 1",
      desc: "You successfully dragged down to Deck 2!",
    },
    {
      id: "2-2",
      title: "Deck 2 - Card 2",
      desc: "Perfect focal origin center card layout.",
    },
    {
      id: "2-3",
      title: "Deck 2 - Card 3",
      desc: "Infinite matrix loops are supported.",
    },
  ],
  [
    {
      id: "3-1",
      title: "Deck 3 - Card 1",
      desc: "Bottom layer starting deck block.",
    },
    {
      id: "3-2",
      title: "Deck 3 - Card 2",
      desc: "Flick upwards to cycle back to Deck 1.",
    },
    {
      id: "3-3",
      title: "Deck 3 - Card 3",
      desc: "Final matrix intersection element.",
    },
  ],
];

export function MatrixCarousel() {
  const [activeRow, setActiveRow] = useState(CENTER_ROW);
  const [activeCols, setActiveCols] = useState<number[]>(() =>
    MATRIX_DATA.map(() => CENTER_COL),
  );

  const matrixRef = useRef<HTMLElement>(null);
  const deckViewportRef = useRef<HTMLDivElement>(null);
  const handViewportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const deckEmblaRef = useRef<EmblaCarouselType | null>(null);
  const handEmblaRefs = useRef<(EmblaCarouselType | null)[]>([]);
  const activeRowRef = useRef(CENTER_ROW);
  const activeColRef = useRef(CENTER_COL);

  const setActiveFocus = useCallback((row: number, col: number) => {
    activeRowRef.current = row;
    activeColRef.current = col;
    setActiveRow(row);
    setActiveCols((prev) => {
      const next = [...prev];
      next[row] = col;
      return next;
    });
  }, []);

  const syncFromEmbla = useCallback(() => {
    const deckEmbla = deckEmblaRef.current;
    if (!deckEmbla) return;
    const row = deckEmbla.selectedScrollSnap();
    const handEmbla = handEmblaRefs.current[row];
    const col = handEmbla?.selectedScrollSnap() ?? activeColRef.current;
    setActiveFocus(row, col);
  }, [setActiveFocus]);

  const syncHandCol = useCallback(
    (rowIndex: number, handEmbla: EmblaCarouselType) => {
      if (deckEmblaRef.current?.selectedScrollSnap() !== rowIndex) return;
      const col = handEmbla.selectedScrollSnap();
      setActiveFocus(rowIndex, col);
    },
    [setActiveFocus],
  );

  const attachHandEmbla = useCallback(
    (handEmbla: EmblaCarouselType, rowIndex: number) => {
      handEmbla.on("select", () => syncHandCol(rowIndex, handEmbla));

      handEmbla.on("settle", () => {
        if (deckEmblaRef.current?.selectedScrollSnap() !== rowIndex) return;
        if (ensurePickerSnappedToCenter(handEmbla)) return;
        syncHandCol(rowIndex, handEmbla);
      });

      handEmbla.on("scroll", () => {
        if (deckEmblaRef.current?.selectedScrollSnap() !== rowIndex) return;
        const engine = handEmbla.internalEngine();
        if (engine.dragHandler.pointerDown()) return;
        if (!engine.scrollBody.settled()) return;
        if (ensurePickerSnappedToCenter(handEmbla)) return;
        syncHandCol(rowIndex, handEmbla);
      });
    },
    [syncHandCol],
  );

  const recenterMatrix = useCallback(() => {
    const deckEmbla = deckEmblaRef.current;
    if (!deckEmbla) return;

    deckEmbla.reInit();
    handEmblaRefs.current.forEach((handEmbla) => handEmbla?.reInit());

    const next = scrollMatrixTo(
      deckEmbla,
      handEmblaRefs.current,
      activeRowRef.current,
      activeColRef.current,
      MATRIX_DATA.length,
    );
    setActiveFocus(next.deckIndex, next.cardIndex);
  }, [setActiveFocus]);

  const mountCarousels = useCallback(() => {
    const deckViewport = deckViewportRef.current;
    const matrix = matrixRef.current;
    if (!deckViewport || !matrix || deckViewport.clientHeight < 8) {
      return false;
    }

    deckEmblaRef.current?.destroy();
    handEmblaRefs.current.forEach((embla) => embla?.destroy());
    handEmblaRefs.current = [];

    MATRIX_DATA.forEach((_, rowIndex) => {
      const handViewport = handViewportRefs.current[rowIndex];
      if (!handViewport) return;

      const handEmbla = EmblaCarousel(handViewport, {
        axis: "x",
        loop: true,
        align: "center",
        dragFree: true,
        skipSnaps: false,
        containScroll: false,
      });

      handEmblaRefs.current[rowIndex] = handEmbla;
      attachHandEmbla(handEmbla, rowIndex);
    });

    const deckEmbla = EmblaCarousel(deckViewport, {
      axis: "y",
      loop: MATRIX_DATA.length > 1,
      align: "center",
      dragFree: false,
      containScroll: false,
      duration: 28,
    });

    deckEmblaRef.current = deckEmbla;
    deckEmbla.on("select", syncFromEmbla);

    const next = scrollMatrixTo(
      deckEmbla,
      handEmblaRefs.current,
      activeRowRef.current,
      activeColRef.current,
      MATRIX_DATA.length,
    );
    setActiveFocus(next.deckIndex, next.cardIndex);

    return true;
  }, [attachHandEmbla, setActiveFocus, syncFromEmbla]);

  useLayoutEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const tryMount = () => {
      if (cancelled) return false;
      return mountCarousels();
    };

    if (!tryMount()) {
      const matrix = matrixRef.current;
      if (matrix) {
        resizeObserver = new ResizeObserver(() => {
          if (tryMount()) resizeObserver?.disconnect();
        });
        resizeObserver.observe(matrix);
      }
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      deckEmblaRef.current?.destroy();
      deckEmblaRef.current = null;
      handEmblaRefs.current.forEach((embla) => embla?.destroy());
      handEmblaRefs.current = [];
    };
  }, [mountCarousels]);

  useEffect(() => {
    const matrix = matrixRef.current;
    if (!matrix) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        requestAnimationFrame(() => {
          if (!deckEmblaRef.current) {
            mountCarousels();
            return;
          }
          syncFromEmbla();
        });
      },
      { threshold: 0.1 },
    );

    observer.observe(matrix);
    return () => observer.disconnect();
  }, [mountCarousels, syncFromEmbla]);

  useEffect(() => {
    const matrix = matrixRef.current;
    const deckViewport = deckViewportRef.current;
    if (!matrix || !deckViewport) return;

    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => recenterMatrix());
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(matrix);
    observer.observe(deckViewport);

    const activeHand = handViewportRefs.current[activeRow];
    if (activeHand) observer.observe(activeHand);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [activeRow, recenterMatrix]);

  return (
    <div className="test-matrix flex h-full min-h-0 w-full items-center justify-center p-4">
      <div className="test-matrix__stage">
        <section
          className="test-matrix__matrix"
          ref={matrixRef}
          data-testid="test-matrix-carousel"
          aria-label="Deck matrix carousel"
        >
          <div className="test-matrix__deckViewport" ref={deckViewportRef}>
            <div className="test-matrix__deckContainer">
              {MATRIX_DATA.map((row, rowIndex) => {
                const isRowSelected = activeRow === rowIndex;

                return (
                  <section
                    key={rowIndex}
                    className={cn(
                      "test-matrix__deckSlide",
                      isRowSelected && "is-selected",
                    )}
                  >
                    <div
                      className="test-matrix__handViewport"
                      ref={(el) => {
                        handViewportRefs.current[rowIndex] = el;
                      }}
                    >
                      <div className="test-matrix__handContainer">
                        {row.map((item, colIndex) => {
                          const isCardSelected =
                            isRowSelected && activeCols[rowIndex] === colIndex;

                          return (
                            <article
                              key={item.id}
                              className={cn(
                                "test-matrix__cardSlide",
                                isCardSelected && "is-selected",
                              )}
                            >
                              <div
                                className={cn(
                                  "h-full w-full transform-gpu rounded-xl border bg-slate-900 text-white transition-all duration-300",
                                  isCardSelected
                                    ? "border-emerald-500 bg-slate-900/90 shadow-xl shadow-[0_0_35px_rgba(16,185,129,0.12)]"
                                    : "border-slate-800",
                                )}
                              >
                                <CardContent className="flex h-full flex-col justify-between p-8">
                                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
                                    <span>Deck Grid</span>
                                    <span
                                      className={cn(
                                        "rounded px-2 py-0.5 font-mono text-[10px]",
                                        isCardSelected
                                          ? "bg-emerald-900 text-emerald-300"
                                          : "bg-slate-800",
                                      )}
                                    >
                                      {item.id}
                                    </span>
                                  </div>

                                  <div className="space-y-2">
                                    <h2
                                      className={cn(
                                        "text-2xl font-bold tracking-tight",
                                        isCardSelected
                                          ? "text-emerald-400"
                                          : "text-slate-400",
                                      )}
                                    >
                                      {item.title}
                                    </h2>
                                    <p className="text-sm leading-relaxed text-slate-400">
                                      {item.desc}
                                    </p>
                                  </div>

                                  <div className="text-[11px] font-medium text-slate-500">
                                    dragFree · settle center snap
                                  </div>
                                </CardContent>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
