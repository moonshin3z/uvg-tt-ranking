import type { Route } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { obtenerSesion } from "@/lib/auth/sesion";

/**
 * La barra de arriba, copiada de `docs/diseno/prototipo.html`.
 *
 * En el prototipo esta barra es el título de la pantalla, no el logo del club
 * con botones: el título a la izquierda, un subtítulo debajo, la flecha de
 * volver cuando la pantalla es un detalle, y a la derecha quién sos.
 *
 * Por eso cada página la declara. Antes el encabezado era uno solo para toda
 * la aplicación y cada pantalla repetía su propio h1 debajo, así que el nombre
 * de la pantalla aparecía dos veces y nunca arriba.
 */
export async function Tope({
  titulo,
  sub,
  atras,
}: {
  titulo: string;
  sub?: string;
  /** A dónde vuelve la flecha. Sin esto no hay flecha. */
  atras?: Route;
}) {
  const sesion = await obtenerSesion();

  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center gap-2.5 border-b border-border bg-card/95 px-4 py-[9px] shadow-[0_1px_0_rgba(19,23,20,0.02)] backdrop-blur-md">
      {atras ? (
        <Link
          href={atras}
          aria-label="Volver"
          className="-ml-2 inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-primary transition-[background-color,transform] duration-150 ease-out active:scale-90 active:bg-uvg-suave"
        >
          <ChevronLeft aria-hidden className="size-5" strokeWidth={2.25} />
        </Link>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold tracking-[-0.02em]">{titulo}</p>
        {sub ? <p className="truncate text-[12.5px] text-muted-foreground">{sub}</p> : null}
      </div>
      {sesion ? (
        <span className="shrink-0 text-[13px] whitespace-nowrap text-muted-foreground">
          {nombreCorto(sesion.usuario.nombre)}
        </span>
      ) : (
        <Link
          href="/ingresar"
          className="inline-flex min-h-10 shrink-0 items-center rounded-md px-1 text-[13px] font-medium text-primary transition-[color,transform] duration-150 ease-out active:scale-95"
        >
          Ingresar
        </Link>
      )}
    </header>
  );
}

/** "Iván Roble Mérida" → "Iván R." */
function nombreCorto(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length < 2) return partes[0] ?? "";
  return `${partes[0]} ${partes[1][0]}.`;
}
