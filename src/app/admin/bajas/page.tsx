import type { Metadata } from "next";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";
import { datos } from "@/lib/supabase/errores";
import { Gestion } from "@/app/admin/gestion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Bitácora de bajas" };

type Actor = { nombre: string; carnet: string } | null;
type FilaBaja = {
  id: string;
  accion: "borrado" | "cancelado";
  tipo: "ranking" | "torneo";
  objeto_id: string;
  nombre: string;
  estado: string;
  contenido: unknown;
  motivo: string | null;
  hecho_en: string;
  hecho_por: string | null;
  actor: Actor;
};

function fechaHora(iso: string) {
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guatemala",
  }).format(new Date(iso));
}

function numero(contenido: unknown, clave: string) {
  if (typeof contenido !== "object" || contenido === null || Array.isArray(contenido)) return null;
  const valor = (contenido as Record<string, unknown>)[clave];
  return typeof valor === "number" ? valor : null;
}

function resumenContenido(contenido: unknown) {
  const partes: string[] = [];
  const inscritos = numero(contenido, "inscritos");
  const partidos = numero(contenido, "partidos");
  const jugados = numero(contenido, "jugados");
  const marcadores = numero(contenido, "marcadores");
  const retiros = numero(contenido, "retiros");
  const hereda = numero(contenido, "hereda");

  if (inscritos !== null) partes.push(`${inscritos} inscrito${inscritos === 1 ? "" : "s"}`);
  if (partidos !== null) partes.push(`${partidos} partido${partidos === 1 ? "" : "s"}`);
  if (jugados !== null && jugados > 0) partes.push(`${jugados} con resultado`);
  if (marcadores !== null && marcadores > 0)
    partes.push(`${marcadores} marcador${marcadores === 1 ? "" : "es"} con puntos`);
  if (retiros !== null && retiros > 0) partes.push(`${retiros} retiro${retiros === 1 ? "" : "s"}`);
  if (hereda !== null && hereda > 0)
    partes.push(`${hereda} ranking${hereda === 1 ? "" : "s"} dependiente${hereda === 1 ? "" : "s"}`);
  return partes.length > 0 ? partes.join(", ") : "Sin detalle de contenido";
}

export default async function PaginaBajas() {
  await requerirCoordinador();
  const supabase = await createClient();
  const bajas = datos(
    await supabase
      .from("baja")
      .select(
        "id, accion, tipo, objeto_id, nombre, estado, contenido, motivo, hecho_en, hecho_por, actor:usuario!baja_hecho_por_fkey(nombre, carnet)",
      )
      .order("hecho_en", { ascending: false }),
    "la bitácora de bajas",
  ) as unknown as FilaBaja[];

  return (
    <Gestion titulo="Bitácora de bajas" sub="Lo que se borró o canceló">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Bitácora de bajas</h1>
        <p className="text-sm text-muted-foreground">
          Registro permanente de rankings y torneos que se borraron o cancelaron.
        </p>
      </header>

      {bajas.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">Todavía no hay bajas registradas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {bajas.map((baja) => (
            <Card key={baja.id}>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{baja.nombre}</CardTitle>
                    <CardDescription className="capitalize">
                      {baja.accion} · {baja.tipo} · estaba {baja.estado}
                    </CardDescription>
                  </div>
                  <time dateTime={baja.hecho_en} className="text-xs text-muted-foreground">
                    {fechaHora(baja.hecho_en)}
                  </time>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <p>
                  <span className="font-medium">Contenido:</span> {resumenContenido(baja.contenido)}
                </p>
                <p>
                  <span className="font-medium">Hecho por:</span>{" "}
                  {baja.actor ? `${baja.actor.nombre} (${baja.actor.carnet})` : "cuenta eliminada"}
                </p>
                {baja.motivo ? (
                  <p>
                    <span className="font-medium">Motivo:</span> {baja.motivo}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Gestion>
  );
}
