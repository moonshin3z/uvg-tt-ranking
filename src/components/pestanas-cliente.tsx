"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type Pestana = {
  href: Route;
  icono: "tabla" | "partidos" | "panel" | "perfil";
  texto: string;
  bolita?: number;
  raiz: string;
};

/** Los íconos rellenos de la barra, los del prototipo de iOS. */
const ICONOS: Record<Pestana["icono"], React.ReactNode> = {
  tabla: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="12.5" width="5.2" height="8.5" rx="1.7" />
      <rect x="9.4" y="3.5" width="5.2" height="17.5" rx="1.7" />
      <rect x="15.8" y="8.5" width="5.2" height="12.5" rx="1.7" />
    </svg>
  ),
  partidos: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="14.2" cy="9.3" r="6.3" />
      <path d="M9.3 14.7 5 19" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="19.4" cy="18.8" r="2.1" />
    </svg>
  ),
  panel: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2.2" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="2.2" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="2.2" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="2.2" />
    </svg>
  ),
  perfil: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="9.6" r="3.4" fill="#fff" />
      <path d="M5.8 18.2c1.3-2.4 3.5-3.7 6.2-3.7s4.9 1.3 6.2 3.7A8 8 0 0 1 12 20.5a8 8 0 0 1-6.2-2.3z" fill="#fff" />
    </svg>
  ),
};

/**
 * La barra de pestañas flotante, de cristal, del prototipo de iOS.
 *
 * La pestaña actual la marca una píldora gris que se desliza de una a otra:
 * la barra vive en el layout y no se vuelve a montar al navegar, así que al
 * cambiar de pestaña la transición corre sola.
 */
export function PestanasCliente({ pestanas }: { pestanas: Pestana[] }) {
  const ruta = usePathname();
  // La pestaña se marca por la raíz: el detalle de un partido sigue siendo
  // Partidos, y la ficha de un jugador sigue siendo Perfil.
  const actual = pestanas
    .filter((p) => (p.raiz === "/" ? ruta === "/" : ruta.startsWith(p.raiz)))
    .sort((a, b) => b.raiz.length - a.raiz.length)[0];
  const i = actual ? pestanas.indexOf(actual) : -1;

  return (
    <>
      <div className="bajo-tabbar" aria-hidden />
      <nav aria-label="Secciones" className="tabbar">
        <span
          aria-hidden
          className="lozenge"
          style={{
            width: `calc((100% - 8px) / ${pestanas.length})`,
            transform: `translateX(${Math.max(0, i) * 100}%)`,
            opacity: i < 0 ? 0 : 1,
          }}
        />
        {pestanas.map((p) => (
          <Link key={p.texto} href={p.href} aria-current={p === actual ? "page" : undefined}>
            <span className="ic">
              {ICONOS[p.icono]}
              {p.bolita ? (
                <span className="bolita">
                  {p.bolita}
                  <span className="sr-only"> por responder</span>
                </span>
              ) : null}
            </span>
            <span>{p.texto}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
