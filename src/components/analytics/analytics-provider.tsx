"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PRIVACY_NOTICE_VERSION } from "@/lib/legal";
import { ANALYTICS_CHOICE_KEY, normalizedPage } from "@/lib/analytics/shared";
import { analyticsRequest, clearTrackingStorage, readChoice, readStorage, rememberAttribution, setAnalyticsActive, storeChoice, startAnalyticsSdk, track } from "@/lib/analytics/client";

const PENDING_WITHDRAWAL = "veloce.analytics.withdrawal.pending";
export function AnalyticsProvider({ enabled, projectKey }: { enabled: boolean; projectKey?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState<"allow" | "decline">();
  const [pendingChoice, setPendingChoice] = useState<"allow" | "decline">();
  const lastPage = useRef<string | null>(null);
  const currentView = useRef<{ page: string; id: string; started: number } | null>(null);
  const startedForms = useRef(new WeakSet<Element>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const preferences = () => { setChoice(readChoice()); setOpen(true); };
    window.addEventListener("analytics:preferences", preferences);
    const sync = async () => {
      setAnalyticsActive(false); setReady(false); lastPage.current = null;
      if (readStorage(PENDING_WITHDRAWAL)) {
        try { await analyticsRequest({ action: "withdraw" }); localStorage.removeItem(PENDING_WITHDRAWAL); }
        catch { if (mounted.current) { setOpen(true); setError("Analytics has stopped in this browser. Reconnect and choose Decline again to stop pending server tracking."); } return; }
      }
      if (!enabled) return;
      const choice = readChoice();
      setChoice(choice);
      if (choice === "decline") return;
      if (choice === "allow") {
        try {
          await analyticsRequest({ action: "status" });
          if (projectKey) await startAnalyticsSdk(projectKey);
          if (mounted.current && readChoice() === "allow") { setAnalyticsActive(true); setReady(true); }
          return;
        } catch { /* Consent expired, revoked, or service unavailable. */ }
      }
      if (mounted.current) setOpen(true);
    };
    const storage = (event: StorageEvent) => { if (event.key === ANALYTICS_CHOICE_KEY) void sync(); };
    window.addEventListener("storage", storage);
    window.addEventListener("online", sync);
    void sync();
    return () => { mounted.current = false; setAnalyticsActive(false); window.removeEventListener("analytics:preferences", preferences); window.removeEventListener("storage", storage); window.removeEventListener("online", sync); };
  }, [enabled, projectKey]);
  useEffect(() => {
    const leave = () => {
      const view = currentView.current;
      if (!view) return;
      currentView.current = null;
      track("$pageleave", { page: view.page, pageviewId: view.id, duration: Math.min(86400, (Date.now() - view.started) / 1000) });
    };
    if (!ready || !enabled || !pathname || !normalizedPage(pathname)) { currentView.current = null; lastPage.current = null; return; }
    if (lastPage.current !== pathname) {
      lastPage.current = pathname;
      rememberAttribution();
      const view = { page: normalizedPage(pathname)!, id: crypto.randomUUID(), started: Date.now() };
      currentView.current = view;
      track("$pageview", { pageviewId: view.id });
    }
    window.addEventListener("pagehide", leave);
    return () => {
      leave();
      window.removeEventListener("pagehide", leave);
    };
  }, [pathname, ready, enabled]);
  useEffect(() => {
    const input = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const form = target.closest<HTMLElement>("form[data-analytics-form], [data-analytics-booking-start]");
      if (!form || startedForms.current.has(form)) return;
      const type = form.hasAttribute("data-analytics-booking-start") ? "booking" : form.dataset.analyticsForm;
      if (!["inquiry", "introduction", "meeting_request", "booking"].includes(type ?? "")) return;
      startedForms.current.add(form);
      track("form_started", { form: type as "inquiry" | "introduction" | "meeting_request" | "booking" });
    };
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-analytics-placement]") : null;
      if (!target) return;
      const placement = target.dataset.analyticsPlacement;
      if (["service", "builder", "footer"].includes(placement ?? "")) track("cta_clicked", { placement: placement as "service" | "builder" | "footer" });
    };
    document.addEventListener("input", input); document.addEventListener("click", click);
    return () => { document.removeEventListener("input", input); document.removeEventListener("click", click); };
  }, []);
  async function choose(allow: boolean) {
    if (busy) return;
    setPendingChoice(allow ? "allow" : "decline");
    setBusy(true); setError("");
    if (allow && readChoice() !== "allow") clearTrackingStorage();
    if (!allow) {
      setAnalyticsActive(false); setReady(false); clearTrackingStorage(); storeChoice("decline");
      try { localStorage.setItem(PENDING_WITHDRAWAL, "true"); } catch { /* request still attempted */ }
    }
    try {
      await analyticsRequest(allow ? { action: "allow", noticeVersion: PRIVACY_NOTICE_VERSION } : { action: "withdraw" });
      try { localStorage.removeItem(PENDING_WITHDRAWAL); } catch { /* optional */ }
      storeChoice(allow ? "allow" : "decline");
      if (allow && enabled && projectKey) await startAnalyticsSdk(projectKey);
      setAnalyticsActive(allow && enabled); lastPage.current = null;
      setReady(allow && enabled); setChoice(allow ? "allow" : "decline"); setOpen(false);
      toast.success(allow ? "Analytics allowed" : "Analytics declined", { description: "Your preference has been saved." });
    } catch { setError(allow ? "Analytics is unavailable. You can continue using the site or try again." : "Tracking has stopped in this browser. Choose Decline again when connected to stop pending server tracking."); }
    finally { setBusy(false); setPendingChoice(undefined); }
  }
  if (!open || !pathname || !normalizedPage(pathname)) return null;
  return <section aria-label="Analytics preferences" aria-busy={busy} className="fixed bottom-5 left-5 right-5 z-[100] max-w-lg rounded-2xl border border-line bg-background p-5 text-ink shadow-xl" data-analytics-consent>
    <h2 className="font-heading text-lg font-semibold">Optional analytics</h2>
    <p className="mt-2 text-sm">Allow us to measure pages, visits and sales actions with PostHog. Forms and bookings work either way. Connecting browsing to a submitted request requires a separate choice on the form. <a href="/privacy" className="underline">Privacy notice</a></p>
    <div className="mt-4 flex flex-wrap gap-3">
      <Button size="sm" variant="outline" disabled={busy} aria-pressed={choice === "decline"} onClick={() => void choose(false)} className="active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 aria-pressed:border-accent-600 aria-pressed:bg-accent-100 aria-pressed:text-accent-900">
        {pendingChoice === "decline" ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : choice === "decline" ? <Check className="size-4" aria-hidden /> : null}
        {pendingChoice === "decline" ? "Saving…" : "Decline"}
      </Button>
      {enabled ? <Button size="sm" variant="outline" disabled={busy} aria-pressed={choice === "allow"} onClick={() => void choose(true)} className="active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 aria-pressed:border-accent-600 aria-pressed:bg-accent-100 aria-pressed:text-accent-900">
        {pendingChoice === "allow" ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : choice === "allow" ? <Check className="size-4" aria-hidden /> : null}
        {pendingChoice === "allow" ? "Saving…" : "Allow analytics"}
      </Button> : null}
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)} className="active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2">Close</Button>
    </div>
    <p role="status" className="mt-3 text-sm text-muted">{busy ? "Saving your analytics preference…" : choice ? `Current preference: ${choice === "allow" ? "Analytics allowed" : "Analytics declined"}.` : "No analytics preference saved yet."}</p>
    {!enabled ? <p className="mt-2 text-sm">Analytics collection is disabled.</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm">{error}</p> : null}
  </section>;
}

export function AnalyticsPreferences() {
  return <button type="button" className="min-h-11 cursor-pointer rounded-md px-2 text-left transition-colors hover:bg-on-inverse/10 hover:text-on-inverse active:bg-on-inverse/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" onClick={() => window.dispatchEvent(new Event("analytics:preferences"))}>Analytics preferences</button>;
}
