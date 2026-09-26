import type { Route } from "next";
import Link from "next/link";
import { obtenerSesion } from "@/lib/auth/sesion";
import { BarraNav } from "@/components/barra-nav";

/**
 * La barra de arriba, copiada del prototipo de iOS.
 *
 * Cada pantalla la declara con su título. Sin flecha para volver, el título va
 * grande debajo de la barra y se recoge en ella al bajar; con flecha, va fijo
 * en la barra. A la derecha, solo sin sesión: el botón para ingresar. Con
 * sesión no hace falta, la cuenta vive en la pestaña Perfil.
 */
export async function Tope({
  titulo,
  sub,
  atras,
  grande = !atras,
  alBajar,
}: {
  titulo: string;
  sub?: string;
  /** A dónde vuelve la flecha. Sin esto no hay flecha. */
  atras?: Route;
  /** El título grande debajo de la barra. Por defecto, cuando no hay flecha. */
  grande?: boolean;
  /** Pixeles de scroll antes de que aparezca el título en la barra. */
  alBajar?: number;
}) {
  const sesion = await obtenerSesion();

  return (
    <BarraNav
      titulo={titulo}
      sub={sub}
      atras={atras}
      grande={grande}
      alBajar={alBajar}
      derecha={
        sesion ? null : (
          <Link href="/ingresar" className="boton-nav cristal fuerte">
            Ingresar
          </Link>
        )
      }
    />
  );
}
