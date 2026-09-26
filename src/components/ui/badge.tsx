import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-[13px] leading-none font-semibold tracking-normal whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-uvg-suave text-primary",
        secondary: "bg-relleno text-muted-foreground",
        outline: "bg-relleno text-muted-foreground",
        // El verde de las zonas (#0b9e51) es para rellenos: como texto da 3.3:1
        // sobre blanco y no llega al mínimo. Para la letra va el verde fuerte.
        premio: "bg-uvg-suave text-primary",
        ascenso: "bg-uvg-suave text-primary",
        descenso: "bg-malo-suave text-destructive",
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
