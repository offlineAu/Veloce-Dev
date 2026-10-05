"use client";

import { useRef, useState } from "react";
import { Check, Copy, Link2, Mail, MessageCircle, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_SHARE_TEXT, copyText, mailtoHref, whatsappHref } from "@/lib/share";

type Status = { kind: "ok" | "error"; message: string } | null;

/** Editable referral message with copy, email, WhatsApp and copy-link actions. */
export function ShareActions({
  initialMessage,
  link,
  emailSubject,
}: {
  initialMessage: string;
  link: string;
  emailSubject: string;
}) {
  const [message, setMessage] = useState(initialMessage);
  const [status, setStatus] = useState<Status>(null);
  const [copied, setCopied] = useState<"message" | "link" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function run(kind: "message" | "link", text: string) {
    const ok = await copyText(text);
    clearTimeout(timer.current);
    setStatus(
      ok
        ? { kind: "ok", message: kind === "message" ? "Message copied to clipboard." : "Link copied to clipboard." }
        : { kind: "error", message: "Couldn't copy automatically. Select the text and copy it manually." },
    );
    setCopied(ok ? kind : null);
    timer.current = setTimeout(() => {
      setCopied(null);
      setStatus(null);
    }, 3000);
  }

  const tooLong = message.length > MAX_SHARE_TEXT;
  const pill = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <div className="flex flex-col gap-5 rounded-xl bg-surface p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="share-message" className="flex items-center gap-2.5 text-sm font-semibold">
          <span aria-hidden className="size-2.5 rounded-full bg-sage" />
          Referral message <span className="font-normal text-muted">(edit it if you like)</span>
        </label>
        <Button onClick={() => run("message", message)} className="min-w-40">
          {copied === "message" ? <Check aria-hidden className="size-[17px]" strokeWidth={2.75} /> : <Copy aria-hidden className="size-[17px]" strokeWidth={2.5} />}
          {copied === "message" ? "Copied" : "Copy message"}
        </Button>
      </div>
      <textarea
        id="share-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={9}
        className="w-full rounded-lg border-2 border-line bg-bg p-5 text-base leading-relaxed"
        aria-describedby="share-help"
      />
      <p id="share-help" className="text-[13px] text-neutral-700">
        The message includes your personal link. Anyone who opens it is linked to your introduction.
        {tooLong ? ` Email and WhatsApp will send only the first ${MAX_SHARE_TEXT} characters.` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <a className={pill} href={mailtoHref(emailSubject, message)}>
          <Mail aria-hidden className="size-[17px]" strokeWidth={2.5} /> Email
        </a>
        <a className={pill} href={whatsappHref(message)} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden className="size-[17px]" strokeWidth={2.5} /> WhatsApp
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <Button variant="outline" size="sm" onClick={() => run("link", link)}>
          {copied === "link" ? <Check aria-hidden className="size-[17px]" strokeWidth={2.75} /> : <Link2 aria-hidden className="size-[17px]" strokeWidth={2.5} />}
          {copied === "link" ? "Link copied" : "Copy link"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setMessage(initialMessage)} disabled={message === initialMessage}>
          <RotateCcw aria-hidden className="size-4" strokeWidth={2.5} /> Reset
        </Button>
      </div>
      <p role="status" aria-live="polite" className={cn("min-h-6 text-sm font-medium", status?.kind === "error" ? "text-danger" : "text-sage-700")}>
        {status?.message}
      </p>
    </div>
  );
}
