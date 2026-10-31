"use client";
import { useEffect, useState, type ReactNode } from "react";
import { OpenMeetingButton, useMeeting } from "@/components/booking/meeting-provider";

/** One mobile action, hidden when the hero or contact actions are already visible. */
export function StickyMeeting({ label }: { label: string }) {
  const meeting = useMeeting();
  if (meeting.open) return null;
  return <StickyAction><OpenMeetingButton entryPoint="contact" className="w-full">{label}</OpenMeetingButton></StickyAction>;
}

export function StickyAction({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => {
      const targets = [...document.querySelectorAll("[data-hero-cta], [data-contact-cta]")];
      const onScreen = targets.some((target) => { const r = target.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; });
      setVisible(window.scrollY > 400 && !onScreen);
    };
    update(); window.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  if (!visible) return null;
  return <div data-sticky-action className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden">{children}</div>;
}
