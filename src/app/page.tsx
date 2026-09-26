import type { Route } from "next";
import { torneoEnCurso } from "@/lib/torneos/consultas";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { rankingVigente, tablaDeDivision, ultimosResultados } from "@/lib/ranking/consultas";
import type { DivisionTipo } from "@/lib/supabase/tipos";
import { Franja, FranjaPartidos, Lista, Pie, Rotulo } from "@/components/fila";
import { LeyendaZonas, SelectorDivision, TablaPosiciones } from "@/components/tabla-posiciones";
import { Tope } from "@/components/tope";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { EnVivo } from "@/components/en-vivo";
import { misPartidos, type MisPartidos } from "@/lib/partidos/consultas";

import { formatearFecha, textoFechaLimite } from "@/lib/fechas";

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/**
 * Qué dice la franja de tus partidos, en orden de urgencia: primero lo que
 * vence solo (un resultado por confirmar), después un desempate, que define
 * premios, y al final lo que te queda por jugar. Uno solo lleva directo a ese
 * partido; varios, a Mis partidos. Sin nada pendiente no hay franja.
 */
function franjaDePartidos(mios: MisPartidos, fechaLimite: string) {
  const { porConfirmar, pendientes } = mios;
  const cierre = `Cierra el ${formatearFecha(fechaLimite)} · ${textoFechaLimite(fechaLimite)}`;
  const aPartido = (id: string) => `/partidos/${id}` as Route;

  if (porConfirmar.length > 0) {
    const [p] = porConfirmar;
    const n = porConfirmar.length;
    return {
      urgente: true,
      cifra: n,
      titulo: plural(n, "Resultado por confirmar", "Resultados por confirmar"),
      sub:
        n === 1
          ? `${p.rival.nombre} registró ${p.gane ? "que le ganaste" : "que te ganó"}${p.sets ? ` ${p.sets}` : ""}`
          : pendientes.length > 0
            ? `Y ${pendientes.length} ${plural(pendientes.length, "partido", "partidos")} por jugar`
            : "Si no respondés, se confirman solos",
      href: n === 1 ? aPartido(p.id) : ("/partidos" as Route),
    };
  }

  if (pendientes.length === 0) return null;
  const [p] = pendientes;
  const n = pendientes.length;
  if (p.tipo === "desempate") {
    return {
      urgente: false,
      cifra: n,
      titulo: plural(n, "Desempate por jugar", "Partidos por jugar"),
      sub: n === 1 ? `Contra ${p.rival.nombre} · ${cierre}` : `Empezá por el desempate contra ${p.rival.nombre}`,
      href: aPartido(p.id),
    };
  }
  return {
    urgente: false,
    cifra: n,
    titulo: plural(n, "Partido por jugar", "Partidos por jugar"),
    sub: n === 1 ? `Contra ${p.rival.nombre} · ${textoFechaLimite(fechaLimite)}` : cierre,
    href: n === 1 ? aPartido(p.id) : ("/partidos" as Route),
  };
}

const ESTADO_RANKING: Record<string, string> = {
  abierto: "En juego",
  fase_regular_cerrada: "Fase regular cerrada",
  en_desempates: "En desempates",
  cerrado: "Cerrado",
};

export default async function Portada({ searchParams }: PageProps<"/">) {
  const [{ division: divisionParam, motivo }, sesion, ranking] = await Promise.all([
    searchParams,
    obtenerSesion(),
    rankingVigente(),
  ]);

  if (sesion?.usuario.debe_cambiar_pin) redirect("/cambiar-pin");

  const division: DivisionTipo = divisionParam === "menor" ? "menor" : "mayor";

  if (!ranking) {
    return (
      <>
        <Tope titulo="Ranking UVG" sub="Sin ranking en juego" />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
          <p className="text-muted-foreground">
            Todavía no hay un ranking abierto. Volvé cuando el coordinador lo publique.
          </p>
        </main>
      </>
    );
  }

  const [filas, resultados, mios, torneo] = await Promise.all([
    tablaDeDivision(ranking, division),
    ultimosResultados(ranking),
    sesion && ["abierto", "en_desempates"].includes(ranking.estado) ? misPartidos(sesion.authId, ranking.id) : null,
    torneoEnCurso(),
  ]);
  const franja = mios ? franjaDePartidos(mios, ranking.fecha_limite) : null;

  return (
    // Sin padding horizontal: el selector, la tabla y las listas llegan hasta
    // el borde y traen el suyo, como en el prototipo.
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col bg-background pb-8">
        <Tope
          titulo={ranking.nombre}
          sub={`${ESTADO_RANKING[ranking.estado] ?? ranking.estado} · División ${division === "mayor" ? "Mayor" : "Menor"}`}
        />

        {motivo === "solo-coordinador" ? (
          <p role="status" className="mx-4 mt-3 rounded-lg border px-4 py-3 text-sm text-muted-foreground">
            Esa sección es solo para el coordinador.
          </p>
        ) : null}

        {franja ? (
          <FranjaPartidos
            cifra={franja.cifra}
            titulo={franja.titulo}
            sub={franja.sub}
            href={franja.href}
            urgente={franja.urgente}
          />
        ) : null}

        {/* La franja del torneo solo existe mientras hay uno en curso. */}
        {torneo ? (
          <Franja
            nombre={torneo.torneo.nombre}
            sub={
              torneo.torneo.estado === "inscripcion"
                ? "Inscripción abierta · hablá con el coordinador para anotarte"
                : torneo.porJugar > 0
                  ? `En juego · quedan ${torneo.porJugar} partido${torneo.porJugar === 1 ? "" : "s"}`
                  : "En juego"
            }
            href={`/torneos/${torneo.torneo.id}` as Route}
          />
        ) : null}

        <SelectorDivision actual={division} />
        <EnVivo />

        <LeyendaZonas division={division} />
        <TablaPosiciones filas={filas} division={division} usuarioActualId={sesion?.authId} />

        <Pie>
          {ranking.nombre}. Cada pareja juega una vez; la victoria vale {ranking.pts_victoria}{" "}
          {ranking.pts_victoria === 1 ? "punto" : "puntos"}.
          <br />
          Cierra el {formatearFecha(ranking.fecha_limite)}.
        </Pie>

        <Rotulo>Últimos resultados</Rotulo>
        {resultados.length === 0 ? (
          <Pie>Aún no hay partidos confirmados.</Pie>
        ) : (
          <Lista>
            {resultados.map((r) => (
              <li
                key={r.id}
                className="flex min-h-[46px] items-center gap-3 border-b border-linea-suave px-4 py-2 text-sm last:border-b-0"
              >
                <span className="w-12 shrink-0 text-xs text-muted-foreground">
                  {r.fecha ? formatearFecha(r.fecha) : ""}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <Link
                    href={`/jugador/${encodeURIComponent(r.ganador.carnet)}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {r.ganador.nombre}
                  </Link>
                  <span className="text-muted-foreground"> venció a </span>
                  <Link
                    href={`/jugador/${encodeURIComponent(r.perdedor.carnet)}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {r.perdedor.nombre}
                  </Link>
                </span>
                {r.sets ? <span className="tabular shrink-0 font-medium">{r.sets}</span> : null}
                <Badge variant="outline" className="hidden shrink-0 capitalize sm:inline-flex">
                  {r.division}
                </Badge>
              </li>
            ))}
          </Lista>
        )}
      </main>
    </>
  );
}
