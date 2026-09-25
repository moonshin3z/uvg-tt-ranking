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
      className="sticky bottom-0 z-10 flex bg-card/90 px-2 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom,0px))] shadow-[0_-1px_0_var(--linea-suave)] backdrop-blur-md backdrop-saturate-150"
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
              "group flex min-h-[52px] flex-1 flex-col items-center justify-center gap-[3px] px-0.5 py-1 text-xs font-semibold transition-colors duration-300 ease-out",
              esta ? "text-primary" : "text-muted-foreground",
            )}
          >
            {/* La sección activa se marca con una píldora detrás del ícono,
                no moviendo el ícono de lugar. */}
            <span
              className={cn(
                "relative grid h-[30px] w-14 place-items-center rounded-full transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-active:scale-90",
                esta && "bg-uvg-suave",
              )}
            >
              <Icono aria-hidden className="size-5" strokeWidth={esta ? 2.2 : 1.9} />
              {p.bolita ? (
                <span className="absolute -top-0.5 right-2 min-w-[18px] rounded-full bg-destructive px-[5px] text-center text-[10.5px] leading-[18px] font-bold text-destructive-foreground ring-2 ring-card">
                  {p.bolita}
                </span>
              ) : null}
            </span>
            <span>{p.texto}</span>
          </Link>
        );
      })}
    </nav>
  );
}
