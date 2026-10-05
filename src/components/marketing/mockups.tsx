import { CreditCard, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Decorative interface illustrations carried over from the original pages.
 * They are abstract examples of what can be built, not screenshots of client work or of this site's features,
 * so they are hidden from assistive tech and captioned where they could be mistaken for the real thing.
 */

const bar = "block rounded-full";

/** Abstract browser window (hero of both pages). */
export function BrowserMock({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex flex-col gap-3.5 rounded-xl bg-surface p-4 shadow-lg", className)}>
      <div className="flex items-center gap-2 px-1.5">
        <span className="size-2.5 rounded-full bg-accent-300" />
        <span className="size-2.5 rounded-full bg-neutral-300" />
        <span className="size-2.5 rounded-full bg-sage-300" />
        <span className="ml-2.5 h-5 flex-1 rounded-full bg-bg" />
      </div>
      <div className="flex flex-col gap-4 rounded-lg bg-bg p-6">
        <div className="flex items-center justify-between">
          <span className={cn(bar, "h-3 w-16 bg-ink")} />
          <span className="flex items-center gap-2">
            <span className={cn(bar, "h-2 w-8 bg-neutral-300")} />
            <span className={cn(bar, "h-2 w-8 bg-neutral-300")} />
            <span className={cn(bar, "h-4 w-12 bg-accent")} />
          </span>
        </div>
        <div className="grid grid-cols-[1.4fr_1fr] items-center gap-4 py-2">
          <div className="flex flex-col gap-2.5">
            <span className={cn(bar, "h-4 w-11/12 bg-ink")} />
            <span className={cn(bar, "h-4 w-2/3 bg-ink")} />
            <span className={cn(bar, "mt-1.5 h-2 w-5/6 bg-neutral-300")} />
            <span className={cn(bar, "h-2 w-3/5 bg-neutral-300")} />
            <span className={cn(bar, "mt-1.5 h-5 w-20 bg-accent")} />
          </div>
          <div className="relative aspect-square rounded-full bg-accent-200">
            <span className="absolute inset-[22%] rounded-full bg-accent-300" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <span className="h-14 rounded-md bg-sage-100" />
          <span className="h-14 rounded-md bg-accent-100" />
          <span className="h-14 rounded-md bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}

/** Sales-page hero visual: browser + code card + phone, as in the original. */
export function HeroComposition() {
  return (
    <div aria-hidden className="relative mx-auto min-h-[420px] w-full max-w-lg">
      <div className="absolute -top-8 right-0 size-72 rounded-full bg-sage-200 sm:-right-10" />
      <BrowserMock className="absolute inset-x-0 right-10 top-0 animate-rise" />
      <div className="absolute -left-3 bottom-0 w-[min(300px,72%)] animate-rise rounded-lg border border-line bg-[#0d0808] px-5 py-4 font-mono text-[12.5px] leading-[1.75] text-[#f3eae6] shadow-lg">
        <div>
          <span className="text-[#b5baff]">export</span> <span className="text-[#aee2ff]">function</span> Booking() {"{"}
        </div>
        <div className="pl-4">
          <span className="text-[#b5baff]">const</span> slots = useAvailability(
        </div>
        <div className="pl-8 text-[#bdb1ab]">yourBusinessRules</div>
        <div className="pl-4">);</div>
        <div className="pl-4">
          <span className="text-[#b5baff]">return</span> &lt;Calendar slots={"{slots}"} /&gt;
          <span className="ml-1 inline-block h-3.5 w-[7px] translate-y-0.5 animate-pulse bg-accent motion-reduce:animate-none" />
        </div>
        <div>{"}"}</div>
      </div>
      <div className="absolute bottom-6 right-0 w-32 animate-rise rounded-lg bg-surface p-2 shadow-lg">
        <div className="flex min-h-[200px] flex-col gap-2 rounded-md bg-bg px-2.5 py-3">
          <span className={cn(bar, "h-1.5 w-8 self-center bg-neutral-300")} />
          <span className={cn(bar, "mt-1.5 h-2 w-[90%] bg-ink")} />
          <span className={cn(bar, "h-2 w-[70%] bg-ink")} />
          <span className="mt-1 h-16 rounded-md bg-accent-200" />
          <span className={cn(bar, "h-1 w-4/5 bg-neutral-300")} />
          <span className={cn(bar, "mt-auto h-5 bg-accent")} />
        </div>
      </div>
    </div>
  );
}

function BookingMock() {
  const days = Array.from({ length: 21 }, (_, i) => i + 8);
  return (
    <div className="flex w-full max-w-[380px] flex-col gap-4 rounded-lg bg-bg p-5 shadow-md">
      <div className="flex items-center justify-between">
        <span className="font-heading text-lg">Book a time</span>
        <span className={cn(bar, "h-2 w-[60px] bg-neutral-300")} />
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((n) => (
          <span
            key={n}
            className={cn(
              "grid aspect-square place-items-center rounded-full text-xs font-semibold",
              n === 18 ? "bg-accent text-on-accent" : n === 17 ? "bg-accent-100" : "bg-neutral-100",
            )}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {["9:00", "10:30", "13:00", "15:30"].map((t) => (
          <span key={t} className={cn("rounded-full px-3.5 py-1.5 text-[13px]", t === "10:30" ? "bg-sage-700 font-semibold text-on-sage" : "bg-neutral-200")}>
            {t}
          </span>
        ))}
      </div>
      <span className="grid h-10 place-items-center rounded-full bg-accent-600 text-sm font-semibold text-on-accent">Confirm booking</span>
    </div>
  );
}

function DashboardMock() {
  const bars = [40, 62, 48, 75, 58, 88, 70, 94, 80];
  return (
    <div className="grid w-full max-w-[420px] grid-cols-[70px_1fr] gap-4 rounded-lg bg-bg p-5 shadow-md">
      <div className="flex flex-col gap-2.5 pt-1">
        <span className="size-7 rounded-full bg-accent" />
        <span className={cn(bar, "mt-3 h-2 bg-ink")} />
        <span className={cn(bar, "h-2 bg-neutral-300")} />
        <span className={cn(bar, "h-2 bg-neutral-300")} />
        <span className={cn(bar, "h-2 bg-neutral-300")} />
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-2 rounded-md bg-accent-100 p-3">
            <span className={cn(bar, "h-1.5 w-1/2 bg-accent-300")} />
            <span className={cn(bar, "h-3.5 w-[70%] bg-accent-700")} />
          </div>
          <div className="flex flex-col gap-2 rounded-md bg-sage-100 p-3">
            <span className={cn(bar, "h-1.5 w-1/2 bg-sage-300")} />
            <span className={cn(bar, "h-3.5 w-[60%] bg-sage-700")} />
          </div>
        </div>
        <div className="flex h-32 items-end gap-2 rounded-md bg-neutral-100 p-3.5">
          {bars.map((h, i) => (
            <span key={i} className={cn("flex-1 rounded-full", i === 7 ? "bg-accent" : i % 2 ? "bg-sage-300" : "bg-sage-200")} style={{ height: `${h}%` }} />
          ))}
        </div>
        <span className={cn(bar, "h-5 bg-neutral-100")} />
        <span className={cn(bar, "h-5 bg-neutral-100")} />
      </div>
    </div>
  );
}

function CheckoutMock() {
  return (
    <div className="flex w-full max-w-[380px] flex-col gap-3.5 rounded-lg bg-bg p-5 shadow-md">
      <span className="font-heading text-lg">Checkout</span>
      {[
        ["bg-accent-200", "w-[70%]", "w-2/5"],
        ["bg-sage-200", "w-[55%]", "w-[35%]"],
      ].map(([tile, a, b], i) => (
        <div key={i} className="flex items-center gap-3">
          <span className={cn("size-12 rounded-md", tile)} />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className={cn(bar, "h-2 bg-ink", a)} />
            <span className={cn(bar, "h-1.5 bg-neutral-300", b)} />
          </span>
          <span className={cn(bar, "h-2 w-10 bg-neutral-300")} />
        </div>
      ))}
      <div className="flex items-center gap-2.5 rounded-full bg-neutral-100 px-3.5 py-3">
        <CreditCard aria-hidden className="size-[18px] text-sage-700" strokeWidth={2.5} />
        <span className={cn(bar, "h-2 flex-1 bg-neutral-300")} />
      </div>
      <div className="flex items-center justify-between px-0.5">
        <span className="text-sm font-semibold">Total</span>
        <span className={cn(bar, "h-3 w-16 bg-ink")} />
      </div>
      <span className="grid h-10 place-items-center rounded-full bg-accent-600 text-sm font-semibold text-on-accent">Pay securely</span>
    </div>
  );
}

/** Illustrative panel shown beside each capability group. */
export function CapabilityMock({ group }: { group: string }) {
  return (
    <figure className="flex h-full flex-col gap-3">
      <div aria-hidden className="grid min-h-[360px] flex-1 place-items-center rounded-xl bg-surface p-5 sm:p-8">
        {group === "operations" ? <DashboardMock /> : group === "commerce" ? <CheckoutMock /> : <BookingMock />}
      </div>
      <figcaption className="flex items-center gap-2 px-2 text-[13px] text-muted">
        <Info aria-hidden className="size-3.5 shrink-0" strokeWidth={2.5} /> Illustrative example of an interface we could build, not a live feature of this site.
      </figcaption>
    </figure>
  );
}
