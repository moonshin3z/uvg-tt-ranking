import type { Route } from "next";
import { Tope } from "@/components/tope";

/**
 * El envoltorio de las pantallas de gestión: ranking, partidos y jugadores.
 *
 * Antes esto vivía en el layout de /admin, con una barra de pestañas arriba.
 * El prototipo no tiene esa barra: el panel es el centro y cada pantalla se
 * abre desde una fila, con flecha para volver. Así que el layout quedó solo
 * con la comprobación de coordinador, y cada pantalla declara su propio tope.
 */
export function Gestion({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <>
      <Tope titulo={titulo} sub={sub} atras={"/admin" as Route} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pt-3 pb-8">{children}</main>
    </>
  );
}
