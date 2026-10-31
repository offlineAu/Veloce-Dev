"use client";

import * as React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const QUERY = "(max-width: 767px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * "What happens when you get in touch" as a shadcn Accordion. The server render and desktop show every item open; on phones the
 * items start collapsed (after hydration) so the page stays short. Once the user opens or closes anything, their
 * choice wins.
 */
export function ExpectationsAccordion({ items }: { items: { title: string; body: string }[] }) {
  const isPhone = React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
  const [chosen, setChosen] = React.useState<string[] | null>(null);
  const value = chosen ?? (isPhone ? [] : items.map((i) => i.title));

  return (
    <Accordion type="multiple" value={value} onValueChange={setChosen} className="mt-10 grid gap-x-10 rounded-[28px] border border-line bg-surface px-6 py-4 shadow-sm sm:grid-cols-2 sm:px-10 sm:py-6 lg:grid-cols-3">
      {items.map((x) => (
        <AccordionItem key={x.title} value={x.title} className="border-line/70 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0">
          <AccordionTrigger className="min-h-14 items-center gap-4 py-4 text-left font-heading text-[20px] font-semibold leading-tight tracking-tight hover:no-underline">
            {x.title}
          </AccordionTrigger>
          <AccordionContent className="text-[15px] leading-relaxed text-muted">{x.body}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
