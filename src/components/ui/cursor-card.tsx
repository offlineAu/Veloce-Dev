"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

/*
 * VengeanceUI Cursor Card, adapted: a block wrapper (not an inline link) whose hover shows a small preview card that
 * follows the pointer. Uses `m` because the app runs LazyMotion in strict mode. Pointer-only: on touch screens the card
 * never shows, so whatever it describes must also be visible elsewhere.
 */
export interface CursorCardProps {
  children: React.ReactNode;
  image: string;
  imageAlt?: string;
  title?: string;
  description: string;
  /** Card width in px; the card is centred under the pointer. */
  width?: number;
  className?: string;
}

const SPRING = { damping: 25, stiffness: 300 };

export function CursorCard({ children, image, imageAlt = "", title, description, width = 240, className }: CursorCardProps) {
  const [hovered, setHovered] = React.useState(false);
  const [canHover, setCanHover] = React.useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, SPRING);
  const springY = useSpring(y, SPRING);

  React.useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setCanHover(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const card = React.useRef<HTMLDivElement>(null);

  const place = (e: React.PointerEvent) => {
    // Keep the card on screen: clamp it to the sides, and open it above the pointer when there's no room below.
    const left = Math.min(e.clientX - width / 2, window.innerWidth - width - 8);
    x.set(Math.max(8, left));
    const height = card.current?.offsetHeight ?? width * 1.75;
    const below = e.clientY + 20;
    y.set(below + height > window.innerHeight - 8 ? Math.max(8, e.clientY - 20 - height) : below);
  };

  const enter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    // Start at the pointer instead of springing in from the corner.
    place(e);
    springX.jump(x.get());
    springY.jump(y.get());
    setHovered(true);
  };

  return (
    <>
      <div className={cn("block", className)} onPointerEnter={enter} onPointerLeave={() => setHovered(false)} onPointerMove={place}>
        {children}
      </div>

      {canHover &&
        createPortal(
          <AnimatePresence>
            {hovered && (
              <m.div
                ref={card}
                aria-hidden
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{ x: springX, y: springY, width }}
                className="pointer-events-none fixed left-0 top-0 z-50 rounded-xl border border-line bg-surface p-3 shadow-xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={imageAlt} loading="lazy" className="mb-3 aspect-[3/4] w-full rounded-md object-cover object-top" />
                {title ? <p className="m-0 mb-1 text-sm font-semibold text-ink">{title}</p> : null}
                <p className="m-0 text-[13px] leading-relaxed text-muted">{description}</p>
              </m.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

export default CursorCard;
