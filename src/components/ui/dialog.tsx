"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/* shadcn/ui Dialog primitives, mapped to the brand tokens. */

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return <DialogPrimitive.Overlay data-slot="dialog-overlay" className={cn("fixed inset-0 z-50 bg-[#0b0612]/60", className)} {...props} />;
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "animate-rise fixed left-1/2 top-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-background p-6 shadow-lg outline-none sm:max-w-lg",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            aria-label="Close"
            className="absolute right-3 top-3 grid size-11 place-items-center rounded-full hover:bg-ink/5"
          >
            <X aria-hidden className="size-5" strokeWidth={2.5} />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("font-heading text-[26px] leading-tight sm:text-3xl", className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-[15px] leading-relaxed text-muted-foreground", className)} {...props} />;
}

/** Radix only restores focus to a Dialog.Trigger; our openers are arbitrary buttons, so remember and restore it here. */
function useOpenerFocus() {
  const opener = React.useRef<HTMLElement | null>(null);
  return {
    remember: () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    onCloseAutoFocus: (e: Event) => {
      e.preventDefault();
      opener.current?.focus();
    },
  };
}

/** Scrollable modal (long forms) built from the primitives above: focus trap, Esc to close, page scroll lock via Radix; the content scrolls inside itself. */
function ModalContent({
  title,
  description,
  children,
  className,
  onCloseAutoFocus,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onCloseAutoFocus?: (e: Event) => void;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      {/* The content is itself the scroll container (not a wrapper around it): Radix locks page scroll and only lets
          wheel/touch scrolling through inside the content element, so a scrolling wrapper outside it cannot scroll. */}
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn("animate-rise fixed inset-0 z-50 m-auto h-fit max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[660px] modal-scroll overflow-y-auto overscroll-contain rounded-xl bg-background p-6 shadow-lg outline-none sm:max-h-[calc(100dvh-4rem)] sm:p-10", className)}
          onCloseAutoFocus={onCloseAutoFocus}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <DialogHeader className="pr-10">
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <DialogClose aria-label="Close" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full hover:bg-ink/5 sm:right-8 sm:top-8">
            <X aria-hidden className="size-5" strokeWidth={2.5} />
          </DialogClose>
          <div className="mt-6">{children}</div>
        </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  ModalContent,
  useOpenerFocus,
};
