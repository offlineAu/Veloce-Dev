import { Database, Globe, Rocket, Workflow } from "lucide-react";
import { modernTools } from "@/content/site";

const icons = {
  web: Globe,
  data: Database,
  integrations: Workflow,
  deployment: Rocket,
};

export function ModernTools() {
  return (
    <div
      aria-labelledby="modern-tools-title"
      className="mt-12 rounded-[28px] border border-line bg-neutral-100 p-6 sm:p-8"
    >
      <div className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-700">
          {modernTools.eyebrow}
        </p>
        <h3 id="modern-tools-title" className="mt-3 text-[clamp(24px,2.6vw,32px)] leading-tight text-ink">
          {modernTools.title}
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{modernTools.lead}</p>
      </div>
      <ul aria-label="Tools we build with" className="mt-8 grid grid-cols-1 gap-6 border-t border-line pt-6 sm:grid-cols-2 xl:grid-cols-4">
        {modernTools.items.map((item) => {
          const Icon = icons[item.id];
          return (
            <li key={item.id} className="flex min-w-0 flex-col items-start">
              <span className="grid size-10 place-items-center rounded-xl bg-accent-100 text-accent-700">
                <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
              </span>
              <h4 className="mt-4 text-base leading-snug text-ink">{item.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
              <p className="mt-auto pt-4 text-xs font-medium leading-relaxed text-muted">{item.detail}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
