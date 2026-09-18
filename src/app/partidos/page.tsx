import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth/sesion";
import { rankingVigente } from "@/lib/ranking/consultas";
import {
  autoconfirmarVencidos,
  misMarcadoresAbiertos,
  misPartidos,
  misPartidosDeTorneo,
  type PartidoMio,
} from "@/lib/partidos/consultas";
import { Badge } from "@/components/ui/badge";
import { Fila, Flecha, Lista, Marcador, Pastilla, Pie, Rotulo } from "@/components/fila";
import { Tope } from "@/components/tope";
import { BotonDisputar } from "./formularios";
import { textoAutoconfirmacion, textoFechaLimite } from "@/lib/fechas";

export const metadata: Metadata = { title: "Mis partidos" };

/** La línea chica de la fila: de dónde sale el partido. */
function contexto(p: PartidoMio): string {
  if (!p.division) return `${p.torneo?.nombre ?? "Torneo"} · ${p.tipo === "grupo" ? "fase de grupos" : "llave"}`;
  return p.tipo === "desempate" ? `${p.division} · desempate` : p.division;
}

export default async function PaginaMisPartidos({ searchParams }: PageProps<"/partidos">) {
  const [{ registrado, bienvenida }, sesion, ranking] = await Promise.all([
    searchParams,
    requerirSesion(),
    rankingVigente(),
  ]);
  if (sesion.usuario.debe_cambiar_pin) redirect("/cambiar-pin");

  if (!ranking || !["abierto", "en_desempates"].includes(ranking.estado)) {
    return (
      <>
        <Tope titulo="Mis partidos" sub="Sin ranking en juego" />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
          <p className="text-muted-foreground">No hay un ranking en juego ahora mismo.</p>
        </main>
      </>
    );
  }

  await autoconfirmarVencidos();
  const [mp, marcadores, deTorneo] = await Promise.all([
    misPartidos(sesion.authId, ranking.id),
    misMarcadoresAbiertos(sesion.authId),
    misPartidosDeTorneo(sesion.authId),
  ]);
  const inscrito =
    mp.pendientes.length +
      mp.porConfirmar.length +
      mp.esperandoRival.length +
      mp.enDisputa.length +
      mp.historial.length >
    0;

  // `main` va sin padding horizontal: los rótulos y las listas del prototipo
  // llegan hasta el borde de la pantalla y traen el suyo.
  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col bg-card pb-6">
        <Tope titulo="Mis partidos" sub={ranking.nombre} />

        {bienvenida ? (
          /* Un aviso, no una tarjeta: el diseño descartó las tarjetas para
           separar secciones. Se apoya en el mismo bloque que el resto de los
           avisos de la aplicación. */
          <div className="mx-4 mt-3 flex flex-col gap-2 rounded-lg border border-uvg bg-uvg-suave px-4 py-3 text-sm">
            <p className="font-medium">Listo, ya estás adentro</p>
            <p>
              Acá abajo están tus partidos. Coordinás con cada rival cuándo jugar, y cuando terminen, cualquiera de
              los dos registra el resultado desde esta pantalla.
            </p>
            <p>
              El otro tiene que confirmarlo para que sume en la tabla. Si registran algo que no fue, se puede
              disputar.
            </p>
            <p>
              <Link
                href="/reglas"
                className="inline-flex min-h-10 items-center text-primary underline-offset-4 hover:underline"
              >
                Ver cómo funciona el ranking
              </Link>
            </p>
          </div>
        ) : null}

        {registrado ? (
          <p role="status" className="mx-4 mt-3 rounded-lg border border-uvg bg-uvg-suave px-4 py-3 text-sm">
            Resultado registrado.{" "}
            {ranking.horas_autoconfirmacion
              ? `Tu rival tiene ${ranking.horas_autoconfirmacion} horas para confirmarlo.`
              : "Falta que tu rival lo confirme."}
          </p>
        ) : null}

        {!inscrito ? (
          <Pie>No estás inscrito en este ranking. Hablá con el coordinador.</Pie>
        ) : (
          <>
            {/* El prototipo solo muestra este rótulo si hay algo que responder. */}
            {mp.porConfirmar.length > 0 ? (
              <>
                <Rotulo urgente>Te toca responder</Rotulo>
                <Lista>
                  {mp.porConfirmar.map((p) => (
                    <Fila
                      key={p.id}
                      nombre={p.rival.nombre}
                      sub={`Dice que te ${p.gane ? "perdió" : "ganó"}${p.sets ? ` ${p.sets}` : ""}`}
                      href={`/partidos/${p.id}` as Route}
                      derecha={<Pastilla>Confirmar</Pastilla>}
                    />
                  ))}
                </Lista>
              </>
            ) : null}

            {deTorneo.length > 0 ? (
              <>
                {/* Los de torneo van antes que los del ranking: un torneo se
                    juega en un día y el ranking dura el semestre. */}
                <Rotulo>Torneo</Rotulo>
                <Lista>
                  {deTorneo.map((p) => (
                    <Fila
                      key={p.id}
                      nombre={p.rival.nombre}
                      sub={contexto(p)}
                      href={`/partidos/${p.id}` as Route}
                      derecha={
                        p.estado === "jugado" && !p.loRegistreYo ? (
                          <Pastilla>Confirmar</Pastilla>
                        ) : p.estado === "disputado" ? (
                          <Badge variant="descenso">En disputa</Badge>
                        ) : p.estado === "jugado" ? (
                          <Badge variant="outline">Esperando</Badge>
                        ) : (
                          <Flecha />
                        )
                      }
                    />
                  ))}
                </Lista>
              </>
            ) : null}

            <Rotulo>Por jugar</Rotulo>
            {mp.pendientes.length > 0 ? (
              <Lista>
                {mp.pendientes.map((p) => (
                  <Fila
                    key={p.id}
                    nombre={p.rival.nombre}
                    sub={contexto(p)}
                    href={`/partidos/${p.id}` as Route}
                    derecha={<Flecha />}
                  />
                ))}
              </Lista>
            ) : (
              <Pie>Ya jugaste todos tus partidos.</Pie>
            )}

            {mp.esperandoRival.length > 0 ? (
              <>
                <Rotulo>Esperando a tu rival</Rotulo>
                <Lista>
                  {mp.esperandoRival.map((p) => (
                    <Fila
                      key={p.id}
                      nombre={p.rival.nombre}
                      sub={contexto(p)}
                      href={`/partidos/${p.id}` as Route}
                      derecha={<Flecha />}
                    >
                      {textoAutoconfirmacion(p.registradoEn, ranking.horas_autoconfirmacion) ? (
                        <p className="text-[12.5px] text-muted-foreground">
                          Si no responde, {textoAutoconfirmacion(p.registradoEn, ranking.horas_autoconfirmacion)}.
                        </p>
                      ) : null}
                    </Fila>
                  ))}
                </Lista>
              </>
            ) : null}

            {mp.enDisputa.length > 0 ? (
              <>
                <Rotulo urgente>En disputa</Rotulo>
                <Lista>
                  {mp.enDisputa.map((p) => (
                    <Fila key={p.id} nombre={p.rival.nombre} sub={contexto(p)}>
                      <p className="text-[12.5px] text-muted-foreground">
                        El coordinador lo va a resolver. Motivo: {p.disputaMotivo}
                      </p>
                    </Fila>
                  ))}
                </Lista>
              </>
            ) : null}

            <Rotulo>Jugados</Rotulo>
            {mp.historial.length > 0 ? (
              <Lista>
                {mp.historial.map((p) => (
                  <Fila
                    key={p.id}
                    nombre={p.rival.nombre}
                    sub={contexto(p)}
                    derecha={
                      p.estado === "anulado" ? (
                        <Badge variant="outline">Anulado</Badge>
                      ) : p.sets ? (
                        <Marcador texto={p.sets} gano={p.gane === true} />
                      ) : null
                    }
                  >
                    {p.estado === "resuelto" && p.resolucion ? (
                      <p className="text-[12.5px] text-muted-foreground">
                        Resuelto por el coordinador: {p.resolucion}
                      </p>
                    ) : null}
                    {p.estado === "confirmado" ? (
                      <div className="self-start">
                        <BotonDisputar partidoId={p.id} />
                      </div>
                    ) : null}
                  </Fila>
                ))}
              </Lista>
            ) : (
              <Pie>Todavía no tenés resultados confirmados.</Pie>
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
                  ini="▮"
                />
              ))}
              <Fila
                nombre="Marcador libre"
                sub="Para un partido que no es del ranking"
                href="/marcador/nuevo"
                derecha={<Flecha />}
                sinInicial
              />
            </Lista>

            <Pie>El ranking cierra el {textoFechaLimite(ranking.fecha_limite)}.</Pie>
          </>
        )}
      </main>
    </>
  );
}
