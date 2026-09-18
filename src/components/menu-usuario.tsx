"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { salir } from "@/app/(auth)/ingresar/acciones";

export function MenuUsuario({ nombre, carnet }: { nombre: string; carnet: string }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;

    function cerrarAfuera(evento: PointerEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    }

    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAbierto(false);
    }

    document.addEventListener("pointerdown", cerrarAfuera);
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.removeEventListener("pointerdown", cerrarAfuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative shrink-0">
      <button
        type="button"
        aria-label={`Cuenta de ${nombre}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((valor) => !valor)}
        className="-mr-2 inline-flex min-h-10 items-center gap-1 rounded-full px-2 text-[13px] whitespace-nowrap text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-95"
      >
        {nombreCorto(nombre)}
        <ChevronDown
          aria-hidden
          className={`size-3.5 transition-transform duration-150 ${abierto ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>

      {abierto ? (
        <div
          role="menu"
          className="absolute top-[calc(100%+6px)] right-0 z-30 w-44 animate-in rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg duration-150 zoom-in-95 fade-in"
        >
          <Link
            href={`/jugador/${encodeURIComponent(carnet)}` as Route}
            role="menuitem"
            onClick={() => setAbierto(false)}
            className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted active:bg-muted"
          >
            <UserRound aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />
            Mi perfil
          </Link>
          <form action={salir}>
            <button
              type="submit"
              role="menuitem"
              className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition-colors hover:bg-muted active:bg-muted"
            >
              <LogOut aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

/** "Iván Roble Mérida" → "Iván R." */
function nombreCorto(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length < 2) return partes[0] ?? "";
  return `${partes[0]} ${partes[1][0]}.`;
}
