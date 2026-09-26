"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * La barra de arriba con el lenguaje de iOS, la parte que mira el scroll.
 *
 * Tres formas, las mismas del prototipo:
 *   · grande: el título va grande debajo de la barra y, al bajar, se recoge
 *     en la barra, centrado y chico. Las pantallas de cada pestaña.
 *   · fija: el título va siempre en la barra. Las pantallas de detalle, las
 *     que tienen flecha para volver.
 *   · alBajar: la barra empieza vacía y transparente, y el título aparece
 *     después de bajar tantos pixeles. El perfil, que arriba tiene su propia
 *     cabecera verde.
 */
export function BarraNav({
  titulo,
  sub,
  atras,
  grande,
  alBajar,
  derecha,
}: {
  titulo: string;
  sub?: string;
  atras?: Route;
  grande: boolean;
  alBajar?: number;
  derecha?: React.ReactNode;
}) {
  const umbral = alBajar ?? (grande ? 44 : 2);
  const fija = !grande && alBajar === undefined;
  const [bajada, setBajada] = useState(false);

  useEffect(() => {
    const mirar = () => setBajada(window.scrollY > umbral);
    mirar();
    window.addEventListener("scroll", mirar, { passive: true });
    return () => window.removeEventListener("scroll", mirar);
  }, [umbral]);

  return (
    <>
      <header className={cn("nav", fija && "fija", bajada && "bajada")}>
        <div className="nav-fondo" aria-hidden />
        <div className="nav-fila">
          <div className="nav-izq">
            {atras ? (
              <Link href={atras} aria-label="Volver" className="boton-nav circulo cristal">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </Link>
            ) : null}
          </div>
          <div className="nav-titulo" aria-hidden={grande || undefined}>
            <b role={grande ? undefined : "heading"} aria-level={grande ? undefined : 1}>
              {titulo}
            </b>
            {sub ? <small>{sub}</small> : null}
          </div>
          <div className="nav-der">{derecha}</div>
        </div>
      </header>
      {grande ? (
        <div className="grande">
          <h1>{titulo}</h1>
          {sub ? <p>{sub}</p> : null}
        </div>
      ) : null}
    </>
  );
}
