"use client";
import { useEffect } from "react";
import { track } from "@/lib/analytics/client";
export function AnalyticsLinkChoice({ checked, onChange, form }: { checked: boolean; onChange: (checked: boolean) => void; form: "inquiry" | "introduction" | "meeting_request" | "booking" }) {
  useEffect(() => { track("form_opened", { form }); }, [form]);
  return <label className="flex items-start gap-3 text-sm">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-1 size-5 shrink-0 accent-accent-600" />
    <span>Optionally connect my browsing activity to this request in analytics, using a reference instead of my name or email. This applies only if I allow analytics in <button type="button" className="underline" onClick={() => window.dispatchEvent(new Event("analytics:preferences"))}>analytics preferences</button>.</span>
  </label>;
}
