"use client";

import * as React from "react";
import Link from "next/link";
import { m, type Transition } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * VengeanceUI Diagonal Carousel, adapted: `m` instead of `motion` (the app runs LazyMotion in strict mode), site colour
 * tokens, a configurable slide aspect, and linked slides. Clicking an inactive slide selects it; the active slide is a
 * link to its `href` (a link, never nested inside a button). `wrapSlide` lets callers wrap each slide, e.g. in a
 * CursorCard.
 */
export interface DiagonalCarouselItem {
  src: string;
  title: string;
  alt?: string;
  href?: string;
}

export interface DiagonalCarouselProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: DiagonalCarouselItem[];
  activeIndex?: number;
  defaultActiveIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  loop?: boolean;
  slideSize?: number;
  /** CSS aspect-ratio of each slide, e.g. "3/4" for portrait screenshots. */
  slideAspect?: string;
  rotationStep?: number;
  verticalStep?: number;
  inactiveScale?: number;
  transition?: Transition;
  showControls?: boolean;
  showDots?: boolean;
  wrapSlide?: (slide: React.ReactNode, item: DiagonalCarouselItem, index: number, isActive: boolean) => React.ReactNode;
  viewportClassName?: string;
  /** Positions the row of slides inside the viewport: the active slide is centred on this point (default: the middle). */
  trackClassName?: string;
  slideClassName?: string;
  imageClassName?: string;
  labelClassName?: string;
  controlsClassName?: string;
}

