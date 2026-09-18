import type { Metadata, Route } from "next";
import { notFound, redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth/sesion";
import { partidoPorId, setsDePartido } from "@/lib/partidos/consultas";
import { rankingPorId } from "@/lib/ranking/consultas";
import { createClient } from "@/lib/supabase/server";
import { textoAutoconfirmacion } from "@/lib/fechas";
import { Aviso, Pila, TarjetaMarcador } from "@/components/fila";
import { Tope } from "@/components/tope";
import { BotonesConfirmar, FormularioResultado } from "../formularios";
import { abrirMarcador } from "../acciones";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Partido" };

/** `11-7 · 9-11 · 8-11` */
function textoSets(puntos: { puntos_a: number; puntos_b: number }[], soyA: boolean): string {
  return puntos.map((s) => (soyA ? `${s.puntos_a}-${s.puntos_b}` : `${s.puntos_b}-${s.puntos_a}`)).join(" · ");
}

export default async function PaginaPartido({ params, searchParams }: PageProps<"/partidos/[id]">) {
  const [{ id }, { marcador }, sesion] = await Promise.all([params, searchParams, requerirSesion()]);
  if (sesion.usuario.debe_cambiar_pin) redirect("/cambiar-pin");

  const p = await partidoPorId(id);
  if (!p) notFound();

  const yo = sesion.authId;
  const esCoordinador = sesion.usuario.rol === "coordinador";
  const juego = p.jugador_a === yo || p.jugador_b === yo;
  if (!juego && !esCoordinador) redirect("/partidos");

  const supabase = await createClient();
  const [puntos, ranking, reglas] = await Promise.all([
    setsDePartido(id),
    // Un partido de torneo no cuelga de ningún ranking.
    p.division ? rankingPorId(p.division.ranking_id) : Promise.resolve(null),
    // Las reglas salen del contenedor del partido, que puede ser un ranking o
    // un torneo, y cada uno juega a lo suyo.
    supabase.rpc("reglas_de_partido", { p_partido_id: id }),
  ]);
  const setsParaGanar = reglas.data?.[0]?.sets_para_ganar ?? 2;

  // Para el coordinador mirando un partido ajeno, "yo" es el jugador A.
  const soyA = juego ? p.jugador_a === yo : true;
  const propio = soyA ? p.a : p.b;
  const rival = soyA ? p.b : p.a;
  const volver = esCoordinador && !juego ? "/admin/partidos" : "/partidos";

  const misSets = soyA ? p.sets_a : p.sets_b;
  const susSets = soyA ? p.sets_b : p.sets_a;
  const contexto = p.division
    ? `División ${p.division.tipo}${p.tipo === "desempate" ? " · desempate" : ""}`
    : `${p.torneo?.nombre ?? "Torneo"} · ${p.tipo === "grupo" ? "fase de grupos" : "llave"}`;

  // Me toca responder: lo registró el otro y todavía no está cerrado.
  const meTocaResponder = juego && p.estado === "jugado" && p.registrado_por !== yo;
  const puedeRegistrar =
    p.estado === "pendiente" || (p.estado === "jugado" && (p.registrado_por === yo || esCoordinador));

  return (
    <>
      <Tope
        titulo={juego ? rival.nombre : `${p.a.nombre} vs. ${p.b.nombre}`}
        sub={contexto}
        atras={volver as Route}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col bg-card pb-8">
        <div className="bg-card px-4 pt-[22px] pb-7">
          {meTocaResponder ? (
            <>
              <p className="text-[21px] font-semibold tracking-[-0.025em] text-balance">
                {rival.nombre.split(" ")[0]} dice que te{" "}
                {misSets != null && susSets != null && misSets > susSets ? "perdió" : "ganó"}
              </p>
              <p className="mt-1 text-[13.5px] text-pretty text-muted-foreground">
                {contexto} · lo registró {rival.nombre.split(" ")[0]}
              </p>

              <TarjetaMarcador
                marcador={`${misSets ?? 0} - ${susSets ?? 0}`}
                sets={puntos.length > 0 ? textoSets(puntos, soyA) : undefined}
              />

              <Pila>
                <BotonesConfirmar partidoId={p.id} />
              </Pila>

              {ranking && textoAutoconfirmacion(p.registrado_en, ranking.horas_autoconfirmacion) ? (
                <Aviso>
                  Si no respondés, {textoAutoconfirmacion(p.registrado_en, ranking.horas_autoconfirmacion)}.
                </Aviso>
              ) : null}
            </>
          ) : puedeRegistrar ? (
            <>
              <p className="text-[21px] font-semibold tracking-[-0.025em] text-balance">
                {juego ? `vs. ${rival.nombre}` : `${p.a.nombre} vs. ${p.b.nombre}`}
              </p>
              <p className="mt-1 text-[13.5px] text-pretty text-muted-foreground">
                {contexto} · {p.estado === "jugado" ? "corregir el resultado" : "todavía sin jugar"}
              </p>
              {marcador === "no" ? (
                <p role="alert" className="mt-4 rounded-md bg-malo-suave px-3.5 py-3 text-[14px] text-malo-hondo">
                  No se pudo abrir el marcador. Anotá el resultado a mano acá abajo.
                </p>
              ) : null}

              {/* El camino largo del prototipo: llevar el marcador en vivo y que
                el resultado se registre solo al terminar. */}
              <form action={abrirMarcador} className="mt-5">
                <input type="hidden" name="partido_id" value={p.id} />
                <Button type="submit" variant="outline" size="lg" className="w-full">
                  Llevar el marcador en vivo
                </Button>
              </form>

              <div className="mt-3">
                <FormularioResultado
                  partidoId={p.id}
                  yo={juego ? { id: propio.id, nombre: propio.nombre } : { id: p.a.id, nombre: p.a.nombre }}
                  rival={{ id: rival.id, nombre: rival.nombre }}
                  soyA={soyA}
                  setsA={p.sets_a}
                  setsB={p.sets_b}
                  puntos={puntos}
                  setsParaGanar={setsParaGanar}
                />
              </div>
              <Aviso>Cualquiera de los dos puede registrarlo. El otro lo confirma.</Aviso>
            </>
          ) : (
            /* Cerrado, en disputa o anulado: antes esta pantalla te devolvía a la
             lista sin decir nada. Ahora muestra lo que pasó. */
            <>
              <p className="text-[21px] font-semibold tracking-[-0.025em] text-balance">vs. {rival.nombre}</p>
              <p className="mt-1 text-[13.5px] text-pretty text-muted-foreground">
                {contexto} ·{" "}
                {p.estado === "disputado"
                  ? "en disputa, lo va a resolver el coordinador"
                  : p.estado === "anulado"
                    ? "anulado"
                    : "resultado confirmado"}
              </p>
              {p.estado !== "anulado" && misSets != null && susSets != null ? (
                <TarjetaMarcador
                  marcador={`${misSets} - ${susSets}`}
                  sets={puntos.length > 0 ? textoSets(puntos, soyA) : undefined}
                />
              ) : null}
              {p.disputa_motivo ? <Aviso>Motivo de la disputa: {p.disputa_motivo}</Aviso> : null}
              {p.resolucion ? <Aviso>Resolución del coordinador: {p.resolucion}</Aviso> : null}
            </>
          )}
        </div>
      </main>
    </>
  );
}
