"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** shadcn/ui Sonner toaster, themed with the brand tokens (single light theme, so no next-themes). */
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="bottom-center"
    className="toaster group"
    style={
      {
        "--normal-bg": "var(--color-neutral-100)",
        "--normal-text": "var(--color-ink)",
        "--normal-border": "var(--color-line)",
        "--border-radius": "16px",
      } as React.CSSProperties
    }
    {...props}
  />
);

export { Toaster };
