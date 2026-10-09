import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui Button, mapped to the brand tokens. Variant names follow shadcn
 * (default, outline, secondary, ghost, link, destructive) plus "dark" (obsidian pill) and "light" for use on dark panels.
 * Sizes keep the 44px+ touch targets used across the site.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow,transform] duration-200 outline-none disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md active:translate-y-0 motion-reduce:hover:translate-y-0",
        dark: "bg-inverse text-on-inverse shadow-sm hover:-translate-y-0.5 hover:bg-inverse/90 hover:shadow-md active:translate-y-0 motion-reduce:hover:translate-y-0",
        destructive: "bg-destructive text-on-danger hover:bg-destructive/90",
        outline: "border border-ink/20 bg-surface/70 text-foreground hover:border-ink/40 hover:bg-surface active:bg-neutral-100",
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
