import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui Button, mapped to the brand tokens. Variant names follow shadcn
 * (default, outline, secondary, ghost, link, destructive) plus "light" for use on dark panels.
 * Sizes keep the 44px+ touch targets used across the site.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors outline-none disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-accent-hover active:bg-accent-800",
        destructive: "bg-destructive text-on-danger hover:bg-destructive/90",
        outline: "border-2 border-ink/25 bg-transparent text-foreground hover:bg-ink/5 active:bg-ink/10",
        secondary: "bg-secondary text-secondary-foreground hover:bg-neutral-300",
        ghost: "text-foreground hover:bg-ink/5 active:bg-ink/10",
        link: "text-accent-700 underline-offset-4 hover:underline",
        light: "bg-background text-foreground hover:bg-neutral-100 active:bg-neutral-200",
      },
      size: {
        default: "min-h-12 px-6 text-base",
        sm: "min-h-11 px-5 text-[15px]",
        lg: "min-h-14 px-8 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

type ButtonProps = React.ComponentProps<typeof Button>;

export { Button, buttonVariants, type ButtonProps };
