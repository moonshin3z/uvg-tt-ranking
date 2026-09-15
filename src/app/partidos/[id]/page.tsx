import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth/sesion";
import { partidoPorId, setsDePartido } from "@/lib/partidos/consultas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormularioResultado } from "../formularios";

export const metadata: Metadata = { title: "Registrar resultado" };

export default async function PaginaPartido({ params }: PageProps<"/partidos/[id]">) {
  const [{ id }, sesion] = await Promise.all([params, requerirSesion()]);
  if (sesion.usuario.debe_cambiar_pin) redirect("/cambiar-pin");

  const p = await partidoPorId(id);
  if (!p) notFound();

  const yo = sesion.authId;
  const esCoordinador = sesion.usuario.rol === "coordinador";
  const juego = p.jugador_a === yo || p.jugador_b === yo;
  if (!juego && !esCoordinador) redirect("/partidos");

  const puedeRegistrar =
    p.estado === "pendiente" || (p.estado === "jugado" && (p.registrado_por === yo || esCoordinador));
  if (!puedeRegistrar) redirect(esCoordinador ? "/admin/partidos" : "/partidos");

  const puntos = await setsDePartido(id);
  // Para el coordinador registrando por otros, "yo" es el jugador A.
  const soyA = juego ? p.jugador_a === yo : true;
  const propio = soyA ? p.a : p.b;
  const rival = soyA ? p.b : p.a;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link
        href={esCoordinador && !juego ? "/admin/partidos" : "/partidos"}
        className="text-sm text-muted-foreground"
      >
        ← Volver
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{p.estado === "jugado" ? "Corregir resultado" : "Registrar resultado"}</CardTitle>
          <CardDescription>
            {juego ? `vs. ${rival.nombre}` : `${p.a.nombre} vs. ${p.b.nombre}`} · división {p.division.tipo}
            {p.tipo === "desempate" ? " · desempate" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioResultado
            partidoId={p.id}
            yo={juego ? { id: propio.id, nombre: propio.nombre } : { id: p.a.id, nombre: p.a.nombre }}
            rival={{ id: rival.id, nombre: rival.nombre }}
            soyA={soyA}
            setsA={p.sets_a}
            setsB={p.sets_b}
            puntos={puntos}
          />
        </CardContent>
      </Card>
    </main>
  );
}
