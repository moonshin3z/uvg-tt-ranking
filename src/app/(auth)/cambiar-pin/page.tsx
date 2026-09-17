import type { Metadata } from "next";
import { requerirSesion } from "@/lib/auth/sesion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormularioCambioPin } from "./formulario";
import { Tope } from "@/components/tope";

export const metadata: Metadata = { title: "Cambiar PIN" };

export default async function PaginaCambiarPin() {
  const { usuario } = await requerirSesion();

  return (
    <>
      <Tope titulo="Cambiar mi PIN" />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{usuario.debe_cambiar_pin ? "Elegí tu PIN" : "Cambiar PIN"}</CardTitle>
            <CardDescription>
              {usuario.debe_cambiar_pin
                ? `Hola, ${usuario.nombre.split(" ")[0]}. Antes de seguir, cambiá el PIN que te dio el coordinador por uno tuyo.`
                : "Seis dígitos. Si lo olvidás, el coordinador te lo puede reiniciar."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormularioCambioPin />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
