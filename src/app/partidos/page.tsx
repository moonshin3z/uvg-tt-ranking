import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth/sesion";
import { rankingVigente, tablaDeDivision } from "@/lib/ranking/consultas";
import {
  autoconfirmarVencidos,
  misMarcadoresAbiertos,
  misPartidos,
  misPartidosDeTorneo,
  type PartidoMio,
} from "@/lib/partidos/consultas";
import { Fila, Flecha, Lista, Marcador, Pastilla, Pie, Rotulo } from "@/components/fila";
import { GLIFO } from "@/components/iconos";
import { Tope } from "@/components/tope";
import { AvisoFlotante } from "@/components/aviso-flotante";
import { formatearDia, textoAutoconfirmacion } from "@/lib/fechas";

export const metadata: Metadata = { title: "Mis partidos" };

const DIVISION = { mayor: "Mayor", menor: "Menor" } as const;

/** La línea de abajo de la fila: de dónde sale el partido. */
function contexto(p: PartidoMio): string {
  if (!p.division) return `${p.torneo?.nombre ?? "Torneo"} · ${p.tipo === "grupo" ? "fase de grupos" : "llave"}`;
  return `División ${DIVISION[p.division]}${p.tipo === "desempate" ? " · desempate" : ""}`;
}

const enlace = (p: PartidoMio) => `/partidos/${p.id}` as Route;

/** Lo que dice el aviso de arriba al volver de responder un resultado. */
const LISTO: Record<string, string> = {
  confirmado: "Confirmado. La tabla ya lo cuenta.",
  disputa: "Le avisamos al coordinador.",
};

