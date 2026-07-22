"use client";

import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

interface SwipeToReleaseProps {
  onRelease: () => void;
  children: ReactNode;
}

const DECISION_PX = 8; // movement needed before we decide horizontal-drag vs vertical-scroll
const CLICK_THRESHOLD_PX = 6; // below this, treat pointerup as a tap, not a drag
const RELEASE_FRACTION = 0.32; // fraction of card width that commits a release
const EXIT_MS = 260;
const COLLAPSE_MS = 220;

export function SwipeToRelease({ onRelease, children }: SwipeToReleaseProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const draggingRef = useRef(false);
  const lockedHorizontalRef = useRef<boolean | null>(null);
  const suppressClickRef = useRef(false);

  const [dragX, setDragX] = useState(0);
  const [phase, setPhase] = useState<"idle" | "dragging" | "exiting" | "collapsing">("idle");
  const [collapseHeight, setCollapseHeight] = useState<number | null>(null);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "idle") return;
    draggingRef.current = true;
    lockedHorizontalRef.current = null;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (lockedHorizontalRef.current === null) {
      if (Math.abs(dx) < DECISION_PX && Math.abs(dy) < DECISION_PX) return;
      lockedHorizontalRef.current = Math.abs(dx) > Math.abs(dy);
      if (lockedHorizontalRef.current) {
        wrapperRef.current?.setPointerCapture(e.pointerId);
        setPhase("dragging");
      } else {
        draggingRef.current = false; // hand off to native vertical scroll
        return;
      }
    }

    if (!lockedHorizontalRef.current) return;
    setDragX(dx);
  };

  const commitRelease = (direction: 1 | -1) => {
    const el = wrapperRef.current;
    const width = el?.offsetWidth ?? 320;
    const height = el?.offsetHeight ?? 64;
    suppressClickRef.current = true;
    setPhase("exiting");
    setDragX(direction * (width + 60));
    window.setTimeout(() => {
      setCollapseHeight(height);
      requestAnimationFrame(() => setCollapseHeight(0));
      window.setTimeout(onRelease, COLLAPSE_MS);
    }, EXIT_MS);
  };

  const handlePointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (!lockedHorizontalRef.current) return;

    const el = wrapperRef.current;
    const width = el?.offsetWidth ?? 320;
    if (Math.abs(dragX) > width * RELEASE_FRACTION) {
      commitRelease(dragX > 0 ? 1 : -1);
      return;
    }
    if (Math.abs(dragX) > CLICK_THRESHOLD_PX) {
      suppressClickRef.current = true;
    }
    setPhase("idle");
    setDragX(0);
  };

  const handleClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  };

  const isAnimating = phase === "exiting" || phase === "collapsing";

  return (
    <div
      ref={wrapperRef}
      className="relative"
      style={{
        overflow: "hidden",
        touchAction: "pan-y",
        maxHeight: collapseHeight ?? undefined,
        transition: phase === "collapsing" ? `max-height ${COLLAPSE_MS}ms ease` : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClickCapture={handleClickCapture}
    >
      <div
        style={{
          transform: `translateX(${dragX}px)`,
          transition:
            phase === "idle" || phase === "exiting"
              ? `transform ${phase === "exiting" ? EXIT_MS : 180}ms ease`
              : undefined,
        }}
      >
        {children}
      </div>
      {isAnimating && (
        <div className="release-glow" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="release-bubble"
              style={{
                left: `${12 + i * 15}%`,
                width: 6 + (i % 3) * 3,
                height: 6 + (i % 3) * 3,
                animationDelay: `${i * 35}ms`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
