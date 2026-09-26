import type { Route } from "next";
import { torneoEnCurso } from "@/lib/torneos/consultas";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { rankingVigente, tablaDeDivision, ultimosResultados } from "@/lib/ranking/consultas";
import type { DivisionTipo } from "@/lib/supabase/tipos";
import Link from "next/link";
import {
  Fila,
  Franja,
  FranjaPartidos,
  Lista,
  Marcador,
  Nota,
  Pie,
  Rotulo,
  Vacio,
  primerNombre,
} from "@/components/fila";
import { LeyendaZonas, SelectorDivision, TablaPosiciones } from "@/components/tabla-posiciones";
import { DIBUJO } from "@/components/iconos";
import { Tope } from "@/components/tope";
import { EnVivo } from "@/components/en-vivo";
import { misPartidos, type MisPartidos } from "@/lib/partidos/consultas";

import { cuandoPaso, formatearFecha, textoFechaLimite } from "@/lib/fechas";

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
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pb-8">
        <Tope titulo="Ranking UVG" sub="Sin ranking en juego" />
        <Vacio
          dibujo={DIBUJO.trofeo}
          titulo="Todavía no arrancó el ranking"
          detalle="Cuando el coordinador arme las divisiones y haga el sorteo, la tabla aparece acá y te avisamos qué partidos te tocan."
        >
          <Link href="/reglas" className="btn gris">
            Cómo funciona
          </Link>
        </Vacio>
      </main>
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
    // Sin padding horizontal: los bloques traen su propio margen, como en el
    // prototipo.
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pb-8">
      <Tope
        titulo={ranking.nombre}
        sub={`${ESTADO_RANKING[ranking.estado] ?? ranking.estado} · cierra el ${formatearFecha(ranking.fecha_limite)}`}
      />

      {motivo === "solo-coordinador" ? <Nota>Esa sección es solo para el coordinador.</Nota> : null}

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
          etiqueta={torneo.torneo.estado === "inscripcion" ? "Inscripción" : "En vivo"}
          sub={
            torneo.torneo.estado === "inscripcion"
              ? "Hablá con el coordinador para anotarte"
              : torneo.porJugar > 0
                ? `Quedan ${torneo.porJugar} partido${torneo.porJugar === 1 ? "" : "s"}`
                : "Sin partidos por jugar"
          }
          href={`/torneos/${torneo.torneo.id}` as Route}
        />
      ) : null}

      <SelectorDivision actual={division} />
      <EnVivo />

      <LeyendaZonas division={division} />
      <TablaPosiciones filas={filas} division={division} usuarioActualId={sesion?.authId} />

      <Pie>
        Cada pareja juega una vez. La victoria vale {ranking.pts_victoria}{" "}
        {ranking.pts_victoria === 1 ? "punto" : "puntos"}.
      </Pie>

      <Rotulo>Últimos resultados</Rotulo>
      {resultados.length === 0 ? (
        <Pie>Aún no hay partidos confirmados.</Pie>
      ) : (
        <Lista>
          {resultados.map((r) => (
            <Fila
              key={r.id}
              sinInicial
              nombre={`${r.ganador.nombre} le ganó a ${primerNombre(r.perdedor.nombre)}`}
              sub={`${r.fecha ? `${cuandoPaso(r.fecha)} · ` : ""}División ${r.division === "mayor" ? "Mayor" : "Menor"}`}
              derecha={r.sets ? <Marcador texto={r.sets} gano={false} /> : null}
            />
          ))}
        </Lista>
      )}
    </main>
  );
}
