import type { Metadata } from "next";
import Link from "next/link";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";
import { datos } from "@/lib/supabase/errores";
import { formatearFecha, textoFechaLimite } from "@/lib/fechas";
import type { DivisionTipo, RankingRow } from "@/lib/supabase/tipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gestion } from "@/app/admin/gestion";
import { ZonaDePeligro, type Contenido } from "@/app/admin/bajas";
import { abrirRanking, cerrarFaseRegular, cerrarRanking, generarCalendario, generarDesempates } from "./acciones";
import {
  BotonAccion,
  BotonCierre,
  FormularioDecidirEmpate,
  FormularioDivisiones,
  FormularioRanking,
  FormularioSemestre,
  FormularioSiguiente,
  type JugadorAsignable,
} from "./formularios";

export const metadata: Metadata = { title: "Ranking" };

const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: "Borrador",
  abierto: "Abierto",
  fase_regular_cerrada: "Fase regular cerrada",
  en_desempates: "En desempates",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

function Paso({
  n,
  titulo,
  listo,
  children,
}: {
  n: number | string;
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

function Encabezado({ ranking, extra }: { ranking: RankingRow; extra?: string }) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{ranking.nombre}</h1>
        <Badge variant={ranking.estado === "abierto" ? "secondary" : "outline"}>
          {ETIQUETA_ESTADO[ranking.estado]}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Fecha límite {formatearFecha(ranking.fecha_limite)}
        {ranking.estado === "abierto" ? ` (${textoFechaLimite(ranking.fecha_limite)})` : ""}. {extra}
      </p>
    </header>
  );
}

function Exportar({ rankingId }: { rankingId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={`/admin/exportar?tipo=tabla&ranking=${rankingId}`}>Exportar tabla</a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={`/admin/exportar?tipo=resultados&ranking=${rankingId}`}>Exportar resultados</a>
      </Button>
    </div>
  );
}

async function ZonaRanking({ ranking }: { ranking: RankingRow }) {
  const supabase = await createClient();
  const contenido = (datos(
    await supabase.rpc("contenido_del_ranking", { p_ranking_id: ranking.id }),
    "el contenido del ranking",
  ) ?? {}) as Partial<Contenido> & { retiros?: number; hereda?: number };

  const c: Contenido = {
    inscritos: contenido.inscritos ?? 0,
    partidos: contenido.partidos ?? 0,
    jugados: contenido.jugados ?? 0,
    marcadores: contenido.marcadores ?? 0,
  };
  const limpio =
    c.jugados === 0 && c.marcadores === 0 && (contenido.retiros ?? 0) === 0 && (contenido.hereda ?? 0) === 0;

  return (
    <ZonaDePeligro
      tipo="ranking"
      id={ranking.id}
      nombre={ranking.nombre}
      estado={ETIQUETA_ESTADO[ranking.estado]?.toLowerCase() ?? ranking.estado}
      contenido={c}
      sePuedeBorrar={["borrador", "abierto"].includes(ranking.estado) && limpio}
      sePuedeCancelar={!["cerrado", "cancelado"].includes(ranking.estado)}
    />
  );
}

