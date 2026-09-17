import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { FormularioIngreso } from "./formulario";

export const metadata: Metadata = { title: "Ingresar" };

const MOTIVOS: Record<string, string> = {
  sesion: "Tu sesión venció. Ingresá de nuevo para seguir.",
};

export default async function PaginaIngresar({ searchParams }: PageProps<"/ingresar">) {
  const [{ motivo }, sesion] = await Promise.all([searchParams, obtenerSesion()]);
  if (sesion) redirect(sesion.usuario.debe_cambiar_pin ? "/cambiar-pin" : "/");
  const aviso = typeof motivo === "string" ? MOTIVOS[motivo] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-8">
      {aviso ? (
        <p role="status" className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          {aviso}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Ingresar</CardTitle>
          <CardDescription>Con tu carnet y el PIN que te dio el coordinador.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioIngreso />
        </CardContent>
        <CardFooter className="flex-col items-start gap-1 text-sm text-muted-foreground">
          <Link href="/" className="inline-flex min-h-10 items-center text-primary underline-offset-4 hover:underline">
            Ver la tabla sin ingresar
          </Link>
          <Link href="/reglas" className="inline-flex min-h-10 items-center text-primary underline-offset-4 hover:underline">
            Cómo funciona el ranking
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
