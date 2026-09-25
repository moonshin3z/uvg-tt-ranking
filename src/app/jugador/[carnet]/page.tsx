import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import {
  headToHead,
  historialDeJugador,
  jugadorPorCarnet,
  partidosDeJugador,
  type FilaHistorial,
} from "@/lib/jugadores/consultas";
import { normalizarCarnet } from "@/lib/auth/carnet";
import { CabeceraPerfil, Cifras, Fila, FilaAccion, Flecha, Lista, Marcador, Pie, Rotulo } from "@/components/fila";
import { salir } from "@/app/(auth)/ingresar/acciones";

export async function generateMetadata({ params }: PageProps<"/jugador/[carnet]">): Promise<Metadata> {
  const { carnet } = await params;
  const jugador = await jugadorPorCarnet(normalizarCarnet(decodeURIComponent(carnet)));
  return { title: jugador?.nombre ?? "Jugador" };
}

function formatearFecha(iso: string) {
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "short",
    timeZone: "America/Guatemala",
  }).format(new Date(iso));
}

/** Premio, ascenso o descenso que le tocó en un ranking ya cerrado. */
function distincion(f: FilaHistorial) {
  if (f.ranking_estado !== "cerrado") return null;
  if (f.posicion <= f.n_premiados) return { texto: `${f.posicion}º`, variante: "premio" as const };
  if (f.division === "menor" && f.posicion <= f.n_ascienden) return { texto: "subió", variante: "ascenso" as const };
  if (f.division === "mayor" && f.posicion > f.jugadores_division - f.n_descienden)
    return { texto: "bajó", variante: "descenso" as const };
  return null;
}

export default async function PerfilJugador({ params }: PageProps<"/jugador/[carnet]">) {
  const [{ carnet: carnetParam }, sesion] = await Promise.all([params, obtenerSesion()]);
  const carnet = normalizarCarnet(decodeURIComponent(carnetParam));

  const jugador = await jugadorPorCarnet(carnet);
  if (!jugador) notFound();

  const [historial, partidos] = await Promise.all([historialDeJugador(jugador.id), partidosDeJugador(jugador.id)]);

  const actual = historial.find((h) => h.ranking_estado !== "cerrado") ?? historial[0];
  const totales = historial.reduce((acc, h) => ({ pj: acc.pj + h.pj, pg: acc.pg + h.pg, pp: acc.pp + h.pp }), {
    pj: 0,
    pg: 0,
    pp: 0,
  });

  const soyYo = sesion?.authId === jugador.id;
  const h2h = sesion && !soyYo ? headToHead(partidos, sesion.authId) : null;

  const puesto = actual && actual.ranking_estado !== "cerrado" ? `${actual.posicion}.º` : undefined;
  const difSets = historial.reduce((n, h) => n + (h.pg - h.pp), 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col bg-background pb-8">
      <CabeceraPerfil
        nombre={jugador.nombre}
        bajo={`Carnet ${jugador.carnet} · División ${actual ? actual.division : "sin asignar"}${
          jugador.activo ? "" : " · dado de baja"
        }`}
        puesto={puesto}
        detalle={
          actual && puesto ? (
            <>
              de {actual.jugadores_division} en {actual.division}
              <br />
              {actual.pts} {actual.pts === 1 ? "punto" : "puntos"}, {actual.pj} jugados
            </>
          ) : null
        }
      />

      <Cifras
        datos={[
          ["Jugados", totales.pj],
          ["Ganados", totales.pg],
          ["Perdidos", totales.pp],
          ["Sets", difSets >= 0 ? `+${difSets}` : difSets],
        ]}
      />

      {h2h ? (
        <Pie>
          Entre vos y {jugador.nombre.split(" ")[0]} van {h2h.ganoOtro}-{h2h.ganoDuenio} a tu favor en {h2h.jugados}{" "}
          partido{h2h.jugados === 1 ? "" : "s"}.
        </Pie>
      ) : null}

      <Rotulo>Historial</Rotulo>
      {historial.length === 0 ? (
        <Pie>Todavía no participó en ningún ranking.</Pie>
      ) : (
        <Lista>
          {historial.map((h) => {
            const d = distincion(h);
            return (
              <Fila
                key={h.ranking_id}
                nombre={h.ranking_nombre}
                sub={`${h.division} · puesto ${h.posicion} de ${h.jugadores_division} · ${h.pg}-${h.pp}`}
                href={`/rankings/${h.ranking_id}` as Route}
                derecha={d ? <Marcador texto={d.texto} gano={d.variante !== "descenso"} /> : <Flecha />}
              />
            );
          })}
        </Lista>
      )}

      <Rotulo>Partidos</Rotulo>
      {partidos.length === 0 ? (
        <Pie>Sin partidos confirmados.</Pie>
      ) : (
        <Lista>
          {partidos.map((p) => (
            <Fila
              key={p.id}
              nombre={p.rival.nombre}
              sub={`${p.fecha ? formatearFecha(p.fecha) : "sin fecha"}${p.tipo === "desempate" ? " · desempate" : ""}`}
              href={`/jugador/${encodeURIComponent(p.rival.carnet)}` as Route}
              derecha={p.sets ? <Marcador texto={p.sets} gano={p.gano === true} /> : <Flecha />}
            />
          ))}
        </Lista>
      )}

      {soyYo ? (
        <>
          <Rotulo>Cuenta</Rotulo>
          <Lista>
            <Fila
              nombre="Cambiar mi PIN"
              sub="El que usás para ingresar"
              href="/cambiar-pin"
              derecha={<Flecha />}
              sinInicial
            />
            <FilaAccion
              nombre="Salir"
              sub="Cerrar sesión en este teléfono"
              accion={salir}
              derecha={<Flecha />}
              sinInicial
            />
          </Lista>
        </>
      ) : null}
    </main>
  );
}
