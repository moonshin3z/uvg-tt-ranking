import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        // text-base en móvil evita el zoom automático de iOS al enfocar (<16px lo dispara)
        // El campo gris lleno de iOS: se ve igual sobre el fondo y dentro de
        // un bloque blanco.
        "flex min-h-11 w-full rounded-[10px] border-0 bg-relleno px-3.5 py-2 text-[17px] transition-[background-color,box-shadow] duration-150 ease-out",
        "placeholder:text-terciario focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}
