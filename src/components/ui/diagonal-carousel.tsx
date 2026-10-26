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
  /** Positions the row of slides inside the viewport (default: 30% from the top). */
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

  if (!items.length) return null;

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
      <div className={cn("absolute inset-0 overflow-hidden", viewportClassName)}>
        <div className={cn("absolute left-1/2 top-[30%]", trackClassName)}>
          {items.map((item, index) => {
            const isActive = currentIndex === index;
            const distance = slotOf(index, currentIndex, items.length, loop);
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
                <Link href={item.href} aria-label={`Open ${item.title}`} className={frame} style={{ aspectRatio: slideAspect }}>
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
                className={cn("absolute left-0 top-0 flex flex-col items-center gap-2 will-change-transform", slideClassName)}
                style={{ width: safeSlideSize, marginLeft: -safeSlideSize / 2, zIndex: items.length - Math.abs(distance) }}
                animate={{
                  x: distance * safeSlideSize,
                  rotate: distance * rotationStep,
                  scale: isActive ? 1 : safeInactiveScale,
                  y: distance * verticalStep,
                  opacity: hidden ? 0 : 1,
                }}
                transition={transition}
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
