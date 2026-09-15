import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { rankingVigente, tablaDeDivision, ultimosResultados } from "@/lib/ranking/consultas";
import type { DivisionTipo } from "@/lib/supabase/tipos";
import { LeyendaZonas, SelectorDivision, TablaPosiciones } from "@/components/tabla-posiciones";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { EnVivo } from "@/components/en-vivo";
import { misPartidos } from "@/lib/partidos/consultas";

const ESTADO_RANKING: Record<string, string> = {
  abierto: "En juego",
  fase_regular_cerrada: "Fase regular cerrada",
  en_desempates: "En desempates",
  cerrado: "Cerrado",
};

function formatearFecha(iso: string) {
  return new Intl.DateTimeFormat("es-GT", { day: "numeric", month: "short", timeZone: "America/Guatemala" }).format(
    new Date(iso),
  );
}

export default async function Portada({ searchParams }: PageProps<"/">) {
  const [{ division: divisionParam }, sesion, ranking] = await Promise.all([
    searchParams,
    obtenerSesion(),
    rankingVigente(),
  ]);

  if (sesion?.usuario.debe_cambiar_pin) redirect("/cambiar-pin");

  const division: DivisionTipo = divisionParam === "menor" ? "menor" : "mayor";

  if (!ranking) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Tabla de posiciones</h1>
        <p className="text-muted-foreground">
          Todavía no hay un ranking abierto. Volvé cuando el coordinador lo publique.
        </p>
      </main>
    );
  }

  const [filas, resultados, mios] = await Promise.all([
    tablaDeDivision(ranking, division),
    ultimosResultados(ranking),
    sesion && ["abierto", "en_desempates"].includes(ranking.estado) ? misPartidos(sesion.authId, ranking.id) : null,
  ]);
  const pendientesMios = mios ? mios.porConfirmar.length + mios.pendientes.length : 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{ranking.nombre}</h1>
          <Badge variant="secondary">{ESTADO_RANKING[ranking.estado] ?? ranking.estado}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Fecha límite: {formatearFecha(ranking.fecha_limite)}. Cada pareja juega una vez; victoria{" "}
          {ranking.pts_victoria} pt.
        </p>
      </header>

      {mios && pendientesMios > 0 ? (
        <Card className="border-accent/40 bg-accent/10">
          <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-4">
            <p className="text-sm">
              {mios.porConfirmar.length > 0 ? (
                <>
                  Tenés <span className="font-semibold">{mios.porConfirmar.length}</span> resultado
                  {mios.porConfirmar.length === 1 ? "" : "s"} por confirmar
                  {mios.pendientes.length > 0 ? " y " : "."}
                </>
              ) : null}
              {mios.pendientes.length > 0 ? (
                <>
                  <span className="font-semibold">{mios.pendientes.length}</span> partido
                  {mios.pendientes.length === 1 ? "" : "s"} por jugar.
                </>
              ) : null}
            </p>
            <Button asChild size="sm">
              <Link href="/partidos">Ver</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <SelectorDivision actual={division} />
      <EnVivo />

      <Card>
        <CardContent className="p-0 sm:p-0">
          <TablaPosiciones filas={filas} usuarioActualId={sesion?.authId} />
        </CardContent>
      </Card>
      <LeyendaZonas division={division} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos resultados</CardTitle>
        </CardHeader>
        <CardContent>
          {resultados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay partidos confirmados.</p>
          ) : (
            <ul className="divide-y">
              {resultados.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-12 shrink-0 text-xs text-muted-foreground">
                    {r.fecha ? formatearFecha(r.fecha) : ""}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{r.ganador}</span>
                    <span className="text-muted-foreground"> venció a </span>
                    {r.perdedor}
                  </span>
                  {r.sets ? <span className="tabular shrink-0 font-medium">{r.sets}</span> : null}
                  <Badge variant="outline" className="hidden shrink-0 capitalize sm:inline-flex">
                    {r.division}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