const DEFAULT_TRANSITION: Transition = { type: "spring", bounce: 0.16, duration: 0.85 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Slides further than this from the active one are faded out, so a looping slide can cross over unseen. */
const VISIBLE_RANGE = 2;

/**
 * Signed slot of slide `index` relative to the active one. Looping, it is the shorter way round the ring, so the
 * active slide always has neighbours on both sides and the ring never rewinds.
 */
const slotOf = (index: number, current: number, count: number, loop: boolean) => {
  const distance = index - current;
  if (!loop) return distance;
  const wrapped = ((distance % count) + count) % count;
  return wrapped > count / 2 ? wrapped - count : wrapped;
};

export function DiagonalCarousel({
  items,
  activeIndex,
  defaultActiveIndex = 0,
  onActiveIndexChange,
  loop = false,
  slideSize = 260,
  slideAspect = "1/1",
  rotationStep = 30,
  verticalStep = 120,
  inactiveScale = 0.6,
  transition = DEFAULT_TRANSITION,
  showControls = true,
  showDots = true,
  wrapSlide,
  viewportClassName,
  trackClassName,
  slideClassName,
  imageClassName,
  labelClassName,
  controlsClassName,
  className,
  onKeyDown,
  tabIndex,
  ...props
}: DiagonalCarouselProps) {
  const maxIndex = Math.max(0, items.length - 1);
  const [uncontrolledIndex, setUncontrolledIndex] = React.useState(() => clamp(defaultActiveIndex, 0, maxIndex));
  const currentIndex = clamp(activeIndex ?? uncontrolledIndex, 0, maxIndex);
  const safeSlideSize = Math.max(120, slideSize);
  const safeInactiveScale = clamp(inactiveScale, 0.35, 1);
  // Horizontal drag offset in px while a pan is under way; null at rest.
  const [drag, setDrag] = React.useState<number | null>(null);
  // The pointer that went down on the stage, its start and its latest sample (for the flick velocity).
  const pointer = React.useRef<{ id: number; x: number; y: number; lastX: number; lastT: number; velocity: number } | null>(null);
  // Set once a pan starts, so the click that ends it doesn't also open or select a slide.
  const panned = React.useRef(false);

  const selectSlide = React.useCallback(
    (nextIndex: number) => {
      if (!items.length) return;
      const resolvedIndex = loop ? (nextIndex + items.length) % items.length : clamp(nextIndex, 0, maxIndex);
      if (activeIndex === undefined) setUncontrolledIndex(resolvedIndex);
      onActiveIndexChange?.(resolvedIndex);
    },
    [activeIndex, items.length, loop, maxIndex, onActiveIndexChange],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectSlide(currentIndex - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectSlide(currentIndex + 1);
    }
  };

  /*
   * Drag to scroll, with plain pointer events (the app's LazyMotion bundle leaves out framer's pan gesture). A press only
   * becomes a pan after a few px of mostly horizontal travel, so taps still click and vertical swipes still scroll.
   */
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    panned.current = false;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastT: event.timeStamp, velocity: 0 };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    const dx = event.clientX - p.x;
    if (!panned.current) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(event.clientY - p.y) > Math.abs(dx)) {
        pointer.current = null;
        return;
      }
      panned.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const dt = event.timeStamp - p.lastT;
    if (dt > 0) p.velocity = ((event.clientX - p.lastX) / dt) * 1000;
    p.lastX = event.clientX;
    p.lastT = event.timeStamp;
    setDrag(dx);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    pointer.current = null;
    if (!panned.current) return;
    const dx = event.clientX - p.x;
    let steps = -Math.round(dx / safeSlideSize);
    if (steps === 0 && Math.abs(p.velocity) > 400) steps = p.velocity < 0 ? 1 : -1;
    setDrag(null);
    if (steps) selectSlide(currentIndex + steps);
  };

  if (!items.length) return null;

  // While dragging, slides follow the pointer by a fraction of a slot; without loop, the ends resist past the last slide.
  const rawShift = (drag ?? 0) / safeSlideSize;
  const shift = loop ? rawShift : clamp(rawShift, currentIndex - maxIndex - 0.35, currentIndex + 0.35);
  const slideTransition: Transition = drag === null ? transition : { duration: 0 };

  const isPreviousDisabled = !loop && currentIndex === 0;
  const isNextDisabled = !loop && currentIndex === maxIndex;
  const control =
    "inline-flex size-9 items-center justify-center rounded-full transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Diagonal image carousel"
      tabIndex={tabIndex ?? 0}
      onKeyDown={handleKeyDown}
      className={cn("relative isolate h-full w-full overflow-hidden", className)}
      {...props}
    >
      <div
        className={cn("absolute inset-0 cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing", viewportClassName)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClickCapture={(event) => {
          if (!panned.current) return;
          event.preventDefault();
          event.stopPropagation();
          panned.current = false;
        }}
      >
        <div className={cn("absolute left-1/2 top-1/2", trackClassName)}>
          {items.map((item, index) => {
            const isActive = currentIndex === index;
            const distance = slotOf(index, currentIndex, items.length, loop) + shift;
            // Looping, a slide wraps from one end of the ring to the other; fading the far ends hides that jump.
            const hidden = loop && Math.abs(distance) > VISIBLE_RANGE;
            const image = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.src}
                alt={item.alt ?? item.title}
                draggable={false}
                loading={Math.abs(distance) > 2 ? "lazy" : undefined}
                className={cn("h-full w-full select-none rounded-2xl object-cover shadow-xl", imageClassName)}
              />
            );
            const frame = "block w-full cursor-pointer";
            const slide =
              isActive && item.href ? (
                <Link href={item.href} aria-label={`Open ${item.title}`} draggable={false} className={frame} style={{ aspectRatio: slideAspect }}>
                  {image}
                </Link>
              ) : (
                <button
                  type="button"
                  aria-label={`Show ${item.title}`}
                  aria-current={isActive ? "true" : undefined}
                  className={frame}
                  style={{ aspectRatio: slideAspect }}
                  onClick={() => selectSlide(index)}
                >
                  {image}
                </button>
              );

            return (
              <m.div
                key={`${item.src}-${index}`}
                inert={hidden}
                className={cn("absolute left-0 top-0 flex -translate-y-1/2 flex-col items-center gap-2 will-change-transform", slideClassName)}
                style={{ width: safeSlideSize, marginLeft: -safeSlideSize / 2, zIndex: Math.round(items.length - Math.abs(distance)) }}
                animate={{
                  x: distance * safeSlideSize,
                  rotate: distance * rotationStep,
                  scale: 1 - Math.min(Math.abs(distance), 1) * (1 - safeInactiveScale),
                  y: distance * verticalStep,
                  opacity: hidden ? 0 : 1,
                }}
                transition={slideTransition}
              >
                <m.p
                  className={cn("whitespace-nowrap text-sm", labelClassName)}
                  animate={{ opacity: isActive ? 1 : 0, scale: isActive ? 1 : 0.7 }}
                  transition={{ duration: 0.3 }}
                >
                  {item.title}
                </m.p>
                {wrapSlide ? <div className="w-full">{wrapSlide(slide, item, index, isActive)}</div> : slide}
              </m.div>
            );
          })}
        </div>
      </div>

      {showControls && (
        <div
          className={cn(
            "absolute inset-x-4 bottom-5 z-10 mx-auto flex w-fit items-center justify-center gap-3 rounded-full border border-line bg-surface/80 px-2 text-ink shadow-sm backdrop-blur-sm",
            controlsClassName,
          )}
        >
          <button type="button" aria-label="Show previous slide" disabled={isPreviousDisabled} className={control} onClick={() => selectSlide(currentIndex - 1)}>
            <ChevronLeft className="size-5" />
          </button>

          {showDots && (
            <div className="flex items-center justify-center gap-2">
              {items.map((item, index) => (
                <button
                  key={`${item.title}-${index}`}
                  type="button"
                  aria-label={`Show slide ${index + 1}: ${item.title}`}
                  aria-current={currentIndex === index ? "true" : undefined}
                  className={cn(
                    "h-2 rounded-full bg-current transition-[width,opacity] duration-300",
                    currentIndex === index ? "w-7 opacity-100" : "w-2 opacity-30",
                  )}
                  onClick={() => selectSlide(index)}
                />
              ))}
            </div>
          )}

          <button type="button" aria-label="Show next slide" disabled={isNextDisabled} className={control} onClick={() => selectSlide(currentIndex + 1)}>
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default DiagonalCarousel;
