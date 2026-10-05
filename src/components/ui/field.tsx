import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// shadcn Input/Textarea with the site's pill styling layered on top.
const control =
  "h-auto min-h-12 w-full rounded-full border-2 border-line bg-neutral-100 px-4 text-[15px] text-ink shadow-none placeholder:text-neutral-700 md:text-[15px] aria-[invalid=true]:border-danger";

export interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: (a: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
  className?: string;
}

/** Label + control + hint + error, wired with aria-describedby / aria-invalid. */
export function Field({ id, label, required, hint, error, children, className }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="block text-sm font-semibold leading-snug">
        {label}
        {required ? (
          <>
            <span aria-hidden className="text-accent-700"> *</span>
            <span className="sr-only"> (required)</span>
          </>
        ) : (
          <span className="font-normal text-neutral-700"> (optional)</span>
        )}
      </Label>
      {children({ id, describedBy, invalid: !!error })}
      {hint ? (
        <p id={hintId} className="text-[13px] text-neutral-700">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...p }, ref) {
    return <Input ref={ref} className={cn(control, className)} {...p} />;
  },
);

export const SelectInput = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectInput({ className, ...p }, ref) {
    return <select ref={ref} className={cn(control, className)} {...p} />;
  },
);

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...p }, ref) {
    return (
      <Textarea
        ref={ref}
        className={cn(control, "min-h-24 rounded-[22px] py-3", className)}
        {...p}
      />
    );
  },
);
