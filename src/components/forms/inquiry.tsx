"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Dialog, useOpenerFocus } from "@/components/ui/dialog";
import { Button, type ButtonProps } from "@/components/ui/button";

// The form pulls in react-hook-form and zod, so it loads on demand instead of with the page.
const loadDialog = () => import("./inquiry-dialog");
const InquiryDialog = dynamic(loadDialog);

export type Intent = "CONVERSATION" | "CONSULTATION";

/** A page designed in the /build editor, sent along with the inquiry. */
export interface SiteDraftPayload {
  templateId?: string;
  websiteType?: string;
  /** The whole site: its pages, each with the sections the visitor placed. */
  data: { pages: { data: { content: unknown[] } }[] };
}

/** The service card an inquiry was opened from. */
export interface InquiryService {
  slug: string;
  title: string;
}

interface Ctx {
  open: (intent?: Intent, service?: InquiryService) => void;
}
const InquiryCtx = createContext<Ctx | null>(null);

export interface InquiryProviderProps {
  children: ReactNode;
  companyName: string;
  contactEmail: string;
  /** Public token of a verified referral campaign, if the visitor arrived through one. */
  refToken?: string;
  /** Referrer shown to the visitor (only when the campaign allows it). */
  introducedBy?: string | null;
  /** In the site builder: reads the current design at submit time so it is attached to the inquiry. */
  getSiteDraft?: () => SiteDraftPayload;
}

export function InquiryProvider({ children, companyName, contactEmail, refToken, introducedBy, getSiteDraft }: InquiryProviderProps) {
  const [isOpen, setOpen] = useState(false);
  const [intent, setIntent] = useState<Intent>("CONVERSATION");
  const focus = useOpenerFocus();
  const { remember } = focus;
  const [service, setService] = useState<InquiryService | undefined>();
  const [wanted, setWanted] = useState(false); // mount the dialog only once it has been asked for
  // Fetch the form once the browser is idle, unless this device is short on memory or bandwidth (then only on intent).
  useEffect(() => {
    if (document.documentElement.dataset.perf === "lite") return;
    const id = window.setTimeout(() => void loadDialog(), 4000);
    return () => window.clearTimeout(id);
  }, []);
  const ctx = useMemo<Ctx>(() => ({ open: (i = "CONVERSATION", svc) => { remember(); setIntent(i); setService(svc); setWanted(true); setOpen(true); } }), [remember]);
  return (
    <InquiryCtx.Provider value={ctx}>
      {children}
      <Dialog open={isOpen} onOpenChange={setOpen}>
        {wanted ? <InquiryDialog
          companyName={companyName}
          contactEmail={contactEmail}
          refToken={refToken}
          introducedBy={introducedBy}
          getSiteDraft={getSiteDraft}
          intent={intent}
          service={service}
          onCloseAutoFocus={focus.onCloseAutoFocus}
          onClose={() => setOpen(false)}
        /> : null}
      </Dialog>
    </InquiryCtx.Provider>
  );
}

/** Button that opens the inquiry dialog from anywhere under InquiryProvider. */
export function OpenInquiryButton({ intent = "CONVERSATION", service, onClick, ...props }: ButtonProps & { intent?: Intent; service?: InquiryService }) {
  const ctx = useContext(InquiryCtx);
  if (!ctx) throw new Error("OpenInquiryButton must be used inside InquiryProvider");
  return (
    <Button
      {...props}
      onClick={(e) => {
        onClick?.(e);
        ctx.open(intent, service);
      }}
    />
  );
}
