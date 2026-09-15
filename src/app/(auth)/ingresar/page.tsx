import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormularioIngreso } from "./formulario";

export const metadata: Metadata = { title: "Ingresar" };

export default async function PaginaIngresar() {
  const sesion = await obtenerSesion();
  if (sesion) redirect(sesion.usuario.debe_cambiar_pin ? "/cambiar-pin" : "/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Ingresar</CardTitle>
          <CardDescription>Con tu carnet y el PIN que te dio el coordinador.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioIngreso />
        </CardContent>
      </Card>
    </main>
  );
}
