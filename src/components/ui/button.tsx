import * as React from "react";
import { Root as SlotRoot } from "radix-ui/slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Los botones de iOS: píldoras. El lleno en verde es la acción principal; el
 * gris con letra verde, la secundaria; el rojo lavado, la que borra algo.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-[opacity,transform,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        accent: "bg-primary text-primary-foreground",
        destructive: "bg-malo-suave text-destructive",
        outline: "bg-relleno text-primary",
        secondary: "bg-relleno text-primary",
        ghost: "font-normal text-primary hover:bg-relleno",
        link: "font-normal text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-5 text-[17px]",
        // 40px: el mínimo que la auditoría de responsive exige
        sm: "min-h-10 px-3.5 text-[15px]",
        lg: "min-h-[50px] px-[22px] text-[17px]",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? SlotRoot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
