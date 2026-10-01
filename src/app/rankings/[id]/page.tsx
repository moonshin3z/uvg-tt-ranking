import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { calendarioDeRanking, divisionesDelRanking, rankingPorId, tablaDeDivision } from "@/lib/ranking/consultas";
import { divisionElegida, nombreDivision } from "@/lib/ranking/divisiones";
import type { DivisionTipo } from "@/lib/supabase/tipos";
import { Fila, Lista, Marcador, Pie, Segmentado } from "@/components/fila";
import { LeyendaZonas, TablaPosiciones } from "@/components/tabla-posiciones";
import { Tope } from "@/components/tope";

export async function generateMetadata({ params }: PageProps<"/rankings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ranking = await rankingPorId(id);
  return { title: ranking?.nombre ?? "Ranking" };
}

const ETIQUETA: Record<string, string> = {
  abierto: "En juego",
  fase_regular_cerrada: "Fase regular cerrada",
  en_desempates: "En desempates",
  cerrado: "Terminado",
};

const ETIQUETA_PARTIDO: Record<string, string> = {
  pendiente: "Sin jugar",
  jugado: "Sin confirmar",
  disputado: "En disputa",
  anulado: "Anulado",
};

export default async function PaginaRanking({ params, searchParams }: PageProps<"/rankings/[id]">) {
  const [{ id }, { division: divParam, ver }, sesion] = await Promise.all([params, searchParams, obtenerSesion()]);

  const ranking = await rankingPorId(id);
  if (!ranking) notFound();

  const divisiones = await divisionesDelRanking(ranking.id);
  const division: DivisionTipo = divisionElegida(divParam, divisiones);
  const verCalendario = ver === "calendario";

  const [filas, calendario] = await Promise.all([
    tablaDeDivision(ranking, division, divisiones.length),
    verCalendario ? calendarioDeRanking(ranking.id) : Promise.resolve([]),
  ]);

  const deLaDivision = calendario.filter((p) => p.division === division);
  const base = `/rankings/${ranking.id}` as const;

  const aca = (d: DivisionTipo, calendario: boolean) =>
    `${base}?division=${d}${calendario ? "&ver=calendario" : ""}` as Route;

  return (
    <>
      <Tope titulo={ranking.nombre} sub={ETIQUETA[ranking.estado] ?? ranking.estado} atras="/rankings" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pb-8">
        <div className="h-1.5" />
        <Segmentado
          etiqueta="División"
          actual={division}
          opciones={divisiones.map((d) => ({ valor: d, etiqueta: nombreDivision(d), href: aca(d, verCalendario) }))}
        />
        <Segmentado
          etiqueta="Vista"
          actual={verCalendario ? "calendario" : "tabla"}
          opciones={[
            { valor: "tabla", etiqueta: "Tabla", href: aca(division, false) },
            { valor: "calendario", etiqueta: "Calendario", href: aca(division, true) },
          ]}
        />

        {!verCalendario ? (
          <>
            <LeyendaZonas
              division={division}
              divisiones={divisiones}
              n_premiados={ranking.n_premiados}
              n_ascienden={ranking.n_ascienden}
              n_descienden={ranking.n_descienden}
            />
            <TablaPosiciones filas={filas} division={division} usuarioActualId={sesion?.authId} />
          </>
        ) : deLaDivision.length === 0 ? (
          <Pie>No hay partidos en esta división.</Pie>
        ) : (
          <Lista>
            {deLaDivision.map((p) => {
              const ganoA = p.ganador === p.jugador_a;
              const definido = p.estado === "confirmado" || p.estado === "resuelto";
              const sets = p.sets_a != null && p.sets_b != null ? `${p.sets_a}-${p.sets_b}` : null;
              return (
                <Fila
                  key={p.id}
                  sinInicial
                  nombre={`${p.a.nombre} vs. ${p.b.nombre}`}
                  sub={
                    definido
                      ? `Ganó ${ganoA ? p.a.nombre : p.b.nombre}${p.tipo === "desempate" ? " · desempate" : ""}`
                      : `${ETIQUETA_PARTIDO[p.estado] ?? p.estado}${p.tipo === "desempate" ? " · desempate" : ""}`
                  }
                  derecha={definido ? <Marcador texto={sets ?? "jugado"} gano={false} /> : null}
                />
              );
            })}
          </Lista>
        )}
      </main>
    </>
  );
}
