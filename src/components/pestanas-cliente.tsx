"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, LayoutDashboard, Swords, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type Pestana = {
  href: Route;
  icono: "tabla" | "partidos" | "panel" | "perfil";
  texto: string;
  bolita?: number;
  raiz: string;
};

const ICONOS = {
  tabla: Table2,
  partidos: Swords,
  panel: LayoutDashboard,
  perfil: CircleUserRound,
};

/**
 * La parte que necesita saber en qué pantalla estás, para marcar la pestaña
 * actual. El prototipo la pinta en verde; el resto queda en gris.
 */
export function PestanasCliente({ pestanas }: { pestanas: Pestana[] }) {
  const ruta = usePathname();
  // La pestaña se marca por la raíz: el detalle de un partido sigue siendo
  // Partidos, y la ficha de un jugador sigue siendo Perfil.
  const actual = pestanas
    .filter((p) => (p.raiz === "/" ? ruta === "/" : ruta.startsWith(p.raiz)))
    .sort((a, b) => b.raiz.length - a.raiz.length)[0];

  return (
    <nav
      aria-label="Secciones"
      className="sticky bottom-0 z-10 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_18px_rgba(19,23,20,0.04)] backdrop-blur-md"
    >
      {pestanas.map((p) => {
        const esta = p === actual;
        const Icono = ICONOS[p.icono];
        return (
          <Link
            key={p.texto}
            href={p.href}
            aria-current={esta ? "page" : undefined}
            className={cn(
              // 12px y no los 11.5 del prototipo: 12 es el piso de legibilidad
              // que revisa la auditoría, y medio pixel no se nota. Bajar el
              // piso para acomodar un componente es al revés de para qué está.
              "relative flex min-h-[54px] flex-1 flex-col items-center justify-center gap-0.5 px-0.5 pt-2 pb-[7px] text-xs font-semibold transition-[color,transform] duration-200 ease-out active:scale-[0.94]",
              esta ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-6 place-items-center rounded-md transition-[background-color,transform] duration-200 ease-out",
                esta && "-translate-y-0.5 bg-uvg-suave",
              )}
            >
              <Icono className="size-[17px]" strokeWidth={esta ? 2.4 : 1.9} />
            </span>
            <span>
              {p.texto}
              {p.bolita ? (
                <span className="ml-1 inline-block min-w-[18px] rounded-full bg-destructive px-[5px] align-[1px] text-[10.5px] leading-[18px] font-bold text-destructive-foreground">
                  {p.bolita}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
