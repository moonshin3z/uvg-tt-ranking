import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { FormularioIngreso } from "./formulario";

export const metadata: Metadata = { title: "Ingresar" };

const MOTIVOS: Record<string, string> = {
  sesion: "Tu sesión venció. Ingresá de nuevo para seguir.",
};

/** La pantalla de ingreso del prototipo de iOS: el ícono, el nombre y dos campos. */
export default async function PaginaIngresar({ searchParams }: PageProps<"/ingresar">) {
  const [{ motivo }, sesion] = await Promise.all([searchParams, obtenerSesion()]);
  if (sesion) redirect(sesion.usuario.debe_cambiar_pin ? "/cambiar-pin" : "/");
  const aviso = typeof motivo === "string" ? MOTIVOS[motivo] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-8">
      <div className="ingreso">
        <Image src="/icons/v2/icon.svg" alt="" width={84} height={84} className="app-icono" priority unoptimized />
        <h1>Ranking UVG</h1>
        <p>Entrá con tu carnet y el PIN que te dio el coordinador.</p>
        {aviso ? (
          <p role="status" className="alerta buena mb-5">
            {aviso}
          </p>
        ) : null}
        <FormularioIngreso />
      </div>
    </main>
  );
}