export default async function PaginaMisPartidos({ searchParams }: PageProps<"/partidos">) {
  const [{ registrado, bienvenida, listo }, sesion, rankingActual] = await Promise.all([
    searchParams,
    requerirSesion(),
    rankingVigente(),
  ]);
  if (sesion.usuario.debe_cambiar_pin) redirect("/cambiar-pin");

  const ranking = rankingActual && ["abierto", "en_desempates"].includes(rankingActual.estado) ? rankingActual : null;

  await autoconfirmarVencidos();
  const [mp, marcadores, deTorneo] = await Promise.all([
    ranking ? misPartidos(sesion.authId, ranking.id) : Promise.resolve(null),
    misMarcadoresAbiertos(sesion.authId),
    misPartidosDeTorneo(sesion.authId),
  ]);
  const inscrito =
    mp !== null &&
    mp.pendientes.length +
      mp.porConfirmar.length +
      mp.esperandoRival.length +
      mp.enDisputa.length +
      mp.historial.length >
      0;

  // Dónde vas: el subtítulo y la nota del final lo dicen, como en el prototipo.
  const division = mp
    ? [...mp.pendientes, ...mp.porConfirmar, ...mp.esperandoRival, ...mp.enDisputa, ...mp.historial].find(
        (p) => p.division,
      )?.division
    : undefined;
  const mia =
    ranking && division
      ? (await tablaDeDivision(ranking, division)).find((f) => f.usuario_id === sesion.authId)
      : undefined;

  // Los de torneo van mezclados con los del ranking, cada uno donde le toca,
  // y primero: un torneo se juega en un día y el ranking dura el semestre.
  const responder = [
    ...deTorneo.filter((p) => p.estado === "jugado" && !p.loRegistreYo),
    ...(mp?.porConfirmar ?? []),
  ];
  const porJugar = [...deTorneo.filter((p) => p.estado === "pendiente"), ...(mp?.pendientes ?? [])];
  const esperando = [
    ...deTorneo.filter((p) => p.estado === "jugado" && p.loRegistreYo),
    ...(mp?.esperandoRival ?? []),
  ];
  const enDisputa = [...deTorneo.filter((p) => p.estado === "disputado"), ...(mp?.enDisputa ?? [])];

  const quedan = mp?.pendientes.length ?? 0;
  const sub = mia
    ? `${mia.posicion}.º en ${division ? DIVISION[division] : ""} · ${porJugar.length} por jugar`
    : (ranking?.nombre ?? "Tus torneos y marcadores");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pb-8">
      <Tope titulo="Partidos" sub={sub} />

      {registrado ? (
        <AvisoFlotante texto="Registrado. Falta la confirmación." />
      ) : typeof listo === "string" && LISTO[listo] ? (
        <AvisoFlotante texto={LISTO[listo]} />
      ) : null}

      {bienvenida ? (
        <div className="alerta buena izq">
          <p>
            <b>Listo, ya estás adentro.</b> Acá abajo están tus partidos. Coordinás con cada rival cuándo jugar, y
            cuando terminen, cualquiera de los dos registra el resultado desde esta pantalla.
          </p>
          <p>
            El otro tiene que confirmarlo para que sume en la tabla. Si registran algo que no fue, se puede disputar.{" "}
            <Link href="/reglas" className="font-semibold underline underline-offset-4">
              Cómo funciona el ranking
            </Link>
          </p>
        </div>
      ) : null}

      {responder.length > 0 ? (
        <>
          <Rotulo cuenta={responder.length}>Te toca responder</Rotulo>
          <Lista>
            {responder.map((p) => (
              <Fila
                key={p.id}
                nombre={p.rival.nombre}
                sub={`Dice que te ${p.gane ? "perdió" : "ganó"}${p.sets ? ` ${p.sets}` : ""}`}
                href={enlace(p)}
                derecha={<Pastilla>Revisar</Pastilla>}
              />
            ))}
          </Lista>
        </>
      ) : null}

      {porJugar.length > 0 || inscrito ? (
        <>
          <Rotulo>Por jugar</Rotulo>
          {porJugar.length > 0 ? (
            <Lista>
              {porJugar.map((p) => (
                <Fila key={p.id} nombre={p.rival.nombre} sub={contexto(p)} href={enlace(p)} derecha={<Flecha />} />
              ))}
            </Lista>
          ) : (
            <Pie>Ya jugaste todos tus partidos.</Pie>
          )}
        </>
      ) : null}

      {esperando.length > 0 ? (
        <>
          <Rotulo>Esperando a tu rival</Rotulo>
          <Lista>
            {esperando.map((p) => {
              const horas = p.division ? ranking?.horas_autoconfirmacion : null;
              const vence = textoAutoconfirmacion(p.registradoEn, horas ?? null);
              return (
                <Fila
                  key={p.id}
                  nombre={p.rival.nombre}
                  sub={vence ? `Si no responde, ${vence}` : contexto(p)}
                  href={enlace(p)}
                  derecha={<Flecha />}
                />
              );
            })}
          </Lista>
        </>
      ) : null}

      {enDisputa.length > 0 ? (
        <>
          <Rotulo cuenta={enDisputa.length}>En disputa</Rotulo>
          <Lista>
            {enDisputa.map((p) => (
              <Fila key={p.id} nombre={p.rival.nombre} sub={contexto(p)} href={enlace(p)} derecha={<Flecha />}>
                El coordinador lo va a resolver. Motivo: {p.disputaMotivo}
              </Fila>
            ))}
          </Lista>
        </>
      ) : null}

      {!ranking || !mp ? (
        deTorneo.length === 0 ? (
          <Pie>No hay un ranking en juego ahora mismo.</Pie>
        ) : null
      ) : !inscrito ? (
        <Pie>No estás inscrito en este ranking. Hablá con el coordinador.</Pie>
      ) : (
        <>
          <Rotulo>Jugados</Rotulo>
          {mp.historial.length > 0 ? (
            <Lista>
              {mp.historial.map((p) => {
                const cuando = p.confirmadoEn ?? p.registradoEn;
                return (
                  <Fila
                    key={p.id}
                    nombre={p.rival.nombre}
                    sub={cuando ? formatearDia(cuando) : contexto(p)}
                    href={enlace(p)}
                    derecha={
                      p.estado === "anulado" ? (
                        <span className="res">Anulado</span>
                      ) : p.sets ? (
                        <Marcador texto={p.sets} gano={p.gane === true} />
                      ) : null
                    }
                  >
                    {p.estado === "resuelto" && p.resolucion ? `Resuelto por el coordinador: ${p.resolucion}` : null}
                  </Fila>
                );
              })}
            </Lista>
          ) : (
            <Pie>Todavía no tenés resultados confirmados.</Pie>
          )}

          {mia ? (
            <Pie>
              Vas {mia.posicion}.º con {mia.pts} {mia.pts === 1 ? "punto" : "puntos"}.{" "}
              {quedan > 0
                ? `Te ${quedan === 1 ? "queda 1 partido" : `quedan ${quedan} partidos`} del ranking.`
                : "Ya no te quedan partidos del ranking."}
            </Pie>
          ) : null}
        </>
      )}

      <Rotulo>Marcador</Rotulo>
      <Lista>
        {marcadores.map((m) => (
          <Fila
            key={m.id}
            nombre={`${m.nombreA} vs. ${m.nombreB}`}
            sub={
              m.estado === "abandonado"
                ? `Abandonado en ${m.setsA}-${m.setsB}`
                : `Sin terminar · va ${m.setsA}-${m.setsB} (${m.puntosA}-${m.puntosB})`
            }
            href={`/marcador/${m.id}` as Route}
            derecha={<Flecha />}
            icono={{ glifo: GLIFO.marcador, color: "var(--gris)" }}
          />
        ))}
        <Fila
          nombre="Marcador libre"
          sub="Para un partido fuera de una competencia"
          href="/marcador/nuevo"
          derecha={<Flecha />}
          icono={{ glifo: GLIFO.mas, color: "var(--uvg)" }}
        />
      </Lista>
    </main>
  );
}
