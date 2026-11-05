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
import {
  CabeceraPerfil,
  Cifras,
  Fila,
  FilaAccion,
  FilaExterna,
  Flecha,
  Lista,
  Marcador,
  Pie,
  primerNombre,
  Rotulo,
  type Sello,
} from "@/components/fila";
import { GLIFO } from "@/components/iconos";
import { Medalla } from "@/components/medalla";
import { Tope } from "@/components/tope";
import { salir } from "@/app/(auth)/ingresar/acciones";
import { CREADOR, PORTAFOLIO_VISIBLE } from "@/lib/creditos";
import { divisionLarga, nivelDivision, nombreDivision } from "@/lib/ranking/divisiones";
import { medallaDe, medallasDelHistorial, nombreMedalla, textoMedalla } from "@/lib/ranking/medallas";

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
  const nivel = nivelDivision(f.division);
  if (nivel > 1 && f.posicion <= f.n_ascienden) return { texto: "subió", bueno: true };
  if (f.posicion <= f.n_premiados) return { texto: "premio", bueno: true };
  if (nivel < f.divisiones && f.posicion > f.jugadores_division - f.n_descienden)
    return { texto: "bajó", bueno: false };
  return null;
}

/** "Cerrado · terminó 6.º en Primera" o "En juego · va 4.º de 10 en Primera". */
function lineaHistorial(f: FilaHistorial, soyYo: boolean) {
  const division = nombreDivision(f.division);
  if (f.ranking_estado === "cerrado") {
    return `Cerrado · ${soyYo ? "terminaste" : "terminó"} ${f.posicion}.º en ${division}`;
  }
  return `En juego · ${soyYo ? "vas" : "va"} ${f.posicion}.º de ${f.jugadores_division} en ${division}`;
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

  const division = actual ? nombreDivision(actual.division) : null;
  const esCreador = jugador.carnet === CREADOR.carnet;
  // Las medallas van primero: son lo que ganó jugando.
  const sellos: Sello[] = [
    ...medallasDelHistorial(historial).map((m) => ({ texto: textoMedalla(m), medalla: m.puesto })),
    ...(esCreador ? [{ texto: "Creador de la app" }] : []),
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pb-8">
      {/* La barra arranca transparente sobre el verde; el nombre aparece en
          ella recién al bajar, cuando la cabecera ya se fue. */}
      <Tope titulo={jugador.nombre} grande={false} alBajar={150} atras={soyYo ? undefined : "/"} />
      <CabeceraPerfil
        nombre={jugador.nombre}
        bajo={`Carnet ${jugador.carnet} · ${actual ? divisionLarga(actual.division) : "sin división"}${
          jugador.activo ? "" : " · dado de baja"
        }`}
        puesto={puesto}
        sellos={sellos}
        detalle={
          actual && puesto ? (
            <>
              de {actual.jugadores_division} en {division}
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
          ["Sets", difSets > 0 ? `+${difSets}` : difSets],
        ]}
      />

      {h2h ? (
        <Pie>
          Entre vos y {jugador.nombre.split(" ")[0]} van {h2h.ganoOtro}-{h2h.ganoDuenio} a tu favor en {h2h.jugados}{" "}
          partido{h2h.jugados === 1 ? "" : "s"}.
        </Pie>
      ) : null}

      {esCreador ? (
        <>
          <Rotulo>Sobre la app</Rotulo>
          <Lista>
            <FilaExterna
              href={CREADOR.portafolio}
              nombre={soyYo ? "Tu portafolio" : "Su portafolio"}
              sub={PORTAFOLIO_VISIBLE}
              icono={{ glifo: GLIFO.codigo, color: "var(--uvg)" }}
            />
          </Lista>
          {soyYo ? null : (
            <Pie>
              {primerNombre(jugador.nombre)} hizo esta app para el club. Si algo no funciona o se te ocurre una
              mejora, escribile.
            </Pie>
          )}
        </>
      ) : null}

      <Rotulo>Historial</Rotulo>
      {historial.length === 0 ? (
        <Pie>Todavía no participó en ningún ranking.</Pie>
      ) : (
        <Lista>
          {historial.map((h) => {
            const d = distincion(h);
            const medalla = medallaDe(h.ranking_estado, h.posicion);
            return (
              <Fila
                key={h.ranking_id}
                sinInicial
                nombre={h.ranking_nombre}
                sub={lineaHistorial(h, soyYo)}
                href={`/rankings/${h.ranking_id}` as Route}
                derecha={
                  <>
                    {medalla ? (
                      <span className="inline-flex" title={nombreMedalla(medalla)}>
                        <Medalla puesto={medalla} tamano={20} />
                        <span className="sr-only">{nombreMedalla(medalla)}</span>
                      </span>
                    ) : null}
                    {/* Con medalla, «premio» ya está dicho; «subió» no. */}
                    {d && !(medalla && d.texto === "premio") ? <Marcador texto={d.texto} gano={d.bueno} /> : null}
                    <Flecha />
                  </>
                }
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
              href="/cambiar-pin"
              derecha={<Flecha />}
              icono={{ glifo: GLIFO.llave, color: "var(--gris)" }}
            />
          </Lista>
          <div className="h-3.5" />
          <Lista>
            <FilaAccion nombre="Cerrar sesión" accion={salir} peligro />
          </Lista>
        </>
      ) : null}
    </main>
  );
}
