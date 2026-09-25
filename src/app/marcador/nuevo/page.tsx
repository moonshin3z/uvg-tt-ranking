import type { Metadata } from "next";
import { requerirSesion } from "@/lib/auth/sesion";
import { Tope } from "@/components/tope";
import { Pie } from "@/components/fila";
import { FormularioMarcadorLibre } from "./formulario";

export const metadata: Metadata = { title: "Marcador libre" };

/**
 * Un marcador para un partido que no es del ranking.
 *
 * Es la parte del sistema que se usa aunque no haya nada que registrar: dos
 * personas que se sientan a jugar y quieren llevar la cuenta. No exige que los
 * dos tengan cuenta ni que el resultado quede guardado en ningún lado.
 */
export default async function PaginaMarcadorNuevo() {
  const sesion = await requerirSesion();

  return (
    <>
      <Tope titulo="Marcador libre" sub="Un partido que no es del ranking" atras="/partidos" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col bg-background pb-8">
        <FormularioMarcadorLibre nombrePropio={sesion.usuario.nombre} />
        <Pie>
          Esto no se registra en el ranking ni cuenta para la tabla. Sirve para llevar la cuenta de un amistoso, un
          entrenamiento o un partido de un torneo que todavía no está en el sistema.
        </Pie>
      </main>
    </>
  );
}
