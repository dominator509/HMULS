import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium tracking-wide transition-[background-color,color,border-color,transform,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 active:scale-[0.98]",
  {
    variants: {
      variant: {
        blood: "bg-blood text-fg hover:bg-blood-deep",
        gold: "bg-gold text-bg hover:bg-gold-soft",
        outline: "border border-border bg-transparent text-fg hover:border-gold/50 hover:text-gold",
        ghost: "bg-transparent text-muted hover:text-fg hover:bg-raised",
        surface: "bg-raised text-fg border border-border hover:border-gold/35",
      },
      size: {
        sm: "h-10 min-h-10 px-3 text-xs",
        md: "h-11 min-h-11 px-5 text-sm",
        lg: "h-12 min-h-11 px-6 text-sm",
        xl: "h-12 min-h-12 w-full px-6 text-sm sm:h-14 sm:text-base",
      },
    },
    defaultVariants: { variant: "blood", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
