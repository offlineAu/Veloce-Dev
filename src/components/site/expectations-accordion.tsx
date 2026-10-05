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
 * "What you can expect" as a shadcn Accordion. The server render and desktop show every item open; on phones the
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
    <Accordion type="multiple" value={value} onValueChange={setChosen} className="mt-10 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((x) => (
        <AccordionItem key={x.title} value={x.title} className="border-line">
          <AccordionTrigger className="min-h-14 items-center gap-4 py-3 text-left font-heading text-[21px] font-normal leading-tight hover:no-underline">
            <span className="flex items-center gap-4">
              <span aria-hidden className="size-3.5 shrink-0 rounded-full bg-sage" />
              {x.title}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pl-[30px] text-[15.5px] leading-relaxed text-muted">{x.body}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
