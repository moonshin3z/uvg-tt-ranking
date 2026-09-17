import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        // El verde de las zonas (#0b9e51) es para rellenos: como texto da 3.3:1
        // sobre blanco y no llega al mínimo. Para la letra va el verde fuerte.
        premio: "border-transparent bg-zona-premio/15 text-primary",
        ascenso: "border-transparent bg-zona-ascenso/15 text-primary",
        descenso: "border-transparent bg-zona-descenso/15 text-zona-descenso",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
