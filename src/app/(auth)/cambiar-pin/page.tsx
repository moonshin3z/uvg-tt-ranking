import type { Metadata, Route } from "next";
import { requerirSesion } from "@/lib/auth/sesion";
import { Pie } from "@/components/fila";
import { FormularioCambioPin } from "./formulario";
import { Tope } from "@/components/tope";

export const metadata: Metadata = { title: "Cambiar PIN" };

export default async function PaginaCambiarPin() {
  const { usuario } = await requerirSesion();
  // Si todavía tiene el PIN que le dio el coordinador, no hay a dónde volver:
  // tiene que cambiarlo antes de ver nada.
  const obligado = usuario.debe_cambiar_pin;

  return (
    <>
      <Tope
        titulo={obligado ? "Elegí tu PIN" : "Cambiar mi PIN"}
        atras={obligado ? undefined : (`/jugador/${encodeURIComponent(usuario.carnet)}` as Route)}
        grande={obligado}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-8">
        <Pie>
          {obligado
            ? `Hola, ${usuario.nombre.split(" ")[0]}. Antes de seguir, cambiá el PIN que te dio el coordinador por uno tuyo.`
            : "Seis dígitos. Si lo olvidás, el coordinador te lo puede reiniciar."}
        </Pie>
        <div className="h-4" />
        <FormularioCambioPin />
      </main>
    </>
  );
}
