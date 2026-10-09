"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Icon } from "@/components/ui/icon";
import { CapabilityMock } from "@/components/marketing/mockups";

interface Group {
  id: string;
  label: string;
  items: { icon: string; title: string; body: string }[];
}

/** Accessible tablist (arrow keys, roving tabindex) over config-driven groups, with an illustrative panel. */
export function CapabilityTabs({ groups }: { groups: Group[] }) {
  return (
    <Tabs defaultValue={groups[0]?.id} className="flex flex-col gap-6">
      <TabsList aria-label="Capability groups" className="grid h-auto w-full grid-cols-3 gap-1 rounded-[28px] border border-line bg-surface p-1.5 shadow-sm group-data-[orientation=horizontal]/tabs:h-auto sm:flex sm:w-fit sm:max-w-full sm:flex-wrap sm:justify-start sm:rounded-full">
        {groups.map((g) => (
          <TabsTrigger
            key={g.id}
            value={g.id}
            className="h-auto min-h-11 min-w-0 flex-none whitespace-normal rounded-full border-0 px-2 py-2 text-center text-[13px] leading-tight font-semibold sm:whitespace-nowrap sm:px-5 sm:text-[15px] text-foreground shadow-none transition-colors hover:bg-ink/5 data-[state=active]:bg-inverse data-[state=active]:text-on-inverse data-[state=active]:shadow-none"
          >
            {g.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {groups.map((g) => (
        <TabsContent key={g.id} value={g.id} className="grid gap-4 lg:grid-cols-2">
          <CapabilityMock group={g.id} />
          <div className="grid content-start gap-3.5 sm:grid-cols-2">
            {g.items.map((it) => (
              <div key={it.title} className="animate-rise flex flex-col gap-3 rounded-lg bg-neutral-100 p-6">
                <span className="grid size-11 place-items-center rounded-full bg-accent-100 text-accent-700">
                  <Icon name={it.icon} className="size-5" />
                </span>
                <h3 className="mt-1 text-[19px] leading-tight">{it.title}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{it.body}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
