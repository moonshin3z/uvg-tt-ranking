import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        // text-base en móvil evita el zoom automático de iOS al enfocar (<16px lo dispara)
        "flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs transition-colors",
        "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/30",
        className,
      )}
      {...props}
    />
  );
}