async function CuerpoRanking() {
  await requerirCoordinador();
  const supabase = await createClient();

  const [{ data: enCurso }, { data: semestres }, { data: ultimoCerrado }] = await Promise.all([
    supabase
      .from("ranking")
      .select("*")
      // Un cancelado tampoco está en curso, aunque no esté cerrado.
      .not("estado", "in", "(cerrado,cancelado)")
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("semestre").select("id, nombre").order("inicio", { ascending: false }),
    supabase
      .from("ranking")
      .select("*")
      .eq("estado", "cerrado")
      .order("cerrado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // ===========================================================================
  // Sin ranking en curso
  // ===========================================================================
  if (!enCurso) {
    const propuesta = ultimoCerrado
      ? datos(
          await supabase.rpc("proponer_siguiente", { p_ranking_id: ultimoCerrado.id }),
          "la propuesta del ranking siguiente",
        )
      : null;

    return (
      <>
        {ultimoCerrado ? (
          <>
            <Encabezado ranking={ultimoCerrado} extra="Terminado. Creá el siguiente con los ascensos y descensos." />
            <Exportar rankingId={ultimoCerrado.id} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cómo quedó</CardTitle>
                <CardDescription>Los movimientos ya están calculados según el reglamento.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-0">
                <ul className="divide-y">
                  {(propuesta ?? []).map((j) => (
                    <li key={j.usuario_id} className="flex items-center gap-3 px-4 py-2 text-sm sm:px-6">
                      <span className="w-6 text-right text-muted-foreground">{j.posicion ?? "—"}</span>
                      <span className="min-w-0 flex-1 truncate">{j.nombre}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {j.division_actual ?? "sin ranking previo"}
                      </span>
                      {j.origen === "ascenso" ? (
                        <Badge variant="ascenso">sube</Badge>
                      ) : j.origen === "descenso" ? (
                        <Badge variant="descenso">baja</Badge>
                      ) : j.origen === "nuevo" ? (
                        <Badge variant="secondary">nuevo</Badge>
                      ) : (
                        <span className="w-10" />
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Paso n={1} titulo="Ranking siguiente" listo={false}>
              <p className="mb-3 text-sm text-muted-foreground">
                Se crea en borrador con las divisiones ya armadas: no hay sorteo, los lugares salen de la tabla
                anterior. Quien no jugó el ranking pasado entra en Menor. Podés ajustarlo todo a mano antes de
                abrirlo.
              </p>
              <FormularioSiguiente
                rankingAnterior={ultimoCerrado.id}
                semestres={semestres ?? []}
                numeroSugerido={ultimoCerrado.numero === 1 ? 2 : 1}
                semestreSugerido={ultimoCerrado.numero === 1 ? ultimoCerrado.semestre_id : (semestres?.[0]?.id ?? "")}
              />
            </Paso>
          </>
        ) : (
          <header>
            <h1 className="text-2xl font-bold tracking-tight">Nuevo ranking</h1>
            <p className="text-sm text-muted-foreground">
              No hay ninguno en curso. Se crea en borrador y se abre al final.
            </p>
          </header>
        )}

        <Paso n={ultimoCerrado ? "+" : 1} titulo="Semestre" listo={(semestres?.length ?? 0) > 0}>
          {semestres && semestres.length > 0 ? (
            <p className="mb-3 text-sm text-muted-foreground">
              Existen: {semestres.map((s) => s.nombre).join(", ")}. Creá otro solo si empezó un semestre nuevo.
            </p>
          ) : null}
          <FormularioSemestre />
        </Paso>

        {!ultimoCerrado ? (
          <Paso n={2} titulo="Ranking" listo={false}>
            <FormularioRanking semestres={semestres ?? []} />
          </Paso>
        ) : null}
      </>
    );
  }

  // ===========================================================================
  // Ranking en curso
  // ===========================================================================
  const [{ data: divisiones }, { data: usuarios }, { data: sorteo }] = await Promise.all([
    supabase
      .from("division")
      .select("id, tipo, inscripcion(usuario_id), partido(id, tipo, estado)")
      .eq("ranking_id", enCurso.id),
    supabase.from("usuario").select("id, carnet, nombre").eq("activo", true).order("nombre"),
    supabase.from("sorteo").select("semilla").eq("ranking_id", enCurso.id).maybeSingle(),
  ]);

  const divisionDe = new Map<string, DivisionTipo>();
  const conteo = { regular: 0, pendiente: 0, jugado: 0, disputado: 0, desempatePendiente: 0 };
  for (const d of divisiones ?? []) {
    for (const i of d.inscripcion) divisionDe.set(i.usuario_id, d.tipo);
    for (const p of d.partido) {
      if (p.tipo === "regular") {
        conteo.regular++;
        if (p.estado === "pendiente") conteo.pendiente++;
        if (p.estado === "jugado") conteo.jugado++;
        if (p.estado === "disputado") conteo.disputado++;
      } else if (["pendiente", "jugado", "disputado"].includes(p.estado)) {
        conteo.desempatePendiente++;
      }
    }
  }

  const jugadores: JugadorAsignable[] = (usuarios ?? []).map((u) => ({
    ...u,
    division: divisionDe.get(u.id) ?? null,
  }));
  const nMayor = jugadores.filter((j) => j.division === "mayor").length;
  const nMenor = jugadores.filter((j) => j.division === "menor").length;
  const esperados = (nMayor * (nMayor - 1)) / 2 + (nMenor * (nMenor - 1)) / 2;
  const sinDefinir = conteo.pendiente + conteo.jugado + conteo.disputado;

  // --- Borrador: armar ---------------------------------------------------
  if (enCurso.estado === "borrador") {
    return (
      <>
        <Encabezado
          ranking={enCurso}
          extra={`Mayor ${nMayor}, Menor ${nMenor}, ${conteo.regular} partidos.${sorteo ? ` Sorteo ${sorteo.semilla}.` : ""}`}
        />
        <Paso n={1} titulo="Divisiones" listo={nMayor >= 2 && nMenor >= 2}>
          <FormularioDivisiones rankingId={enCurso.id} jugadores={jugadores} hereda={enCurso.anterior_id !== null} />
        </Paso>
        <Paso n={2} titulo="Calendario round robin" listo={conteo.regular === esperados && conteo.regular > 0}>
          <p className="mb-3 text-sm text-muted-foreground">
            Con {nMayor} en Mayor y {nMenor} en Menor salen {esperados} partidos.{" "}
            {conteo.regular > 0 ? `Hay ${conteo.regular} generados.` : "Todavía no hay ninguno."}
          </p>
          <BotonAccion
            accion={generarCalendario}
            rankingId={enCurso.id}
            etiqueta={conteo.regular > 0 ? "Regenerar calendario" : "Generar calendario"}
            etiquetaPendiente="Generando..."
            variant="outline"
          />
        </Paso>
        <Paso n={3} titulo="Abrir ranking" listo={false}>
          <p className="mb-3 text-sm text-muted-foreground">
            Al abrir, la tabla aparece en la portada y los jugadores pueden registrar resultados.
          </p>
          <BotonAccion
            accion={abrirRanking}
            rankingId={enCurso.id}
            etiqueta="Abrir ranking"
            etiquetaPendiente="Abriendo..."
            variant="accent"
          />
        </Paso>
        <ZonaRanking ranking={enCurso} />
      </>
    );
  }

  // --- Abierto: jugando, cerrar fase regular -----------------------------
  const jugados = conteo.regular - sinDefinir;
  if (enCurso.estado === "abierto") {
    return (
      <>
        <Encabezado ranking={enCurso} extra={`${jugados} de ${conteo.regular} partidos definidos.`} />
        <Exportar rankingId={enCurso.id} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cerrar la fase regular</CardTitle>
            <CardDescription>
              Antes de cerrar no puede quedar ningún partido sin definir. Los que no se jugaron los resolvés vos:
              anulalos o dale el partido a alguien.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {sinDefinir > 0 ? (
              <>
                <ul className="flex flex-col gap-1 text-sm">
                  {conteo.pendiente > 0 ? <li>{conteo.pendiente} sin jugar</li> : null}
                  {conteo.jugado > 0 ? <li>{conteo.jugado} sin confirmar</li> : null}
                  {conteo.disputado > 0 ? <li>{conteo.disputado} en disputa</li> : null}
                </ul>
                <Button asChild variant="outline" className="sm:self-start">
                  <Link href="/admin/partidos">Resolverlos</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Todos los partidos están definidos.</p>
            )}
            <BotonCierre
              accion={cerrarFaseRegular}
              rankingId={enCurso.id}
              etiqueta="Cerrar fase regular"
              etiquetaPendiente="Cerrando..."
              variant="accent"
            />
          </CardContent>
        </Card>
        <ZonaRanking ranking={enCurso} />
      </>
    );
  }

  // --- Fase regular cerrada o en desempates ------------------------------
  const empates = datos(await supabase.rpc("empates_relevantes", { p_ranking_id: enCurso.id }), "los empates");
  const hayEmpates = (empates?.length ?? 0) > 0;

  return (
    <>
      <Encabezado ranking={enCurso} extra={`${conteo.regular} partidos de la fase regular.`} />
      <Exportar rankingId={enCurso.id} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Empates por romper</CardTitle>
          <CardDescription>
            Solo los que cambian algo: premio, ascenso o descenso. Se juegan todos contra todos entre los empatados.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {hayEmpates ? (
            <ul className="flex flex-col gap-2">
              {(empates ?? []).map((e, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={e.motivo === "premio" ? "premio" : e.motivo === "ascenso" ? "ascenso" : "descenso"}>
                    {e.motivo}
                  </Badge>
                  <span className="text-muted-foreground capitalize">{e.division}</span>
                  <span>
                    puestos {e.min_pos}
                    {e.max_pos !== e.min_pos ? `-${e.max_pos}` : ""}: {e.nombres.join(", ")} ({e.pts} pts)
                  </span>
                  <span className="text-muted-foreground">
                    {e.accion === "jugar" ? "se juega un desempate" : "lo decide el coordinador"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No quedan empates que afecten premios, ascensos ni descensos.
            </p>
          )}

          {/* Los que ya se jugaron y siguieron empatados: acá se deciden. */}
          {(empates ?? [])
            .filter((e) => e.accion === "decidir")
            .map((e) => (
              <FormularioDecidirEmpate
                key={e.division_id + e.min_pos}
                divisionId={e.division_id}
                jugadores={e.usuarios.map((id, i) => ({ id, nombre: e.nombres[i] }))}
              />
            ))}

          {conteo.desempatePendiente > 0 ? (
            <p className="text-sm">
              Hay {conteo.desempatePendiente} desempate{conteo.desempatePendiente === 1 ? "" : "s"} sin jugar. Les
              aparecen a los jugadores en Mis partidos.
            </p>
          ) : (empates ?? []).some((e) => e.accion === "jugar") ? (
            <BotonCierre
              accion={generarDesempates}
              rankingId={enCurso.id}
              etiqueta="Generar partidos de desempate"
              etiquetaPendiente="Generando..."
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cerrar el ranking</CardTitle>
          <CardDescription>
            Queda en solo lectura y se calculan ascensos y descensos. Después vas a poder crear el siguiente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BotonCierre
            accion={cerrarRanking}
            rankingId={enCurso.id}
            etiqueta="Cerrar ranking"
            etiquetaPendiente="Cerrando..."
            variant="accent"
          />
        </CardContent>
      </Card>
      <ZonaRanking ranking={enCurso} />
    </>
  );
}

export default async function PaginaRanking() {
  return (
    <Gestion titulo="Ranking" sub="Divisiones, calendario y cierre">
      <CuerpoRanking />
    </Gestion>
  );
}
