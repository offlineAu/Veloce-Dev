"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMeeting } from "@/components/booking/meeting-provider";

const ApproachWorkbench = dynamic(() => import("./approach-workbench").then(module => module.ApproachWorkbench), {
  loading: () => <p role="status" className="py-8 text-sm text-muted">Opening the example…</p>,
});

/**
 * The meeting panel lives in the workbench, so opening a meeting also reveals it, and closing the meeting puts the
 * disclosure back the way the visitor left it. The element owns its `open` state (React never sets it): a visitor can
 * open it before the page hydrates, and a controlled `open` would be reset to closed by hydration, losing that click.
 */
export function WorkbenchDisclosure() {
  const meeting = useMeeting();
  const ref = useRef<HTMLDetailsElement>(null);
  const visitorOpen = useRef(false);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (ref.current?.open) { visitorOpen.current = true; setOpened(true); }
  }, []);
  useEffect(() => {
    if (ref.current) ref.current.open = meeting.open || visitorOpen.current;
  }, [meeting.open]);
  return <details ref={ref} onToggle={(event) => {
    const next = event.currentTarget.open;
    if (!meeting.open) visitorOpen.current = next;
    if (next) setOpened(true);
  }} className="mt-10 border-t border-line pt-5">
    <summary className="min-h-11 cursor-pointer text-base font-semibold text-accent-700">Try an example workflow</summary>
    {opened || meeting.started ? <ApproachWorkbench /> : null}
  </details>;
}
