import type { Metadata } from "next";
import Link from "next/link";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";
import type { DivisionTipo } from "@/lib/supabase/tipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { abrirRanking, generarCalendario } from "./acciones";
import {
  BotonAccion,
  FormularioDivisiones,
  FormularioRanking,
  FormularioSemestre,
  type JugadorAsignable,
} from "./formularios";

export const metadata: Metadata = { title: "Ranking" };

const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: "Borrador",
  abierto: "Abierto",
  fase_regular_cerrada: "Fase regular cerrada",
  en_desempates: "En desempates",
  cerrado: "Cerrado",
};

function Paso({
  n,
  titulo,
  listo,
  children,
}: {
  n: number;
  titulo: string;
  listo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <span
          aria-hidden
          className={
            listo
              ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-zona-ascenso text-xs font-bold text-white"
              : "flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold"
          }
        >
          {listo ? "✓" : n}
        </span>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function PaginaRanking() {
  await requerirCoordinador();
  const supabase = await createClient();

  const [{ data: enCurso }, { data: semestres }] = await Promise.all([
    supabase
      .from("ranking")
      .select("*")
      .neq("estado", "cerrado")
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("semestre").select("id, nombre").order("inicio", { ascending: false }),
  ]);

  // -------------------------------------------------------------------------
  // Sin ranking en curso: crear uno
  // -------------------------------------------------------------------------
  if (!enCurso) {
    return (
      <>
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo ranking</h1>
          <p className="text-sm text-muted-foreground">
            No hay ninguno en curso. Se crea en borrador y se abre al final.
          </p>
        </header>
        <Paso n={1} titulo="Semestre" listo={(semestres?.length ?? 0) > 0}>
          {semestres && semestres.length > 0 ? (
            <p className="mb-3 text-sm text-muted-foreground">
              Existen: {semestres.map((s) => s.nombre).join(", ")}. Creá otro solo si empezó un semestre nuevo.
            </p>
          ) : null}
          <FormularioSemestre />
        </Paso>
        <Paso n={2} titulo="Ranking" listo={false}>
          <FormularioRanking semestres={semestres ?? []} />
        </Paso>
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Ranking en curso: armar o mostrar
  // -------------------------------------------------------------------------
  const [{ data: divisiones }, { data: usuarios }, { data: sorteo }] = await Promise.all([
    supabase.from("division").select("id, tipo, inscripcion(usuario_id), partido(id)").eq("ranking_id", enCurso.id),
    supabase.from("usuario").select("id, carnet, nombre").eq("activo", true).order("nombre"),
    supabase.from("sorteo").select("semilla, ejecutado_en").eq("ranking_id", enCurso.id).maybeSingle(),
  ]);

  const divisionDe = new Map<string, DivisionTipo>();
  let partidos = 0;
  for (const d of divisiones ?? []) {
    for (const i of d.inscripcion) divisionDe.set(i.usuario_id, d.tipo);
    partidos += d.partido.length;
  }
  const jugadores: JugadorAsignable[] = (usuarios ?? []).map((u) => ({
    ...u,
    division: divisionDe.get(u.id) ?? null,
  }));
  const nMayor = jugadores.filter((j) => j.division === "mayor").length;
  const nMenor = jugadores.filter((j) => j.division === "menor").length;
  const esperados = (nMayor * (nMayor - 1)) / 2 + (nMenor * (nMenor - 1)) / 2;
  const divisionesListas = nMayor >= 2 && nMenor >= 2;
  const calendarioListo = divisionesListas && partidos === esperados && partidos > 0;
  const borrador = enCurso.estado === "borrador";

  return (
    <>
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{enCurso.nombre}</h1>
          <Badge variant={borrador ? "outline" : "secondary"}>{ETIQUETA_ESTADO[enCurso.estado]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Fecha límite {enCurso.fecha_limite}. Mayor {nMayor}, Menor {nMenor}, {partidos} partidos.
          {sorteo ? ` Sorteo con semilla ${sorteo.semilla}.` : ""}
        </p>
      </header>

      {!borrador ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">El ranking está en juego</CardTitle>
            <CardDescription>
              Las divisiones y el calendario ya no se cambian. Los partidos, disputas y el cierre llegan en las fases
              3 y 4.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">Ver la tabla</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Paso n={1} titulo="Divisiones" listo={divisionesListas}>
            <FormularioDivisiones rankingId={enCurso.id} jugadores={jugadores} />
          </Paso>

          <Paso n={2} titulo="Calendario round robin" listo={calendarioListo}>
            <p className="mb-3 text-sm text-muted-foreground">
              Con {nMayor} en Mayor y {nMenor} en Menor salen {esperados} partidos.{" "}
              {partidos > 0 ? `Hay ${partidos} generados.` : "Todavía no hay ninguno."}
            </p>
            <BotonAccion
              accion={generarCalendario}
              rankingId={enCurso.id}
              etiqueta={partidos > 0 ? "Regenerar calendario" : "Generar calendario"}
              etiquetaPendiente="Generando..."
              variant="outline"
            />
          </Paso>

          <Paso n={3} titulo="Abrir ranking" listo={false}>
            <p className="mb-3 text-sm text-muted-foreground">
              Al abrir, la tabla aparece en la portada y los jugadores pueden registrar resultados. Después ya no se
              cambian divisiones ni calendario.
            </p>
            <BotonAccion
              accion={abrirRanking}
              rankingId={enCurso.id}
              etiqueta="Abrir ranking"
              etiquetaPendiente="Abriendo..."
              variant="accent"
            />
          </Paso>
        </>
      )}
    </>
  );
}
